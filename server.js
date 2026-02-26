const http = require("http");
const fs = require("fs");
const path = require("path");

// ─── YOUR GEMINI API KEY ───────────────────────────────────────────────────────
// Load Gemini API key from Render environment variable
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Safety check
if (!GEMINI_API_KEY) {
  console.error("❌ Gemini API key missing. Check Render environment variables.");
}
// ──────────────────────────────────────────────────────────────────────────────

const PORT = 3000;

const MIME = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".json": "application/json",
};

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // ── Gemini API proxy ──────────────────────────────────────────────────────
  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", async () => {
      try {
        const { system, messages } = JSON.parse(body);

        const contents = messages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        }));

        const geminiPayload = {
          system_instruction: { parts: [{ text: system }] },
          contents: contents,
          generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
        };

        // gemini-2.5-flash is free and fast
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        console.log("Calling Gemini API...");

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiPayload),
        });

        const data = await response.json();
        console.log("Gemini response:", JSON.stringify(data).slice(0, 400));

        if (data.error) {
          console.error("Gemini API error:", data.error.message);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ content: [{ text: "API Error: " + data.error.message }] }));
          return;
        }

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
          || "Sorry, I could not generate a response.";

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ content: [{ text }] }));

      } catch (err) {
        console.error("Server error:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ content: [{ text: "Server error: " + err.message }] }));
      }
    });
    return;
  }

  // ── Serve static files ────────────────────────────────────────────────────
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(__dirname, "public", filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n✅ MedCheck server running with Gemini (Free)!`);
  console.log(`👉 Open your browser and go to: http://localhost:${PORT}\n`);
});
