import { NextRequest, NextResponse } from "next/server";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const backgroundImage = String(form.get("backgroundImage") ?? "");
    const positivePrompt = String(form.get("positivePrompt") ?? "high quality");
    const negativePrompt = String(form.get("negativePrompt") ?? "blurry");

    if (!backgroundImage) {
      return NextResponse.json({ error: "Background image required" }, { status: 400 });
    }

    // For now, simple workflow - will expand later
    // This is a placeholder that uses qwen-edit workflow
    const simpleWorkflow = {
      "1": {
        "inputs": { "image": backgroundImage },
        "class_type": "LoadImage"
      },
      "2": {
        "inputs": { "vae_name": "qwen_image_vae.safetensors" },
        "class_type": "VAELoader"
      },
      "3": {
        "inputs": {
          "clip_name": "qwen\\qwen_2.5_vl_7b_fp8_scaled.safetensors",
          "type": "qwen_image",
          "device": "cpu"
        },
        "class_type": "CLIPLoader"
      },
      "4": {
        "inputs": { "gguf_name": "Qwen-Image-Edit-2509-Q5_0.gguf" },
        "class_type": "LoaderGGUF"
      },
      "5": {
        "inputs": { "shift": 3, "model": ["4", 0] },
        "class_type": "ModelSamplingAuraFlow"
      },
      "6": {
        "inputs": { "strength": 1, "model": ["5", 0] },
        "class_type": "CFGNorm"
      },
      "7": {
        "inputs": {
          "lora_name": "Qwen-Image-Lightning-4steps-V1.0-bf16.safetensors",
          "strength_model": 1,
          "model": ["6", 0]
        },
        "class_type": "LoraLoaderModelOnly"
      },
      "8": {
        "inputs": {
          "prompt": positivePrompt,
          "clip": ["3", 0],
          "vae": ["2", 0],
          "image1": ["1", 0]
        },
        "class_type": "TextEncodeQwenImageEditPlus"
      },
      "13": {
        "inputs": { "width": 1280, "height": 736, "batch_size": 1 },
        "class_type": "EmptySD3LatentImage"
      },
      "14": {
        "inputs": {
          "seed": Math.floor(Math.random() * 1000000000),
          "steps": 4,
          "cfg": 1,
          "sampler_name": "euler",
          "scheduler": "simple",
          "denoise": 1,
          "model": ["7", 0],
          "positive": ["8", 0],
          "negative": ["8", 0],
          "latent_image": ["13", 0]
        },
        "class_type": "KSampler"
      },
      "15": {
        "inputs": { "samples": ["14", 0], "vae": ["2", 0] },
        "class_type": "VAEDecode"
      },
      "16": {
        "inputs": { "filename_prefix": "canvas", "images": ["15", 0] },
        "class_type": "SaveImage"
      }
    };

    const res = await fetch(`${COMFY_BASE}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: simpleWorkflow }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: "ComfyUI error", details: text }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ prompt_id: data.prompt_id ?? null }, { status: 200 });
  } catch (err: any) {
    console.error("Canvas edit run error:", err);
    return NextResponse.json(
      { error: "Server error", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
