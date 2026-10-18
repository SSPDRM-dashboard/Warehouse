import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize Gemini AI client for server-side use
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // API endpoint for AI stock forecasting & inventory intelligence
  app.post("/api/ai-forecast", async (req, res) => {
    try {
      const { items, balances, transactions } = req.body;

      if (!items || !balances) {
        return res.status(400).json({ error: "Missing items or balances data" });
      }

      const prompt = `You are an expert AI Supply Chain & Warehouse Logistics Consultant for Warehouse OS.
Analyze the following warehouse inventory data and provide strategic insights:
- Items: ${JSON.stringify(items)}
- Balances: ${JSON.stringify(balances)}
- Recent Transactions: ${JSON.stringify((transactions || []).slice(0, 10))}

Please provide a JSON response with:
1. "riskSummary": A concise paragraph assessing current stock health, turnover rate, and potential stockout bottlenecks.
2. "criticalAlerts": An array of objects { code, reason, recommendedAction } for items at or near minimum stock levels.
3. "optimizationTips": An array of 3 professional warehouse management tips (e.g. slotting optimization, safety stock adjustments, supplier lead time buffering).
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction: "You are a professional warehouse inventory intelligence engine. Always respond in valid JSON format matching the requested structure.",
        },
      });

      const text = response.text || "{}";
      let data;
      try {
        data = JSON.parse(text);
        if (data && Array.isArray(data.optimizationTips)) {
          data.optimizationTips = data.optimizationTips.map((item: any) => {
            if (typeof item === "string") return item;
            if (typeof item === "object" && item !== null) {
              return item.tip || item.description || item.text || JSON.stringify(item);
            }
            return String(item);
          });
        }
      } catch (err) {
        data = { rawText: text };
      }

      res.json({ success: true, analysis: data });
    } catch (error: any) {
      console.error("AI Forecast error:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI inventory forecast" });
    }
  });

  // Vite middleware for frontend development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Warehouse OS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
