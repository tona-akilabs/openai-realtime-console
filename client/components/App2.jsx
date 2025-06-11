import { useEffect, useRef, useState } from "react";
import logo from "/assets/openai-logomark.svg";
import EventLog from "./EventLog";
import SessionControls from "./SessionControls";
import ToolPanel from "./ToolPanel";

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

export default function App2() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);
  const recognition = useRef(null);

  useEffect(() => {
    if (SpeechRecognition) {
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = true;
      recognition.current.interimResults = false;
      // recognition.current.lang = "en-US";
      // recognition.current.lang = "ja-JP";

      recognition.current.onresult = (event) => {
        console.info(event.results)
        /*const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join("");
        console.log("Transcript:", transcript);*/
        const lastResult = event.results[event.resultIndex];
        const transcript = lastResult[0].transcript;
        console.log("Live Transcript:", transcript);
      };

      recognition.current.onerror = (error) => {
        console.error("Speech recognition error:", error);
      };
    } else {
      console.warn("SpeechRecognition API is not supported in this browser.");
    }
  }, []);

  async function startSession() {
    // Existing startSession logic...
    if (recognition.current) {
      recognition.current.start();
      setIsSessionActive(true)
    }
  }

  function stopSession() {
    // Existing stopSession logic...
    if (recognition.current) {
      recognition.current.stop();
      setIsSessionActive(false)
    }
  }

  function sendClientEvent(message) {
    if (dataChannel) {
      const timestamp = new Date().toLocaleTimeString();
      message.event_id = message.event_id || crypto.randomUUID();

      dataChannel.send(JSON.stringify(message));

      if (!message.timestamp) {
        message.timestamp = timestamp;
      }
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message,
      );
    }
  }
  function sendTextMessage(text) {
    if (dataChannel) {
      const message = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: text,
            },
          ],
        },
      };

      const timestamp = new Date().toLocaleTimeString();
      message.event_id = crypto.randomUUID();
      message.timestamp = timestamp;

      dataChannel.send(JSON.stringify(message));
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error("Failed to send message - no data channel available");
    }
  }

  return (
    <>
      <nav className="absolute top-0 left-0 right-0 h-16 flex items-center">
        <div className="flex items-center gap-4 w-full m-4 pb-2 border-0 border-b border-solid border-gray-200">
          <img style={{ width: "24px" }} src={logo} />
          <h1>realtime console</h1>
        </div>
      </nav>
      <main className="absolute top-16 left-0 right-0 bottom-0">
        <section className="absolute top-0 left-0 right-[380px] bottom-0 flex">
          <section className="absolute top-0 left-0 right-0 bottom-32 px-4 overflow-y-auto">
            <EventLog events={events} />
          </section>
          <section className="absolute h-32 left-0 right-0 bottom-0 p-4">
            <SessionControls
              startSession={startSession}
              stopSession={stopSession}
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              events={events}
              isSessionActive={isSessionActive}
            />
          </section>
        </section>
        <section className="absolute top-0 w-[380px] right-0 bottom-0 p-4 pt-0 overflow-y-auto">
          <ToolPanel
            sendClientEvent={sendClientEvent}
            sendTextMessage={sendTextMessage}
            events={events}
            isSessionActive={isSessionActive}
          />
        </section>
      </main>
    </>
  );
}