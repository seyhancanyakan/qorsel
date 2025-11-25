import { NextRequest, NextResponse } from "next/server";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageName = formData.get("imageName") as string;
    const prompt = formData.get("prompt") as string;

    if (!imageName || !prompt) {
      return NextResponse.json({ error: "imageName and prompt required" }, { status: 400 });
    }

    // FLUX image-to-image editing workflow
    const workflow = {
      "1": {
        class_type: "LoadImage",
        inputs: {
          image: imageName,
        },
      },
      "2": {
        class_type: "UNETLoader",
        inputs: {
          unet_name: "flux1-dev.safetensors",
          weight_dtype: "default",
        },
      },
      "3": {
        class_type: "DualCLIPLoader",
        inputs: {
          clip_name1: "t5xxl_fp8_e4m3fn.safetensors",
          clip_name2: "clip_l.safetensors",
          type: "flux",
        },
      },
      "4": {
        class_type: "VAELoader",
        inputs: {
          vae_name: "ae.safetensors",
        },
      },
      "5": {
        class_type: "CLIPTextEncode",
        inputs: {
          text: prompt,
          clip: ["3", 0],
        },
      },
      "6": {
        class_type: "VAEEncode",
        inputs: {
          pixels: ["1", 0],
          vae: ["4", 0],
        },
      },
      "7": {
        class_type: "KSampler",
        inputs: {
          seed: Math.floor(Math.random() * 1000000000),
          steps: 12,
          cfg: 2.5,
          sampler_name: "euler",
          scheduler: "simple",
          denoise: 0.65,
          model: ["2", 0],
          positive: ["5", 0],
          negative: ["5", 0],
          latent_image: ["6", 0],
        },
      },
      "8": {
        class_type: "VAEDecode",
        inputs: {
          samples: ["7", 0],
          vae: ["4", 0],
        },
      },
      "9": {
        class_type: "SaveImage",
        inputs: {
          filename_prefix: "enhanced",
          images: ["8", 0],
        },
      },
    };

    console.log("🎨 Sending FLUX enhancement workflow to ComfyUI");

    const promptRes = await fetch(`${COMFY_BASE}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!promptRes.ok) {
      const errorText = await promptRes.text();
      console.error("❌ ComfyUI rejected workflow:", errorText);
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

    console.log("✅ Enhancement workflow started, prompt_id:", promptId);

    return NextResponse.json({ prompt_id: promptId });
  } catch (err: any) {
    console.error("Enhancement error:", err);
    return NextResponse.json(
      { error: "Enhancement failed", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
