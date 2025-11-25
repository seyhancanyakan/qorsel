import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    // Professional prompt engineering system message
    const systemPrompt = `You are an expert AI image generation prompt engineer.

Translate Turkish to English and optimize following these rules:

1. Scene Definition: Define "who, where, what" clearly
2. Aesthetic & Style: Specify photographic/cinematic/artistic style, lighting, tone, texture
3. Camera & Composition: Specify angle (low-angle, eye-level), lens (24mm, 85mm), framing (close-up, full body)
4. Fine Details: Describe textures, light refraction, ambient details
5. Color & Mood: Specify color palette and atmosphere
6. Quality Tags: Add "high detail, masterpiece, ultra high resolution, sharp focus, professional"

Output format:
POSITIVE: [optimized positive prompt]
NEGATIVE: [suggested negative prompt like "blurry, distorted, low quality, artifacts"]

Example:
Input: "kırmızı gözlüklü kadın"
Output:
POSITIVE: A woman wearing stylish red aviator sunglasses, eye-level shot, 50mm portrait lens, natural lighting, high detail, sharp focus, professional photography
NEGATIVE: blurry, distorted face, extra fingers, low quality, artifacts, watermark`;

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
            content: systemPrompt
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    const result = data.choices[0]?.message?.content || prompt;

    // Parse POSITIVE and NEGATIVE from result
    let translated = result;
    let negative = "blurry, low quality, distorted, artifacts";

    if (result.includes("POSITIVE:") && result.includes("NEGATIVE:")) {
      const posMatch = result.match(/POSITIVE:\s*(.+?)(?=NEGATIVE:|$)/);
      const negMatch = result.match(/NEGATIVE:\s*(.+?)$/);

      if (posMatch) translated = posMatch[1].trim();
      if (negMatch) negative = negMatch[1].trim();
    }

    return NextResponse.json({
      translated,
      negative,
      original: prompt
    }, { status: 200 });
  } catch (err: any) {
    console.error("Translation error:", err);
    return NextResponse.json({
      translated: prompt,
      negative: "blurry, low quality",
      original: prompt
    }, { status: 200 }); // Fallback
  }
}
