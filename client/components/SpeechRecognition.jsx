import { useState, useRef } from "react";

export default function SpeechTranscription({ sendTextMessage }) {
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState("");
  const recognitionRef = useRef(null);

  function startListening() {
    if (!("webkitSpeechRecognition" in window)) {
      console.error("SpeechRecognition API not supported in this browser.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setTranscription((prev) => prev + transcript + " ");
          console.info(transcript.trim())
          // sendTextMessage(transcript.trim());
        } else {
          interimTranscript += transcript;
        }
      }
      setTranscription(interimTranscript);
    };

    recognition.onerror = (event) => {
      console.error("SpeechRecognition error:", event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    setIsListening(true);
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }

  return (
    <div>
      <p>Transcription: {transcription}</p>
      <button onClick={isListening ? stopListening : startListening}>
        {isListening ? "Stop Listening" : "Start Listening"}
      </button>
    </div>
  );
}