import { NextRequest, NextResponse } from "next/server";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File;
    const maskFile = formData.get("mask") as File;
    const prompt = formData.get("prompt") as string;

    if (!imageFile || !maskFile || !prompt) {
      return NextResponse.json(
        { error: "Image, mask, and prompt are required" },
        { status: 400 }
      );
    }

    // Upload image to ComfyUI
    const imageForm = new FormData();
    imageForm.append("image", imageFile);
    const imageUploadRes = await fetch(`${COMFY_BASE}/upload/image`, {
      method: "POST",
      body: imageForm,
    });
    const imageUploadData = await imageUploadRes.json();
    const imageName = imageUploadData.name;

    // Upload mask to ComfyUI
    const maskForm = new FormData();
    maskForm.append("image", maskFile);
    const maskUploadRes = await fetch(`${COMFY_BASE}/upload/image`, {
      method: "POST",
      body: maskForm,
    });
    const maskUploadData = await maskUploadRes.json();
    const maskName = maskUploadData.name;

    console.log("📤 Uploaded to ComfyUI:", { image: imageName, mask: maskName });

    // Simple and working inpainting workflow
    const workflow = {
      "1": {
        class_type: "LoadImage",
        inputs: {
          image: imageName,
        },
      },
      "2": {
        class_type: "LoadImage",
        inputs: {
          image: maskName,
        },
      },
      "3": {
        class_type: "CheckpointLoaderSimple",
        inputs: {
          ckpt_name: "juggerxlInpaint_juggerInpaintV8.safetensors",
        },
      },
      "4": {
        class_type: "CLIPTextEncode",
        inputs: {
          text: prompt,
          clip: ["3", 1],
        },
      },
      "5": {
        class_type: "CLIPTextEncode",
        inputs: {
          text: "blurry, low quality, distorted, deformed",
          clip: ["3", 1],
        },
      },
      "6": {
        class_type: "VAEEncode",
        inputs: {
          pixels: ["1", 0],
          vae: ["3", 2],
        },
      },
      "7": {
        class_type: "SetLatentNoiseMask",
        inputs: {
          samples: ["6", 0],
          mask: ["2", 1],
        },
      },
      "8": {
        class_type: "KSampler",
        inputs: {
          seed: Math.floor(Math.random() * 1000000000),
          steps: 30,
          cfg: 7.5,
          sampler_name: "dpmpp_2m",
          scheduler: "karras",
          denoise: 0.95,
          model: ["3", 0],
          positive: ["4", 0],
          negative: ["5", 0],
          latent_image: ["7", 0],
        },
      },
      "9": {
        class_type: "VAEDecode",
        inputs: {
          samples: ["8", 0],
          vae: ["3", 2],
        },
      },
      "10": {
        class_type: "SaveImage",
        inputs: {
          filename_prefix: "inpaint",
          images: ["9", 0],
        },
      },
    };

    console.log("🎨 Sending inpainting workflow to ComfyUI");

    const promptRes = await fetch(`${COMFY_BASE}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });

    const responseText = await promptRes.text();
    console.log("📡 ComfyUI response:", responseText);

    if (!promptRes.ok) {
      console.error("❌ ComfyUI rejected workflow:", responseText);
      return NextResponse.json(
        { error: "ComfyUI error", details: responseText },
        { status: 500 }
      );
    }

    const promptData = JSON.parse(responseText);
    const promptId = promptData.prompt_id;

    if (!promptId) {
      console.error("❌ No prompt_id received:", promptData);
      return NextResponse.json({ error: "No prompt_id from ComfyUI" }, { status: 500 });
    }

    console.log("✅ Inpainting workflow started, prompt_id:", promptId);

    return NextResponse.json({ prompt_id: promptId });
  } catch (err: any) {
    console.error("Inpainting error:", err);
    return NextResponse.json(
      { error: "Inpainting failed", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
