import {useEffect, useState} from "react";
import Button from "./Button.jsx";

export default function SimpleAudioRecord() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const startRecord = async () => {
    const context = new AudioContext({ sampleRate: 48000 });
    await context.audioWorklet.addModule("mic-worklet.js");

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const micSource = context.createMediaStreamSource(micStream);
    const micNode = new AudioWorkletNode(context, "mic-processor");

    micNode.port.onmessage = (event) => {
      const floatChunk = event.data;
      const pcm16 = new Int16Array(floatChunk.length);
      for (let i = 0; i < floatChunk.length; i++) {
        pcm16[i] = Math.max(-1, Math.min(1, floatChunk[i])) * 32767;
      }

    };

    micSource.connect(micNode).connect(context.destination);
  };
  const stopRecord = () => {
    setIsSessionActive(false);
    console.log("Recording stopped");
  }
  useEffect( () => {
    const checkMicAccess = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsConnected(true);
      } catch (error) {
        console.error("Microphone access denied:", error);
        setIsConnected(false);
      }
    };

    checkMicAccess();
  }, [])

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-4 p-4">
      <h4 className="text-blue-600 font-bold text-2xl mb-4">Realtime Audio Record</h4>
      <div className="mb-4">
        <p>
          Session Status: {isSessionActive ? (
          <span className="text-green-500 font-semibold">Active</span>
        ) : (
          <span className="text-gray-500 font-semibold">Inactive</span>
        )}
        </p>
      </div>
      <div className="flex gap-3 mb-6">
        <Button onClick={startRecord()} disabled={isSessionActive || !isConnected}>
          Start Session
        </Button>
        <Button onClick={() => stopRecord()} disabled={!isSessionActive}>
          Stop Session
        </Button>
      </div>
    </div>
  );
}