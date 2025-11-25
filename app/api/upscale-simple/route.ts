import { NextRequest, NextResponse } from "next/server";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageName = formData.get("imageName") as string;

    if (!imageName) {
      return NextResponse.json({ error: "imageName required" }, { status: 400 });
    }

    // Simple upscale workflow using RealESRGAN
    const workflow = {
      "1": {
        class_type: "LoadImage",
        inputs: {
          image: imageName,
        },
      },
      "2": {
        class_type: "ImageUpscaleWithModel",
        inputs: {
          upscale_model: ["3", 0],
          image: ["1", 0],
        },
      },
      "3": {
        class_type: "UpscaleModelLoader",
        inputs: {
          model_name: "RealESRGAN_x4plus.pth",
        },
      },
      "4": {
        class_type: "SaveImage",
        inputs: {
          filename_prefix: "upscaled",
          images: ["2", 0],
        },
      },
    };

    console.log("🔍 Sending upscale workflow to ComfyUI for:", imageName);

    const promptRes = await fetch(`${COMFY_BASE}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!promptRes.ok) {
      const errorText = await promptRes.text();
      console.error("❌ ComfyUI rejected upscale workflow:", errorText);
      return NextResponse.json(
        { error: "ComfyUI error", details: errorText },
        { status: 500 }
      );
    }

    const promptData = await promptRes.json();
    const promptId = promptData.prompt_id;

    if (!promptId) {
      console.error("❌ No prompt_id received:", promptData);
      return NextResponse.json({ error: "No prompt_id from ComfyUI" }, { status: 500 });
    }

    console.log("✅ Upscale workflow started, prompt_id:", promptId);

    return NextResponse.json({ prompt_id: promptId });
  } catch (err: any) {
    console.error("Upscale error:", err);
    return NextResponse.json(
      { error: "Upscale failed", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
