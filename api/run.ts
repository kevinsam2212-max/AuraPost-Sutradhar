export const config = { runtime: "edge" };

import { GoogleGenAI } from "@google/genai";

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Missing GEMINI_API_KEY in Vercel env vars" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.json().catch(() => ({} as any));
  const prompt = body?.prompt ?? body?.text ?? "";

  if (typeof prompt !== "string" || !prompt.trim()) {
    return new Response(JSON.stringify({ error: "Send { prompt: string }" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);

  return new Response(result.response.text(), {
    headers: { "Content-Type": "application/json" },
  });
}
