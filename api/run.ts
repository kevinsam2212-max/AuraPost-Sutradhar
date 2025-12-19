import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: Request) {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response("Missing GEMINI_API_KEY in environment variables", {
        status: 500,
      });
    }

    const bodyText = await req.text();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(bodyText);
    const text = result.response.text();

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return new Response(`Server error: ${err?.message || "Unknown error"}`, {
      status: 500,
    });
  }
}
