import {useEffect, useRef, useState} from "react";
import Button from "./Button.jsx";

//public/mic-worklet.js
export default function SimpleTranscription() {
  const init = async () => {
    const context = new AudioContext({ sampleRate: 48000 });
    await context.audioWorklet.addModule("mic-worklet.js");

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const micSource = context.createMediaStreamSource(micStream);
    const micNode = new AudioWorkletNode(context, "mic-processor");

    // Create WebSocket before using it
    const ws = new WebSocket("wss://your-server.example.com");

    micNode.port.onmessage = (event) => {
      const floatChunk = event.data;
      const pcm16 = new Int16Array(floatChunk.length);
      for (let i = 0; i < floatChunk.length; i++) {
        pcm16[i] = Math.max(-1, Math.min(1, floatChunk[i])) * 32767;
      }

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(pcm16.buffer);
      }
    };

    micSource.connect(micNode).connect(context.destination);
  };
  useEffect( () => {
    init();
  }, [])
}