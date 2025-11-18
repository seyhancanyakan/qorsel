import { NextRequest, NextResponse } from "next/server";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File;

    if (!imageFile) {
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 }
      );
    }

    // ComfyUI'ye yönlendir
    const comfyFormData = new FormData();
    comfyFormData.append("image", imageFile);

    const res = await fetch(`${COMFY_BASE}/upload/image`, {
      method: "POST",
      body: comfyFormData,
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "ComfyUI upload failed", details: text },
        { status: 500 }
      );
    }

    const data = await res.json();

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Server error", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
