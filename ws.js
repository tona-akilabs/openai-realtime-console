import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import cors from "cors";
import http from "http";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 8080;
// const apiKey = process.env.OPENAI_API_KEY

// Enable CORS
app.use(cors()); // Optional if you serve API routes too

const server = http.createServer(app);
const wss = new WebSocketServer({ server }); // WebSocket server for client communication

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

  let totalAudioLength = 0;
  let audioChunks = [];
  clientWs.on("message", (binaryData) => {
    // console.info(typeof data);
    /*totalAudioLength += data.length;
    console.info(data.length);
    console.info(data.byteLength);
    openAiWs.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: arrayBufferToBase64(data),
    }));*/

    // Only commit after we've collected at least 3200 bytes
    /*if (totalAudioLength >= 6400) {
      openAiWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      // Reset after commit
      totalAudioLength = 0;
    }*/
    // console.info(data.byteLength);
    // openAiWs.send(data);
    /*if (Buffer.isBuffer(binaryData)) {
      audioChunks.push(binaryData);
      // Combine if large enough
      const totalLength = audioChunks.reduce((acc, buf) => acc + buf.length, 0);
      if (totalLength >= 3200) { // ≈100ms of 16kHz Int16 audio
        const combined = Buffer.concat(audioChunks);
        audioChunks = [];
        // Forward to OpenAI:
        openAiWs.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: binaryToBase64(combined),
        }));
        openAiWs.send(JSON.stringify({
          type: 'input_audio_buffer.commit',
        }));
      }
    }*/
    /*openAiWs.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: binaryToBase64(binaryData),
    }));
    openAiWs.send(JSON.stringify({
      type: 'input_audio_buffer.commit',
    }));*/
    /*const base64Audio = binaryToBase64(binaryData);
    openAiWs.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: base64Audio,
    }));
    setTimeout(() => {
      openAiWs.send(JSON.stringify({
        type: 'input_audio_buffer.commit',
      }));
    }, 3000)*/
    if (isJson(binaryData)) {
      //console.info('Json data received');
      const jsonData = JSON.parse(binaryData.toString());
      openAiWs.send(JSON.stringify(jsonData))
    } else {
      //console.info('Binary data received');
      openAiWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: binaryToBase64(binaryData),
      }));
    }
  });

  openAiWs.onmessage = (event) => {
    // Forward transcript result to browser
    console.log("Received response from OpenAI");
    // console.info(event.data);
    // Forward OpenAI response back to client
    // clientWs.send(event.data);
    const msg = JSON.parse(event.data);

    if (msg.type === 'audio_transcript.done') {
      console.log("🔊 User transcript:", msg.transcript);
      clientWs.send(JSON.stringify({ type: 'user.transcript', transcript: msg.transcript }));
    } else if (msg.type === 'response.output_item.done') {
      const response = msg.item?.content?.[0]?.transcript;
      console.log("🤖 GPT response:", response);
      // clientWs.send(JSON.stringify({ type: 'assistant.response', transcript: response }));
    } else {
      console.log("🟡 Other message:", msg.type);
      clientWs.send(event.data); // Optional: forward all
    }
  };

  clientWs.on("close", () => {
    console.log("Client disconnected");
    openAiWs.close();
  });

  openAiWs.onclose = () => {
    console.log("OpenAI WebSocket closed");
  };
});
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
  // return Buffer.from(buffer).toString('base64');
}
function binaryToBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}
function isJson(data) {
  let isJson = false;
  let jsonData;

  try {
    // Attempt to parse the binaryData as JSON.
    // WebSocket messages can be strings or binary (Buffer, ArrayBuffer, Blob).
    // If it's binary, toString() is needed. If it's already a string, toString() is harmless.
    jsonData = JSON.parse(data.toString());
    isJson = true;
  } catch (e) {
    // If parsing fails, it's not JSON, so treat it as binary audio data.
    isJson = false;
  }
  return isJson
}
// Configure Vite middleware for React client
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
});
app.use(vite.middlewares);

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

server.listen(port, () => {
  console.log(`Server (Express & Socket.IO) running on http://localhost:${port}`);
});