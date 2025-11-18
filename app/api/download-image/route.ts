import { NextRequest, NextResponse } from "next/server";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json({ error: "filename required" }, { status: 400 });
    }

    const res = await fetch(`${COMFY_BASE}/view?filename=${filename}`);

    if (!res.ok) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const blob = await res.blob();

    return new NextResponse(blob, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "image/png",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("Download error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
