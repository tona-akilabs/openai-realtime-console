import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 8080;

const server = http.createServer(app);
const wss = new WebSocketServer({ server }); // WebSocket server for client communication

const openAiWs = new WebSocket('wss://api.gladia.io/audio/text/audio-transcription', {
    headers: {
      'x-gladia-key': `Bearer ${process.env.GLADIA_API_KEY}`,
    }
});

openAiWs.onopen = () => {
 console.log("Connected to OpenAI WebSocket");
};

openAiWs.onclose = () => {
 console.log("OpenAI WebSocket closed");
};

/*wss.on("connection", (clientWs) => {
  console.log("Client connected");

  const openAiWs = new WebSocket('wss://api.gladia.io/audio/text/audio-transcription', {
    headers: {
      'x-gladia-key': `Bearer ${process.env.GLADIA_API_KEY}`,
    }
  });

  openAiWs.onopen = () => {
    console.log("Connected to OpenAI WebSocket");
  };

  clientWs.on("message", (binaryData) => {
    console.info('Json data received');
  });

  openAiWs.onmessage = (event) => {
    // Forward transcript result to browser
    console.log("Received response from OpenAI");
  };

  clientWs.on("close", () => {
    console.log("Client disconnected");
    openAiWs.close();
  });

  openAiWs.onclose = () => {
    console.log("OpenAI WebSocket closed");
  };
});*/

server.listen(port, () => {
  console.log(`Server (Express & Socket.IO) running on http://localhost:${port}`);
});