import { NextRequest, NextResponse } from "next/server";
import workflow from "@/workflows/virtual-tryon.json";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const personImage = String(form.get("personImage") ?? "");
    const clothingImage = String(form.get("clothingImage") ?? "");
    const poseImage = String(form.get("poseImage") ?? "");
    const extractPrompt = String(form.get("extractPrompt") ?? "extract the full body and the full outfit from front and from back onto a white background.");
    const transferPrompt = String(form.get("transferPrompt") ?? "Transfer the outfit.");

    if (!personImage || !clothingImage) {
      return NextResponse.json(
        { error: "Missing required images" },
        { status: 400 }
      );
    }

    const wf: Record<string, any> = structuredClone(workflow);

    // Set person image (node 39)
    if (wf["39"]?.inputs) {
      wf["39"].inputs.image = personImage;
    }

    // Set clothing image (node 104)
    if (wf["104"]?.inputs) {
      wf["104"].inputs.image = clothingImage;
    }

    // Set pose image (node 130) - if provided, otherwise we need to handle this
    if (wf["130"]?.inputs) {
      if (poseImage) {
        wf["130"].inputs.image = poseImage;
      } else {
        // If no pose image, we'll use the person image
        wf["130"].inputs.image = personImage;
      }
    }

    // Set extract prompt (node 128)
    if (wf["128"]?.inputs) {
      wf["128"].inputs.prompt = extractPrompt;
    }

    // Set transfer prompt (node 135)
    if (wf["135"]?.inputs) {
      wf["135"].inputs.prompt = transferPrompt;
    }

    // Send workflow to ComfyUI
    const res = await fetch(`${COMFY_BASE}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: wf }),
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
      { prompt_id: data.prompt_id ?? null },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Virtual Try-On run error:", err);
    return NextResponse.json(
      { error: "Server error", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
