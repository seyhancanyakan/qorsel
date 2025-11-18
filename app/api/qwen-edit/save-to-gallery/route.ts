import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function POST(req: NextRequest) {
  try {
    const { promptId, images } = await req.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("💾 MANUAL SAVE - User:", user.id, "Images:", images.length);

    // Her görseli kaydet
    for (const imgFilename of images) {
      try {
        // ComfyUI'den görseli al
        const imgRes = await fetch(`${COMFY_BASE}/view?filename=${imgFilename}`);
        const imgBlob = await imgRes.blob();

        // Supabase Storage'a yükle
        const storagePath = `${user.id}/${promptId}/${imgFilename}`;
        const { error: uploadError } = await supabase.storage
          .from("user-images")
          .upload(storagePath, imgBlob, { upsert: true });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw uploadError;
        }

        console.log("✅ Uploaded to storage:", storagePath);

        // Database'e kaydet
        const { error: dbError } = await supabase.from("images").insert({
          user_id: user.id,
          job_id: promptId,
          filename: imgFilename,
          comfy_filename: imgFilename,
          type: "generated",
          storage_path: storagePath,
        });

        if (dbError) {
          console.error("Database insert error:", dbError);
          throw dbError;
        }

        console.log("✅ Saved to database:", imgFilename);
      } catch (err) {
        console.error("Image save error:", err);
      }
    }

    return NextResponse.json({ success: true, saved: images.length }, { status: 200 });
  } catch (err: any) {
    console.error("Save to gallery error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
