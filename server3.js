import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import cors from "cors";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import wav from "wav";

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

const requestSession = async () => {
    try {
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
    } catch(e) {
        console.error('Err: ', e);
        process.exit(0);
    }
    return null;
}

const connectGladiaWs = (url) => {
    const socket = new WebSocket(url);

  // Send the merged audio over a single WebSocket
  socket.addEventListener("open", function() {
    console.info('Connection to gladia success');
  });

  socket.addEventListener("close", function({code, reason}) {
    // The connection has been closed
    // If the "code" is equal to 1000, it means we closed intentionally the connection (after the end of the session for example).
    // Otherwise, you can reconnect to the same url.
    console.error('connectGladiaWs@Closed: ', code, reason);
  });

  socket.addEventListener("error", function(error) {
    // An error occurred during the connection.
    // Check the error to understand why
    console.error('connectGladiaWs@Error: ', error);
  });

  socket.addEventListener("message", function(event) {
    console.info('response transcrip from gladia');
    // All the messages we are sending are in JSON format
    const message = JSON.parse(event.data.toString());
    console.log(message);
  });

  return socket;
}

let gladiaWs = null;

const fileWriter = new wav.FileWriter("recorded_audio.wav", {
  channels: 1,       // Mono
  sampleRate: 16000, // Match your mic sample rate
  bitDepth: 16,
});

wss.on("connection", async (clientWs) => {
  console.log("Client connected");

  /*const session = await requestSession();
    if(session) {
        console.error('request session success: ', session);
        console.info('session@url: ', session.url);
        gladiaWs = connectGladiaWs(session.url);
    } */

  clientWs.on("message", (audioChunk) => {
    // console.log(data);
    /*console.info('gladiaWs.readyState: ', gladiaWs.readyState);
    if(gladiaWs && gladiaWs.readyState === WebSocket.OPEN) {
        console.info('send to gladia server: ', data);
        gladiaWs.send(data);
    }*/
    console.info('recived audio chunk:', data);
    fileWriter.write(audioChunk);
  });
  clientWs.on("close", () => {
    console.log("Client disconnected");
  });
});


server.listen(port, () => {
  console.log(`Server (Express & Socket.IO) running on http://localhost:${port}`);
});