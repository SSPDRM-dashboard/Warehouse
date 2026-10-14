import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { items, balances, transactions } = req.body || {};

    if (!items || !balances) {
      return res.status(400).json({ error: "Missing items or balances data" });
    }

    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not configured on Vercel" });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

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
    } catch {
      data = { rawText: text };
    }

    return res.status(200).json({ success: true, analysis: data });
  } catch (error: any) {
    console.error("AI Forecast error on Vercel:", error);
    return res.status(500).json({ error: error.message || "Failed to generate AI inventory forecast" });
  }
}
