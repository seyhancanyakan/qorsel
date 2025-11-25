import { NextRequest, NextResponse } from "next/server";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const promptId = searchParams.get("prompt_id");

    if (!promptId) {
      return NextResponse.json(
        { error: "prompt_id parameter required" },
        { status: 400 }
      );
    }

    // Query ComfyUI history endpoint (cache bypass)
    const res = await fetch(`${COMFY_BASE}/history/${promptId}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "ComfyUI history query failed" },
        { status: 500 }
      );
    }

    const data = await res.json();

    // If we have result for this prompt_id
    if (data[promptId]) {
      const historyItem = data[promptId];

      // Check if job is completed
      const status = historyItem.status;
      const outputs = historyItem.outputs || {};

      // Determine which step we're on based on which nodes have completed
      let step: "extract" | "transfer" | "done" = "extract";

      // Node 85 is the first SaveImage (outfit extraction)
      // Node 140 is the final SaveImage (outfit transfer)
      // Return both images in order: [extracted_outfit, final_result]
      const images: string[] = [];
      let extractedImage: string | null = null;
      let finalImage: string | null = null;

      // Get extracted outfit from node 85
      if (outputs["85"]) {
        const extractOutput = outputs["85"];
        if (extractOutput.images && Array.isArray(extractOutput.images)) {
          extractOutput.images.forEach((img: any) => {
            if (img.filename) {
              extractedImage = img.filename;
            }
          });
        }
      }

      // Get final transferred image from node 140
      if (outputs["140"]) {
        step = "done";
        const finalOutput = outputs["140"];
        if (finalOutput.images && Array.isArray(finalOutput.images)) {
          finalOutput.images.forEach((img: any) => {
            if (img.filename) {
              finalImage = img.filename;
            }
          });
        }
      } else if (outputs["85"]) {
        step = "transfer";
      }

      // Add both images to array if they exist
      if (extractedImage) images.push(extractedImage);
      if (finalImage) images.push(finalImage);

      // If job completed and we have images, save to Supabase
      if (status?.completed && images.length > 0) {
        console.log("🎨 VIRTUAL TRY-ON COMPLETE - Saving to Supabase Storage...");
        try {
          const { createClient } = await import("@/lib/supabase/server");
          const supabase = await createClient();

          const { data: { user } } = await supabase.auth.getUser();

          if (user) {
            console.log("💾 Saving", images.length, "images to Storage...");
            for (const imgFilename of images) {
              try {
                // Fetch image from ComfyUI
                const imgRes = await fetch(`${COMFY_BASE}/view?filename=${imgFilename}`);
                const imgBlob = await imgRes.blob();

                // Upload to Supabase Storage
                const storagePath = `${user.id}/${promptId}/${imgFilename}`;
                const { error: uploadError } = await supabase.storage
                  .from("user-images")
                  .upload(storagePath, imgBlob, { upsert: true });

                if (!uploadError) {
                  // Add image record to database
                  await supabase.from("images").insert({
                    user_id: user.id,
                    job_id: promptId,
                    filename: imgFilename,
                    comfy_filename: imgFilename,
                    type: "virtual_tryon",
                    storage_path: storagePath,
                  });
                }
              } catch (err) {
                console.error("Image save error:", err);
              }
            }

            // Mark job as completed
            await supabase.from("jobs")
              .update({
                status: "completed",
                completed_at: new Date().toISOString()
              })
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
        step,
      });
    }

    // No result yet
    return NextResponse.json({
      status: "pending",
      completed: false,
      images: [],
      step: "extract",
    });
  } catch (err: any) {
    console.error("Status check error:", err);
    return NextResponse.json(
      { error: "Server error", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
