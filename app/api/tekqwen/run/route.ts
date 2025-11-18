import { NextRequest, NextResponse } from "next/server";
import workflow from "@/workflows/tekqwen.json";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const prompt = String(form.get("prompt") ?? "");
    const steps = Number(form.get("steps") ?? 4);
    const cfg = Number(form.get("cfg") ?? 1);
    const width = Number(form.get("width") ?? 1920);
    const height = Number(form.get("height") ?? 1080);
    const imageName = String(form.get("imageName") ?? "");

    const wf: Record<string, any> = structuredClone(workflow);

    // Node 1 - LoadImage
    if (wf["1"]?.inputs) {
      wf["1"].inputs.image = imageName;
    }

    // Node 9 - Prompt
    if (wf["9"]?.inputs) {
      wf["9"].inputs.prompt = prompt;
    }

    // Parameters
    if (wf["10"]?.inputs) wf["10"].inputs.value = steps;
    if (wf["11"]?.inputs) wf["11"].inputs.value = cfg;
    if (wf["12"]?.inputs) wf["12"].inputs.value = width;
    if (wf["13"]?.inputs) wf["13"].inputs.value = height;

    const res = await fetch(`${COMFY_BASE}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: wf }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: "ComfyUI error", details: text }, { status: 500 });
    }

    const data = await res.json();

    return NextResponse.json({ prompt_id: data.prompt_id ?? null }, { status: 200 });
  } catch (err: any) {
    console.error("TekQwen run error:", err);
    return NextResponse.json({ error: "Server error", details: String(err?.message ?? err) }, { status: 500 });
  }
}
