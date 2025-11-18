import { NextRequest, NextResponse } from "next/server";
import workflow from "@/workflows/upscale.json";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

type UpscaleWorkflow = Record<string, any>;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const imageName = String(form.get("imageName") ?? "");
    const resolution = Number(form.get("resolution") ?? 4096);
    const seed = Number(form.get("seed") ?? 42);

    if (!imageName) {
      return NextResponse.json(
        { error: "imageName required" },
        { status: 400 }
      );
    }

    console.log("Upscaling image:", imageName, "with resolution:", resolution);

    // Önce görseli output'tan alıp input'a yükle
    const imageRes = await fetch(`${COMFY_BASE}/view?filename=${imageName}&type=output`);
    if (!imageRes.ok) {
      return NextResponse.json(
        { error: "Could not fetch output image" },
        { status: 404 }
      );
    }

    const imageBlob = await imageRes.blob();
    const uploadForm = new FormData();
    uploadForm.append("image", imageBlob, imageName);

    const uploadRes = await fetch(`${COMFY_BASE}/upload/image`, {
      method: "POST",
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      return NextResponse.json(
        { error: "Could not re-upload image" },
        { status: 500 }
      );
    }

    const uploadData = await uploadRes.json();
    const uploadedImageName = uploadData.name;

    console.log("Image re-uploaded as:", uploadedImageName);

    // Workflow'u klonla
    const wf: UpscaleWorkflow = structuredClone(workflow as UpscaleWorkflow);

    // Node 16 - LoadImage (yeni upload edilen dosya adı)
    if (wf["16"]?.inputs) {
      wf["16"].inputs.image = uploadedImageName;
    }

    // Node 10 - Upscaler parametreleri
    if (wf["10"]?.inputs) {
      wf["10"].inputs.resolution = resolution;
      wf["10"].inputs.max_resolution = resolution;
      wf["10"].inputs.seed = seed;
    }

    console.log("Upscale workflow prepared for:", uploadedImageName);

    // ComfyUI'ye gönder
    const body = {
      prompt: wf,
    };

    const res = await fetch(`${COMFY_BASE}/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "ComfyUI error", details: text },
        { status: 500 }
      );
    }

    const data = await res.json();

    return NextResponse.json(
      {
        prompt_id: data.prompt_id ?? data.queue_id ?? null,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Upscale error:", err);
    return NextResponse.json(
      { error: "Server error", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
