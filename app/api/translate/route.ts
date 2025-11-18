import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    // ChatGPT 4o-mini for translation
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a translator. Translate Turkish to English and optimize for AI image generation. Output only the optimized English prompt, nothing else."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    const data = await response.json();
    const translated = data.choices[0]?.message?.content || prompt;

    return NextResponse.json({ translated }, { status: 200 });
  } catch (err: any) {
    console.error("Translation error:", err);
    return NextResponse.json({ translated: prompt }, { status: 200 }); // Fallback
  }
}
