import {useEffect, useRef, useState} from "react";
import Button from "./Button.jsx";

export default function ConnectionWs() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [audioChunks, setAudioChunks] = useState([]);
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamSourceRef = useRef(null);
  const audioWorkletNodeRef = useRef(null);
  const streamRef = useRef(null);

  useEffect( () => {
    console.info("Connection");
    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;
    ws.onopen = () => {
      console.log("Connected to server");
      setIsConnected(true);
    }
    ws.onmessage = (event) => {
      console.info("Received message from server:");
      console.info(event.data);
    }
    ws.onerror = err => {
      console.error("WebSocket error:", err);
      setIsConnected(false);
    }
  }, [])

  let audioBuffer = new Uint8Array(0); // or Int16Array
  function appendAudioChunk(newChunk) {
    // Concatenate old and new Int16Array chunks
    // const tmp = new Int16Array(audioBuffer.length + newChunk.length);
    const tmp = new Uint8Array(audioBuffer.length + newChunk.length);
    tmp.set(audioBuffer, 0);
    tmp.set(newChunk, audioBuffer.length);
    audioBuffer = tmp;
  }
  async function startSession() {
    console.info('Attempting to start session...');
    if (isSessionActive) {
      console.warn("Session is already active.");
      return;
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    try {
      // Add local audio track for microphone input in the browser
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mediaStreamSource = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      mediaStreamSource.connect(processor);
      processor.connect(audioContextRef.current.destination);

      processor.onaudioprocess = (event) => {
        // console.info("Processing audio chunk...");
        // console.info("Audio chunk length:", event.inputBuffer.length);
        const audioChunk = event.inputBuffer.getChannelData(0);
        const float32Array = new Float32Array(audioChunk); // Convert to Float32Array
        // Store the audio chunk in the array
        setAudioChunks((prevChunks) => [...prevChunks, new Float32Array(audioChunk)]);
        // Downsample to 16kHz Int16 PCM
        /*const pcm16 = downsampleTo16kHz(float32Array, audioContextRef.current.sampleRate);
        const uint8pcm = new Uint8Array(pcm16.buffer); // Convert Int16Array to Uint8Array
        // Append to buffer
        appendAudioChunk(uint8pcm);
        if (audioBuffer.length >= 3200 && wsRef.current && isConnected) {
          wsRef.current.send(audioBuffer.buffer); // Send raw bytes
          audioBuffer = new Uint8Array(0); // Reset buffer
          // Commit after sending the buffer
          wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        } else {
          console.warn("Buffer too small to commit. Accumulating more audio...", audioBuffer.length);
        }*/
      }
      console.info('Starting session...');
      setIsSessionActive(true)
    }  catch (err) {
      console.error('Error starting audio processor:', err);
      setIsSessionActive(false)
    }
  }
  async function startSession2() {
    console.info('Attempting to start session...');
    if (isSessionActive) {
      console.warn("Session is already active.");
      return;
    }
    if (!isConnected) {
      console.warn("WebSocket is not connected. Cannot start session.");
      return;
    }

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      // Ensure AudioContext is running
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      await audioContextRef.current.audioWorklet.addModule('/audio-processor.js'); // Path to your worklet

      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
      audioWorkletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'my-audio-processor');

      audioWorkletNodeRef.current.port.onmessage = (event) => {
        // event.data is the ArrayBuffer from the worklet
        const float32Array = new Float32Array(event.data);

        // Downsample to 16kHz Int16 PCM
        const pcm16 = downsampleTo16kHz(float32Array, audioContextRef.current.sampleRate);
        const uint8pcm = new Uint8Array(pcm16.buffer);

        appendAudioChunk(uint8pcm);

        if (audioBuffer.length >= 3200 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(audioBuffer.buffer); // Send raw bytes
          audioBuffer = new Uint8Array(0); // Reset buffer
          wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        } else if (audioBuffer.length > 0) { // Log only if there's something in buffer but not enough
          // console.warn("Buffer too small to commit. Accumulating more audio...", audioBuffer.length);
        }
      };

      mediaStreamSourceRef.current.connect(audioWorkletNodeRef.current);
      // No need to connect worklet to destination if you only process and send
      // audioWorkletNodeRef.current.connect(audioContextRef.current.destination);

      console.info('Audio processing session started with AudioWorklet.');
      setIsSessionActive(true);
    }  catch (err) {
      console.error('Error starting audio processing session:', err);
      setIsSessionActive(false);
    }
  }
  async function startSpeechToTextSession() {
    console.info('Attempting to start speech-to-text session...');
    if (isSessionActive) {
      console.warn("Session is already active.");
      return;
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    console.info('Starting speech-to-text session...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.info('Audio stream obtained successfully.');
      // Optional: Specify MIME type if your server expects a particular format
      const options = { mimeType: 'audio/opus;codecs=opus' }; // Example
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn(`${options.mimeType} is not supported. Using default.`);
        delete options.mimeType;
      }

      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = async (event) => {

        if (event.data.size > 0) {
          // Process the audio chunk
          console.info('Received audio chunk of size:', event.data.size);
          // Convert to base64 if needed
          // https://chatgpt.com/share/684ad1e5-96a0-8007-a881-1cb4bfdb0eab
          console.info(wsRef.current)
          if (wsRef.current && isConnected) {
            const arrayBuffer = await event.data.arrayBuffer();
            // Convert Float32Array to WAV format
            // const wavBuffer = encodeWAV(new Float32Array(arrayBuffer));
            // const base64Audio = arrayBufferToBase64(arrayBuffer);
            /*wsRef.current.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: base64Audio,
            }));*/
            // Decode audio data using Web Audio API
            const decodedAudioData = await audioContextRef.current.decodeAudioData(arrayBuffer);
            // const audioContext = new AudioContext();
            // const decodedAudioData = await audioContext.decodeAudioData(arrayBuffer);

            // Convert decoded audio data to Float32Array
            const float32Array = decodedAudioData.getChannelData(0); // Get data for the first channel

            // Convert Float32Array to WAV format
            // const wavBuffer = encodeWAV(float32Array);
            // Downsample to 16kHz Int16 PCM
            const pcm16 = downsampleTo16kHz(float32Array, decodedAudioData.sampleRate);
            // Convert Int16Array to Uint8Array for sending raw bytes
            const uint8pcm = new Uint8Array(pcm16.buffer);
            appendAudioChunk(uint8pcm);
            // const base64Audio = int16ToBase64(downsampled);
            // Send as raw buffer (not base64 — server can handle it as binary)
            // wsRef.current.send(pcm16.buffer);
            // If buffer ≥ 100ms, send it
            if (audioBuffer.length >= 3200) {
              wsRef.current.send(audioBuffer.buffer); // Send raw bytes
              audioBuffer = new Uint8Array(0); // reset buffer

              // Send commit after sending append(s)
              // ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
            }
          }
        }
      };

      mediaRecorder.onstart = () => {
        console.log("MediaRecorder started.");
        setIsSessionActive(true);
      };

      mediaRecorder.onstop = () => {
        console.log("MediaRecorder stopped.");
        // Stream tracks are usually stopped in stopSpeechToTextSession or disconnect handler
      };

      mediaRecorder.onerror = (errorEvent) => {
        console.error('MediaRecorder error:', errorEvent.error);
        stopSpeechToTextSession(); // Stop session on recorder error
      };

      mediaRecorder.start(5000); // Send chunks every 1000ms (1 second)
    } catch (err) {
      console.error('Error starting speech-to-text session:', err);
      setIsSessionActive(false); // Ensure session is marked as inactive
    }
  }

  function stopSpeechToTextSession() {
    console.info('Stopping speech-to-text session...');
    console.info('Stopping audio processing session...');
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.port.onmessage = null; // Remove listener
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (wsRef.current && isConnected) {
      const combinedChunks = audioChunks.reduce((acc, chunk) => {
        const temp = new Float32Array(acc.length + chunk.length);
        temp.set(acc);
        temp.set(chunk, acc.length);
        return temp;
      }, new Float32Array());
      const pcm16 = downsampleTo16kHz(combinedChunks, audioContextRef.current.sampleRate);
      const uint8pcm = new Uint8Array(pcm16.buffer); // Convert Int16Array to Uint8Array
      // Append to buffer
      appendAudioChunk(uint8pcm);
      wsRef.current.send(audioBuffer.buffer); // Send raw bytes
      // Commit after sending the buffer
      wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      saveAudioFile();
    }
    setIsSessionActive(false);
  }

  function saveAudioFile() {
    if (audioChunks.length === 0) {
      console.warn("No audio chunks available to save.");
      return;
    }

    // Combine all audio chunks into a single Float32Array
    const combinedChunks = audioChunks.reduce((acc, chunk) => {
      const temp = new Float32Array(acc.length + chunk.length);
      temp.set(acc);
      temp.set(chunk, acc.length);
      return temp;
    }, new Float32Array());

    // Convert Float32Array to WAV format
    const wavBuffer = encodeWAV(combinedChunks);
    console.info("WAV buffer created with length:", wavBuffer.byteLength);

    // Create a Blob from the combined chunks
    const blob = new Blob([wavBuffer], { type: "audio/wav" });

    // Create a downloadable file link
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audio.wav";
    a.click();

    // Clean up
    URL.revokeObjectURL(url);
    console.info("Audio file saved successfully.");
  }
  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function encodeWAV(samples) {
    const sampleRate = 44100; // Set the sample rate (e.g., 44.1 kHz)
    const numChannels = 1; // Mono audio
    const bitsPerSample = 16; // 16-bit PCM

    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = samples.length * bitsPerSample / 8;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true); // File size
    writeString(view, 8, "WAVE");

    // fmt sub-chunk
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // Sub-chunk size
    view.setUint16(20, 1, true); // Audio format (PCM)
    view.setUint16(22, numChannels, true); // Number of channels
    view.setUint32(24, sampleRate, true); // Sample rate
    view.setUint32(28, byteRate, true); // Byte rate
    view.setUint16(32, blockAlign, true); // Block align
    view.setUint16(34, bitsPerSample, true); // Bits per sample

    // data sub-chunk
    writeString(view, 36, "data");
    view.setUint32(40, dataSize, true); // Data size

    // Write audio samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i])); // Clamp sample values
      view.setInt16(offset, sample * 0x7FFF, true); // Convert to 16-bit PCM
      offset += 2;
    }

    return buffer;
  }

  function downsampleTo16kHz(float32Array, originalSampleRate) {
    const sampleRateRatio = originalSampleRate / 16000;
    const newLength = Math.round(float32Array.length / sampleRateRatio);
    const result = new Int16Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const sample = float32Array[Math.floor(i * sampleRateRatio)];
      result[i] = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    }

    return result;
  }

  function int16ToBase64(int16Array) {
    const buffer = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < buffer.length; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-4 p-4">
      <h4 className="text-blue-600 font-bold text-2xl mb-4">Realtime Speech-to-Text</h4>
      <div className="mb-4">
        <p>
          Socket Status: {isConnected ? (
          <span className="text-green-500 font-semibold">Connected</span>
        ) : (
          <span className="text-red-500 font-semibold">Disconnected</span>
        )}
        </p>
        <p>
          Session Status: {isSessionActive ? (
          <span className="text-green-500 font-semibold">Active</span>
        ) : (
          <span className="text-gray-500 font-semibold">Inactive</span>
        )}
        </p>
      </div>
      <div className="flex gap-3 mb-6">
        <Button onClick={startSession} disabled={isSessionActive || !isConnected}>
          Start Session
        </Button>
        <Button onClick={() => stopSpeechToTextSession()} disabled={!isSessionActive}>
          Stop Session
        </Button>
      </div>
    </div>
  );
}