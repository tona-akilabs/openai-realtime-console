import express from "express";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;

app.get("/languages", async (req, res) => {
  try {
    const text = "Thank you for choosing our product.";
    const targetLanguages = ["French", "German", "Japanese", "Thai"];
    const prompt = `Translate the following sentence into these languages: ${targetLanguages.join(", ")}.\n\nSentence: "${text}"`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      // content: "You are a helpful translation assistant."
      //"content": "You are a translation bot that formats all responses like: translatebot(language): translated text"
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a translation bot that formats all responses like: translatebot(language): translated text" },
          { role: "user", content: prompt },
        ]
      })
    });
    // console.log(response.json());
    const data = await response.json();
    // Get the actual content from the response
    const translatedText = data.choices?.[0]?.message?.content;
    res.json({ translations: translatedText });
  } catch (error) {
    console.error("Translation error:", error);
    res.status(500).json({ error: "Failed to translate text" });
  }
})
app.listen(port, () => {
  console.log(`Express server running on *:${port}`);
});