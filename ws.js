import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import cors from "cors";
import http from "http";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 8080;
// const apiKey = process.env.OPENAI_API_KEY

// Enable CORS
app.use(cors()); // Optional if you serve API routes too

const server = http.createServer(app);
const wss = new WebSocketServer({ server }); // WebSocket server for client communication

/*(() => {
  console.info('execute ws')
  const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1',
    }
  });

  /!*ws.onopen = () => {
    console.log("WebSocket connection opened");
    // Example: ws.send(JSON.stringify({ action: "subscribe", topic: "some_topic" }));
  };

  ws.onmessage = (event) => {
    console.log("WebSocket message received:", event.data);
    // Process incoming messages, e.g., parse JSON
    // const message = JSON.parse(event.data);
    // handleYourMessageLogic(message);
  };*!/
})()*/
wss.on("connection", (clientWs) => {
  console.log("Client connected");

  const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1',
    }
  });

  openAiWs.onopen = () => {
    console.log("Connected to OpenAI WebSocket");
  };

  clientWs.on("message", (data) => {
    console.log("Received audio chunk from client");
    // Forward audio chunk to OpenAI
    openAiWs.send(JSON.stringify({
      action: "stream_audio",
      audio: data.toString("base64"), // Convert binary data to base64
    }));
  });

  openAiWs.onmessage = (event) => {
    console.log("Received response from OpenAI");
    // Forward OpenAI response back to client
    clientWs.send(event.data);
  };

  clientWs.on("close", () => {
    console.log("Client disconnected");
    openAiWs.close();
  });

  openAiWs.onclose = () => {
    console.log("OpenAI WebSocket closed");
  };
});

server.listen(port, () => {
  console.log(`Server (Express & Socket.IO) running on http://localhost:${port}`);
});