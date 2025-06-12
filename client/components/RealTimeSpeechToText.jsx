import { useEffect, useRef, useState } from "react";
import Button from "./Button.jsx";

export default function RealTimeSpeechToText() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const peerConnection = useRef(null);
  const [dataChannel, setDataChannel] = useState(null);
  const audioElement = useRef(null);

  async function startSpeechToTextSession() {
    console.info('Starting speech-to-text session...');
    const tokenResponse = await fetch("/token");
    const { client_secret: { value: EPHEMERAL_KEY } } = await tokenResponse.json();

    // Create a peer connection
    const pc = new RTCPeerConnection();

    // Set up audio playback for remote audio
    audioElement.current = document.createElement("audio");
    audioElement.current.autoplay = true;

    // Capture microphone input
    const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    pc.addTrack(mediaStream.getAudioTracks()[0], mediaStream);
    console.info('Microphone input added to peer connection');
    console.info(pc)

    // Set up data channel for sending and receiving events
    const dc = pc.createDataChannel("transcripts");
    setDataChannel(dc);
    console.log("Data channel created:", dc.label);

    // Create an SDP offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    // const answer = await pc.createAnswer();
    // await pc.setLocalDescription(answer);

    // Send the SDP offer to GPT-4o streaming API
    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    const answer = {
      type: "answer", // answer | offer
      sdp: await sdpResponse.text(),
    };
    await pc.setRemoteDescription(answer);

    // Handle incoming audio transcripts
    /*dataChannel.addEventListener("message", (event) => {
      const { type, transcript } = JSON.parse(event.data);
      if (type === "response.audio_transcript.partial") {
        console.log("Partial transcript:", transcript);
      } else if (type === "response.audio_transcript.done") {
        console.log("transcript:", transcript);
        // setTranscripts((prev) => [transcript, ...prev]);
      }
    });*/

    peerConnection.current = pc;
  }

  function stopSpeechToTextSession() {
    console.info('Stopping speech-to-text session...');
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setIsSessionActive(false);
    setTranscripts([]);
  }

  useEffect(() => {
    if (dataChannel) {
      dataChannel.addEventListener("open", () => {
        console.log("Data channel is open");
        setIsSessionActive(true);
        setTranscripts([]);
      });

      dataChannel.addEventListener("message", (e) => {
        console.log("Data channel is message");
        const event = JSON.parse(e.data);
        console.info("Received event:", event);
        const { type, transcript } = event
        // console.info('type: ', type)
        if (type === "response.audio_transcript.done") {
          console.info('transcript: ', transcript);
          setTranscripts((prev) => [transcript, ...prev]);
        }
      });
    }
  }, [dataChannel, setTranscripts]);

  const generateTranscript = () => {
    if (!peerConnection.current || !isSessionActive) {
      console.error("No active peer connection to generate transcript");
      return null;
    }
    return (
      <div className="flex items-center justify-center w-full h-full gap-4">
        <ul>
          {transcripts?.map((text, index) => (
            <li key={index}>{text}</li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-center w-full h-full gap-4">
        {isSessionActive ? (
          <div className="text-green-500">Session is active</div>
        ) : (
          <div className="text-red-500">Session is stopped</div>
        )}
        <Button onClick={startSpeechToTextSession}>Start Session</Button>
        <Button onClick={stopSpeechToTextSession}>Stop Session</Button>
      </div>
      {generateTranscript()}
    </>
  )
}
