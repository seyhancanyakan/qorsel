import { NextRequest, NextResponse } from "next/server";
import workflow from "@/workflows/qwen-edit.json";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

type QwenEditWorkflow = Record<string, any>;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    // Form verilerini al
    const prompt1 = String(form.get("prompt1") ?? "");
    const prompt2 = String(form.get("prompt2") ?? "");
    const steps = Number(form.get("steps") ?? 4);
    const cfg = Number(form.get("cfg") ?? 1);
    const width = Number(form.get("width") ?? 1920);
    const height = Number(form.get("height") ?? 1080);

    // Yüklenen görsel dosya adları
    const image1Name = String(form.get("image1Name") ?? "");
    const image2Name = String(form.get("image2Name") ?? "");
    const image3Name = String(form.get("image3Name") ?? "");
    const image4Name = String(form.get("image4Name") ?? "");

    // Workflow'u klonla
    const wf: QwenEditWorkflow = structuredClone(workflow as QwenEditWorkflow);

    console.log("Received images:", { image1Name, image2Name, image3Name, image4Name });

    // Validate required images
    if (!image1Name || image1Name.trim() === "") {
      return NextResponse.json({ error: "image1Name (background) is required" }, { status: 400 });
    }
    if (!image2Name || image2Name.trim() === "") {
      return NextResponse.json({ error: "image2Name is required" }, { status: 400 });
    }

    // LoadImage node'ları - Görselleri buraya koy
    if (wf["213"]?.inputs) {
      wf["213"].inputs.image = image1Name;
    }
    if (wf["1284"]?.inputs) {
      wf["1284"].inputs.image = image2Name;
    }
    if (wf["1285"]?.inputs && image3Name && image3Name.trim() !== "") {
      wf["1285"].inputs.image = image3Name;
    }
    // Image4 opsiyonel - yoksa node'u devre dışı bırak
    if (wf["1292"]?.inputs && image4Name && image4Name.trim() !== "") {
      wf["1292"].inputs.image = image4Name;
    } else if (wf["1292"]) {
      // Node'u kaldır
      delete wf["1292"];
      delete wf["1293"];
      delete wf["1294"];
      delete wf["1295"];
      delete wf["1297"];
    }

    // Node 1199 - Ana prompt (image1 ve image2 node referansları olarak kalacak)
    if (wf["1199"]?.inputs) {
      wf["1199"].inputs.prompt = prompt1 || wf["1199"].inputs.prompt;
      // image1 ve image2 zaten workflow'da node referansları olarak tanımlı
    }

    // Node 1323 - Close-up prompt
    if (wf["1323"]?.inputs) {
      wf["1323"].inputs.prompt = prompt2 || wf["1323"].inputs.prompt;
    }

    // Node 844 - Steps
    if (wf["844"]?.inputs) {
      wf["844"].inputs.value = steps;
    }

    // Node 850 - CFG
    if (wf["850"]?.inputs) {
      wf["850"].inputs.value = cfg;
    }

    // Node 1298 - Width
    if (wf["1298"]?.inputs) {
      wf["1298"].inputs.value = width;
    }

    // Node 1299 - Height
    if (wf["1299"]?.inputs) {
      wf["1299"].inputs.value = height;
    }

    console.log("Updated workflow nodes:", {
      image213: wf["213"]?.inputs?.image,
      image1284: wf["1284"]?.inputs?.image,
      image1292: wf["1292"]?.inputs?.image,
      prompt1199: wf["1199"]?.inputs?.prompt?.substring(0, 50),
      prompt1323: wf["1323"]?.inputs?.prompt?.substring(0, 50),
    });

    // Enable image-to-image mode for composition editing
    if (wf["199"]?.inputs && image1Name && image1Name.trim() !== "") {
      console.log("🔄 Qwen-Edit: Activating img2img mode");

      // Add VAEEncode node
      wf["200_encode"] = {
        inputs: {
          pixels: ["213", 0],
          vae: ["549", 0],
        },
        class_type: "VAEEncode",
      };

      // Switch KSampler to use encoded latent
      wf["199"].inputs.latent_image = ["200_encode", 0];
      wf["199"].inputs.denoise = 0.75;

      console.log("✅ Img2img enabled with denoise 0.75");
    }

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
    console.error("❌ Qwen edit run error:", err);
    console.error("Error stack:", err.stack);
    return NextResponse.json(
      { error: "Server error", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
