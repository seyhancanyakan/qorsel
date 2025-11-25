import { NextRequest, NextResponse } from "next/server";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const promptId = searchParams.get("prompt_id");

    if (!promptId) {
      return NextResponse.json({ error: "prompt_id required" }, { status: 400 });
    }

    const historyRes = await fetch(`${COMFY_BASE}/history/${promptId}`);
    const historyData = await historyRes.json();

    if (!historyData[promptId]) {
      return NextResponse.json({
        completed: false,
        status: "pending",
        images: [],
      });
    }

    const status = historyData[promptId].status;
    const outputs = historyData[promptId].outputs;

    // Check if completed
    if (status?.completed || outputs) {
      const images: string[] = [];

      if (outputs) {
        for (const nodeId in outputs) {
          if (outputs[nodeId].images) {
            for (const img of outputs[nodeId].images) {
              images.push(img.filename);
            }
          }
        }
      }

      return NextResponse.json({
        completed: images.length > 0,
        status: status?.status_str || "completed",
        images,
      });
    }

    // Check if error
    if (status?.status_str === "error") {
      return NextResponse.json({
        completed: false,
        status: "error",
        images: [],
        error: status.messages || "Unknown error",
      });
    }

    return NextResponse.json({
      completed: false,
      status: status?.status_str || "pending",
      images: [],
    });
  } catch (err: any) {
    console.error("Status check error:", err);
    return NextResponse.json(
      { error: "Status check failed", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
