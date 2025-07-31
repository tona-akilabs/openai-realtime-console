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

  useEffect(() => {
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
    initRecord()
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

  async function initRecord() {
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
        const rms = calcRMS(event.data);
        console.info('rms: ', rms);
        const hasSound = rms > 0.015 // Adjust threshold
        if(hasSound) {
          console.info('recived data: ', event.data);
          wsRef.current.send(event.data); // Send raw bytes
        }
      };

      mediaStreamSourceRef.current.connect(audioWorkletNodeRef.current);
      // No need to connect worklet to destination if you only process and send
      audioWorkletNodeRef.current.connect(audioContextRef.current.destination);
      console.info('Audio processing session started with AudioWorklet.');
  }
  function startSession() {
    console.info('Attempting to start session...');
    if (isSessionActive) {
      console.warn("Session is already active.");
      return;
    }
    if (!isConnected) {
      console.warn("WebSocket is not connected. Cannot start session.");
      return;
    }
    setIsSessionActive(true);
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
            // const float32Array = decodedAudioData.getChannelData(0); // Get data for the first channel
            // setAudioChunks((prevChunks) => [...prevChunks, new Float32Array(float32Array)]);
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
    /*if (mediaStreamSourceRef.current) {
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
    }*/
    if (wsRef.current && isConnected) {
      /*const combinedChunks = audioChunks.reduce((acc, chunk) => {
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
      wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));*/

      // saveAudioFile();
    }
    setIsSessionActive(false);
  }

  function calcRMS(chunk) {
    let sumSquares = 0
    for (let i = 0; i < chunk.length; i++) sumSquares += chunk[i] ** 2
    return Math.sqrt(sumSquares / chunk.length) // RMS
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
        <Button onClick={startSession()} disabled={isSessionActive || !isConnected}>
          Start Session
        </Button>
        <Button onClick={() => stopSpeechToTextSession()} disabled={!isSessionActive}>
          Stop Session
        </Button>
      </div>
    </div>
  );
}