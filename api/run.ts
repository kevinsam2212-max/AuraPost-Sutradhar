import { GoogleGenAI } from "@google/genai";

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();

  const genAI = new GoogleGenerativeAI(
    process.env.VITE_GEMINI_API_KEY as string
  );

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent(body);

  return new Response(result.response.text(), {
    headers: { "Content-Type": "application/json" }
  });
}
