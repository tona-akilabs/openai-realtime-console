import {useEffect, useRef, useState} from "react";
import Button from "./Button.jsx";

export default function ConnectionWsRecord() {
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
    // initRecord()
  }, [])

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
        if (event.data instanceof Float32Array && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(floatTo16BitPCM(event.data));
        }
      };

      mediaStreamSourceRef.current.connect(audioWorkletNodeRef.current);
      console.info('Audio processing session started with AudioWorklet.');
  }
  async function startSession() {
    try {
      console.info('Attempting to start session...');
      if (isSessionActive) {
        console.warn("Session is already active.");
        return;
      }
      if (!isConnected) {
        console.warn("WebSocket is not connected. Cannot start session.");
        return;
      }
      await initRecord();
      setIsSessionActive(true);
    } catch (e) {
      setIsSessionActive(false);
    }
  }

  function stopSpeechToTextSession() {
    console.info("Stopping speech-to-text session...");

    // 1️⃣ Disconnect media stream source
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }

    // 2️⃣ Stop AudioWorkletNode
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.port.onmessage = null; // Remove listener
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }

    // 3️⃣ Stop microphone tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // 4️⃣ Suspend or close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.suspend(); // or .close()
    }

    // 5️⃣ Optionally send final commit to server (if needed)
    if (wsRef.current && isConnected) {
      console.info("WebSocket is still open, closing session...");
      // wsRef.current.send(JSON.stringify({ type: "stop_session" }));
    }
    setIsSessionActive(false);
  }

  function downsampleTo16kHz(float32Array, sampleRate) {
    if (sampleRate === 16000) return float32Array;

    const ratio = sampleRate / 16000;
    const newLength = Math.round(float32Array.length / ratio);
    const result = new Float32Array(newLength);

    let offset = 0;
    for (let i = 0; i < newLength; i++) {
      result[i] = float32Array[Math.floor(offset)];
      offset += ratio;
    }
    return result;
  }
  function floatTo16BitPCM(float32Array, sampleRate = 48000) {
    const downsampled = downsampleTo16kHz(float32Array, sampleRate);
    const buffer = new ArrayBuffer(downsampled.length * 2);
    const view = new DataView(buffer);

    let offset = 0;
    for (let i = 0; i < downsampled.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, downsampled[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
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
        <Button onClick={stopSpeechToTextSession} disabled={!isSessionActive}>
          Stop Session
        </Button>
      </div>
    </div>
  );
}