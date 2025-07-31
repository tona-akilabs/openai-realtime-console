import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import cors from "cors";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import { printMessage } from "./helpers.js";

const app = express();
const port = process.env.PORT || 8080;
const apiKey = process.env.GLADIA_API_KEY;
console.info('api key: ', apiKey);

// Enable CORS
app.use(cors()); // Optional if you serve API routes too

// Resolve __dirname for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure Vite middleware for React client
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
});
app.use(vite.middlewares);

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, "public")));


const server = http.createServer(app);
const wss = new WebSocketServer({ server }); // WebSocket server for client communication

// Render the React client
app.use("*", async (req, res, next) => {
  const url = req.originalUrl;

  try {
    const template = await vite.transformIndexHtml(
      url,
      fs.readFileSync("./client/index.html", "utf-8"),
    );
    const { render } = await vite.ssrLoadModule("./client/entry-server.jsx");
    const appHtml = await render(url);
    const html = template.replace(`<!--ssr-outlet-->`, appHtml?.html);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  } catch (e) {
    vite.ssrFixStacktrace(e);
    next(e);
  }
});

async function initLiveSession() {
  const response = await fetch('https://api.gladia.io/v2/live', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Gladia-Key': apiKey,
    },
    body: JSON.stringify({
      encoding: 'wav/pcm',
      sample_rate: 16000,
      bit_depth: 16,
      channels: 1,
    }),
  });
  if (!response.ok) {
    // Look at the error message
    // It might be a configuration issue
    console.error(`${response.status}: ${(await response.text()) || response.statusText}`);
    process.exit(response.status);
  }

  const data = await response.json();
  console.info('data: ', data);
  return data;
}

const initWebSocket = (url, onOpen) => {
  const socket = new WebSocket(url);

  // Send the merged audio over a single WebSocket
  socket.addEventListener("open", function() {
    // console.info('Connection to gladia success');
    onOpen();
  });

  socket.addEventListener("close", function({code, reason}) {
    console.error('connectGladiaWs@Closed: ', code, reason);
    if (code === 1000) {
      process.exit(0);
    } else {
      console.error(`Connection closed with code ${code} and reason ${reason}`);
      // process.exit(1);
    }
  });

  socket.addEventListener("error", function(error) {
    console.error('ERROR');
    console.error(error);
    // process.exit(1);
  });

  socket.addEventListener("message", function(event) {
    // console.info('response transcript real time');
    // All the messages we are sending are in JSON format
    const message = JSON.parse(event.data.toString());
    console.log(message);
    printMessage(message);
  });

  return socket;
}

let gladiaWs = null;
wss.on("connection", async (clientWs) => {
  console.log("Client connected");

  const session = await initLiveSession();
    if(session) {
        console.error('request session success: ', session);
        console.info('session@url: ', session.url);
        gladiaWs = initWebSocket(session.url, () => {
          console.info('Connection to Gladia success');
        });
    }

  clientWs.on("message", (audioChunk) => {
    // console.info('gladiaWs.readyState: ', gladiaWs.readyState);
    if(gladiaWs && gladiaWs.readyState === WebSocket.OPEN) {
        // console.info('send to gladia server: ', audioChunk);
        gladiaWs.send(audioChunk);
    }
  });
  clientWs.on("close", () => {
    console.log("Client disconnected");
  });
});

server.listen(port, () => {
  console.log(`Server (Express & Socket.IO) running on http://localhost:${port}`);
});