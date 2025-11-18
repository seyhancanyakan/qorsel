import { NextRequest, NextResponse } from "next/server";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const promptId = searchParams.get("prompt_id");

    if (!promptId) {
      return NextResponse.json(
        { error: "prompt_id parametresi gerekli" },
        { status: 400 }
      );
    }

    // ComfyUI history endpoint'ini sorgula (cache bypass)
    const res = await fetch(`${COMFY_BASE}/history/${promptId}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "ComfyUI history sorgulanamadı" },
        { status: 500 }
      );
    }

    const data = await res.json();

    console.log("History data keys:", Object.keys(data));
    console.log("Looking for promptId:", promptId);

    // Eğer bu prompt_id için sonuç varsa
    if (data[promptId]) {
      const historyItem = data[promptId];

      // İş tamamlandı mı kontrol et
      const status = historyItem.status;
      const outputs = historyItem.outputs || {};

      console.log("Status:", status);
      console.log("Outputs:", outputs);

      // SaveImage node'larından çıkan dosyaları topla (temp dahil)
      const images: string[] = [];
      for (const nodeId in outputs) {
        const nodeOutput = outputs[nodeId];
        if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
          nodeOutput.images.forEach((img: any) => {
            if (img.filename) {
              // Hem normal hem temp görselleri ekle
              images.push(img.filename);
            }
          });
        }
      }

      console.log("Found images:", images);

      // Eğer job tamamlandı ve görseller var ise, Supabase'e kaydet
      if (status?.completed && images.length > 0) {
        console.log("🎨 JOB COMPLETE - Saving to Supabase Storage...");
        try {
          const { createClient } = await import("@/lib/supabase/server");
          const supabase = await createClient();

          // User'ı al (opsiyonel - job_id üzerinden de bulunabilir)
          const { data: { user } } = await supabase.auth.getUser();
          console.log("👤 User:", user ? user.id : "NO USER - NOT LOGGED IN!");

          if (user) {
            console.log("💾 Saving", images.length, "images to Storage...");
            // Her görseli Supabase Storage'a yükle ve database'e kaydet
            for (const imgFilename of images) {
              try {
                // ComfyUI'den görseli al
                const imgRes = await fetch(`${COMFY_BASE}/view?filename=${imgFilename}`);
                const imgBlob = await imgRes.blob();

                // Supabase Storage'a yükle
                const storagePath = `${user.id}/${promptId}/${imgFilename}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from("user-images")
                  .upload(storagePath, imgBlob, { upsert: true });

                if (!uploadError) {
                  // Database'e image kaydı ekle
                  await supabase.from("images").insert({
                    user_id: user.id,
                    job_id: promptId, // prompt_id'yi job_id olarak kullanıyoruz
                    filename: imgFilename,
                    comfy_filename: imgFilename,
                    type: "generated",
                    storage_path: storagePath,
                  });
                }
              } catch (err) {
                console.error("Image save error:", err);
              }
            }

            // Job'u tamamlandı olarak işaretle
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

    console.log("No history found for prompt_id:", promptId);

    // Henüz sonuç yok
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
