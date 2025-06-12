import express from "express";
import OpenAI from "openai";
import { Server } from "socket.io"
import cors from "cors";
import http from "http";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 8080;
// const apiKey = process.env.OPENAI_API_KEY;
// Enable CORS
app.use(cors()); // Optional if you serve API routes too

// Configure Vite middleware for React client
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
});
app.use(vite.middlewares);

const server = http.createServer(app);
// const io = new Server(server);
const io = new Server(server);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

io.on("connection",  (socket) => {
  console.log("Client connected:", socket.id);
  let openaiStream; // To hold the stream for this specific connection
  // Initialize OpenAI stream when client connects and is ready
  // You might want a specific client event to trigger this, e.g., "start_transcription"
  // For simplicity, we'll try to set it up on connection, but a dedicated event is better.

  async function setupOpenAIStream() {
    try {
      console.log("Attempting to setup OpenAI stream...");
      openaiStream = await openai.beta.chat.completions.stream({
        model: "gpt-4o", // Or your preferred model
        stream: true,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Transcribe the user's speech into text. Respond only with the transcription.",
          },
        ],
        // tools: [{ type: "input_audio" }],
        /*tools: [
          {
            type: "function",
            function: {
              name: "input_audio",
              description: "Transcribes the user's speech into text.",
              parameters: {
                type: "object",
                properties: {
                  audio: {
                    type: "string",
                    description: "Audio input to transcribe (base64-encoded or stream).",
                  },
                },
                required: ["audio"],
              },
            },
          },
        ],*/
        tools: [{
          type: "function",
          function: {
            name: "input_audio",
          },
        },],
        tool_choice: { type: "function", function: { name: "input_audio" } },
      });

      openaiStream.on("content", (delta, metadata) => {
        if (metadata?.audio_transcript?.text) {
          // Send the transcript back to this specific client
          socket.emit("transcript", {
            text: metadata.audio_transcript.text,
            isPartial: metadata.audio_transcript.type === "partial", // Check API for exact field
          });
          console.log("Sent transcript:", metadata.audio_transcript.text);
        }
      });

      openaiStream.on("error", (err) => {
        console.error("OpenAI Stream Error:", err);
        socket.emit("transcription_error", { message: "OpenAI stream error." });
        // Clean up the stream
        if (openaiStream) {
          openaiStream.controller?.abort(); // Or appropriate method to end stream
          openaiStream = null;
        }
      });

      openaiStream.on("end", () => {
        console.log("OpenAI Stream ended for socket:", socket.id);
        // openaiStream = null;
      });

      console.log("OpenAI stream initialized for socket:", socket.id);
      socket.emit("transcription_ready"); // Inform client that server is ready for audio

    } catch (error) {
      console.error("Failed to setup OpenAI stream:", error);
      socket.emit("transcription_error", { message: "Failed to setup OpenAI stream." });
    }
  }

  // Call setup when client signals readiness or immediately if appropriate
  setupOpenAIStream();
  socket.on("message", (audioChunk) => { // Assuming 'message' event sends audio chunks
    console.log(`Received audio chunk from ${socket.id}, size: ${audioChunk.length}`);
    console.log(openaiStream)
    console.log(openaiStream.audio)
    if (openaiStream && openaiStream.audio) {
      try {
        // Ensure audioChunk is a Buffer if OpenAI SDK expects it
        const buffer = Buffer.isBuffer(audioChunk) ? audioChunk : Buffer.from(audioChunk);
        openaiStream.audio.write(buffer); // Use openaiStream.audio.write()
        console.log(`[Inside]Received audio chunk from ${socket.id}, size: ${buffer.length}`);
      } catch (error) {
        console.error("Error writing to OpenAI stream:", error);
      }
    } else {
      console.warn("OpenAI stream not ready for socket:", socket.id, "Audio chunk ignored.");
      // Optionally, buffer audio or send an error to client
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    if (openaiStream) {
      console.log("Ending OpenAI stream due to disconnect for socket:", socket.id);
      openaiStream.controller?.abort(); // Or appropriate method to end stream
      openaiStream = null;
    }
  });

  socket.on("error", (err) => {
    console.error(`Socket error for ${socket.id}:`, err);
    // Clean up resources if necessary
    if (openaiStream) {
      openaiStream.controller?.abort();
      openaiStream = null;
    }
  });
});


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