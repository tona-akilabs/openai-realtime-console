import { useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";
import Button from "./Button";

export default function Recorder() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [transcripts, setTranscripts] = useState([]);

  const socketRef = useRef(null); // Use a ref for the socket instance
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io('http://localhost:8080');
    const currentSocket = socketRef.current; // Local variable for cleanup

    const handleConnect = () => {
      console.info('Socket connected');
      setIsConnected(true);
    };
    const handleDisconnect = () => {
      console.warn('Socket disconnected');
      setIsConnected(false);
      // If session was active and socket disconnects, stop it
      if (isSessionActive) {
        stopSpeechToTextSession(false); // Pass false to avoid clearing transcripts if desired
      }
    }
    const handleConnectError = (err) => {
      console.warn('Socket connect error:', err);
      setIsConnected(false);
    }

    // Listen for transcripts from the server
    const handleTranscript = (transcriptData) => {
      console.log("Received transcript:", transcriptData);
      // Assuming transcriptData is a string or an object like { text: "..." }
      const newTranscript = typeof transcriptData === 'object' ? transcriptData.text : transcriptData;
      if (newTranscript) {
        setTranscripts((prevTranscripts) => [...prevTranscripts, newTranscript]);
      }
    };

    currentSocket.on('connect', handleConnect);
    currentSocket.on('disconnect', handleDisconnect);
    currentSocket.on('connect_error', handleConnectError);
    currentSocket.on('transcript', handleTranscript);

    // Cleanup function: This will be called when the component unmounts
    return () => {
      currentSocket.off('connect', handleConnect);
      currentSocket.off('connect_error', handleConnectError);
      currentSocket.off('disconnect', handleDisconnect);
      currentSocket.off('transcript', handleTranscript);
      if (currentSocket.connected) {
        currentSocket.disconnect();
      }
      // Clean up media resources if component unmounts during an active session
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isSessionActive])

  async function startSpeechToTextSession() {
    if (!isConnected || !socketRef.current) {
      console.error("Socket not connected. Cannot start session.");
      return;
    }
    if (isSessionActive) {
      console.warn("Session is already active.");
      return;
    }

    console.info('Starting speech-to-text session...');
    setTranscripts([]); // Clear previous transcripts

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Optional: Specify MIME type if your server expects a particular format
      const options = { mimeType: 'audio/webm;codecs=opus' }; // Example
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn(`${options.mimeType} is not supported. Using default.`);
        delete options.mimeType;
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        console.info('Data available')
        console.info('connected: ', socketRef.current.connected)
        console.info('isConnected: ', isConnected)
        console.info('isSessionActive: ', isSessionActive)
        console.info('event.data.size: ', event.data.size)
        /*if (event.data.size > 0 && socketRef.current && isConnected) {
          // socket.send() sends a 'message' event on the server.
          // If your server expects ArrayBuffer:
          const arrayBuffer = await event.data.arrayBuffer();
          socketRef.current.send(arrayBuffer);
          // Or, if your server expects a custom event with the Blob:
          // socketRef.current.emit('audio_chunk', event.data);
          console.log("Sent audio chunk");
        } else if (socketRef.current && !socketRef.current.connected) {
          console.warn("Socket not connected, audio chunk not sent.");
        }*/
        if (event.data.size > 0) {
          // Directly check the socket's connection status from the ref
          if (socketRef.current && isConnected) {
            try {
              const arrayBuffer = await event.data.arrayBuffer();
              socketRef.current.send(arrayBuffer);
              console.log("Sent audio chunk to server.");
            } catch (error) {
              console.error("Error processing or sending audio chunk:", error);
            }
          } else {
            console.warn("Socket not connected or not available. Audio chunk not sent.");
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
        alert(`MediaRecorder error: ${errorEvent.error.name}`);
        stopSpeechToTextSession(); // Stop session on recorder error
      };

      mediaRecorder.start(1000); // Send chunks every 1000ms (1 second)
    } catch (err) {
      console.error('Error starting speech-to-text session:', err);
      alert(`Could not start audio recording: ${err.message}. Check microphone permissions.`);
      setIsSessionActive(false); // Ensure session is marked as inactive
    }
  }

  function stopSpeechToTextSession(clearOldTranscripts = true) {
    console.info('Stopping speech-to-text session...');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsSessionActive(false);
    if (clearOldTranscripts) {
      setTranscripts([]);
    }
  }

  // UI Rendering (simplified for focus on recording logic)
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
        <Button onClick={startSpeechToTextSession} disabled={isSessionActive || !isConnected}>
          Start Session
        </Button>
        <Button onClick={() => stopSpeechToTextSession()} disabled={!isSessionActive}>
          Stop Session
        </Button>
      </div>

      { (isSessionActive || transcripts.length > 0) && (
        <div className="w-full max-w-md p-4 border rounded bg-gray-50">
          <h5 className="text-lg font-semibold mb-2">Transcript:</h5>
          {transcripts.length === 0 && isSessionActive && <p className="text-gray-500">Listening...</p>}
          <ul className="list-disc list-inside space-y-1">
            {transcripts.map((text, index) => (
              <li key={index} className="text-gray-700">{text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}