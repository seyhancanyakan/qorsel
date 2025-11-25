import { NextRequest, NextResponse } from "next/server";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const promptId = searchParams.get("prompt_id");

    if (!promptId) {
      return NextResponse.json({ error: "prompt_id required" }, { status: 400 });
    }

    const res = await fetch(`${COMFY_BASE}/history/${promptId}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });

    if (!res.ok) {
      return NextResponse.json({ error: "ComfyUI history query failed" }, { status: 500 });
    }

    const data = await res.json();

    if (data[promptId]) {
      const historyItem = data[promptId];
      const status = historyItem.status;
      const outputs = historyItem.outputs || {};

      const images: string[] = [];
      for (const nodeId in outputs) {
        const nodeOutput = outputs[nodeId];
        if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
          nodeOutput.images.forEach((img: any) => {
            if (img.filename) {
              images.push(img.filename);
            }
          });
        }
      }

      // Auto-save to Supabase if completed
      if (status?.completed && images.length > 0) {
        console.log("🎨 CANVAS EDIT COMPLETE - Saving to Supabase...");
        try {
          const { createClient } = await import("@/lib/supabase/server");
          const supabase = await createClient();
          const { data: { user } } = await supabase.auth.getUser();

          if (user) {
            for (const imgFilename of images) {
              try {
                const imgRes = await fetch(`${COMFY_BASE}/view?filename=${imgFilename}`);
                const imgBlob = await imgRes.blob();

                const storagePath = `${user.id}/${promptId}/${imgFilename}`;
                const { error: uploadError } = await supabase.storage
                  .from("user-images")
                  .upload(storagePath, imgBlob, { upsert: true });

                if (!uploadError) {
                  await supabase.from("images").insert({
                    user_id: user.id,
                    job_id: promptId,
                    filename: imgFilename,
                    comfy_filename: imgFilename,
                    type: "canvas_edit",
                    storage_path: storagePath,
                  });
                }
              } catch (err) {
                console.error("Image save error:", err);
              }
            }

            await supabase.from("jobs")
              .update({ status: "completed", completed_at: new Date().toISOString() })
              .eq("prompt_id", promptId);
          }
        } catch (err) {
          console.error("Supabase save error:", err);
        }
      }

      return NextResponse.json({
        status: status?.status_str || "unknown",
        completed: status?.completed || false,
        images,
      });
    }

    return NextResponse.json({
      status: "pending",
      completed: false,
      images: [],
    });
  } catch (err: any) {
    console.error("Status check error:", err);
    return NextResponse.json(
      { error: "Server error", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
