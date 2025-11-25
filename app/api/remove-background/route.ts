import { NextRequest, NextResponse } from "next/server";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File;

    if (!imageFile) {
      return NextResponse.json({ error: "Image required" }, { status: 400 });
    }

    // Upload image to ComfyUI
    const uploadForm = new FormData();
    uploadForm.append("image", imageFile);
    const uploadRes = await fetch(`${COMFY_BASE}/upload/image`, {
      method: "POST",
      body: uploadForm,
    });
    const uploadData = await uploadRes.json();
    const imageName = uploadData.name;

    // Create RMBG workflow using "easy imageRemBg" - most reliable
    const workflow = {
      "1": {
        class_type: "LoadImage",
        inputs: {
          image: imageName
        }
      },
      "2": {
        class_type: "easy imageRemBg",
        inputs: {
          images: ["1", 0],
          rem_mode: "RMBG-1.4",
          image_output: "Preview",
          save_prefix: "rmbg"
        }
      },
      "3": {
        class_type: "SaveImage",
        inputs: {
          filename_prefix: "rmbg_output",
          images: ["2", 0]
        }
      }
    };

    // Execute workflow
    console.log("Sending RMBG workflow to ComfyUI:", JSON.stringify(workflow, null, 2));

    const promptRes = await fetch(`${COMFY_BASE}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!promptRes.ok) {
      const errorText = await promptRes.text();
      console.error("❌ ComfyUI rejected workflow:", errorText);
      return NextResponse.json({ error: "ComfyUI error", details: errorText }, { status: 500 });
    }

    const promptData = await promptRes.json();
    const promptId = promptData.prompt_id;

    if (!promptId) {
      console.error("❌ No prompt_id received:", promptData);
      return NextResponse.json({ error: "No prompt_id from ComfyUI" }, { status: 500 });
    }

    // Poll for completion with better logging
    let completed = false;
    let resultImage = "";
    let imageSubfolder = "";
    let imageType = "output";
    const startTime = Date.now();

    console.log("🎭 RMBG workflow started, prompt_id:", promptId);

    while (!completed && Date.now() - startTime < 60000) {
      await new Promise((r) => setTimeout(r, 1000));

      const historyRes = await fetch(`${COMFY_BASE}/history/${promptId}`);
      const historyData = await historyRes.json();

      if (historyData[promptId]) {
        const status = historyData[promptId].status;
        const outputs = historyData[promptId].outputs;

        console.log("RMBG status:", status?.status_str, "- Outputs:", Object.keys(outputs || {}));

        // Check if we have outputs with images first
        if (outputs) {
          for (const nodeId in outputs) {
            const nodeOutput = outputs[nodeId];
            if (nodeOutput.images?.[0]) {
              const img = nodeOutput.images[0];
              resultImage = img.filename;
              imageSubfolder = img.subfolder || "";
              imageType = img.type || "output";

              console.log("✅ RMBG completed, node:", nodeId, "image:", {
                filename: resultImage,
                subfolder: imageSubfolder,
                type: imageType
              });

              completed = true;
              break;
            }
          }
        }

        // Only error out if status is explicitly error AND we have no outputs
        if (!completed && status?.status_str === "error" && (!outputs || Object.keys(outputs).length === 0)) {
          console.error("❌ RMBG error:", historyData[promptId].status?.messages || "Unknown error");
          return NextResponse.json({ error: "RMBG failed in ComfyUI" }, { status: 500 });
        }
      }
    }

    if (!resultImage) {
      console.error("❌ RMBG timeout after 60s");
      return NextResponse.json({ error: "RMBG timeout" }, { status: 500 });
    }

    console.log("🎨 Fetching RMBG result:", { filename: resultImage, subfolder: imageSubfolder, type: imageType });

    // Fetch the processed image with proper parameters
    let imageUrl = `${COMFY_BASE}/view?filename=${encodeURIComponent(resultImage)}`;
    if (imageSubfolder) {
      imageUrl += `&subfolder=${encodeURIComponent(imageSubfolder)}`;
    }
    imageUrl += `&type=${imageType}`;

    console.log("📥 Fetching from URL:", imageUrl);

    const imageRes = await fetch(imageUrl);
    console.log("📡 Fetch response status:", imageRes.status, imageRes.statusText);

    if (!imageRes.ok) {
      console.error("❌ Failed to fetch result image:", imageRes.status, imageRes.statusText);
      return NextResponse.json({ error: "Failed to fetch result image" }, { status: 500 });
    }

    const imageBlob = await imageRes.blob();
    console.log("✅ Got image blob, size:", imageBlob.size, "type:", imageBlob.type);

    return new NextResponse(imageBlob, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (err: any) {
    console.error("RMBG error:", err);
    return NextResponse.json(
      { error: "RMBG failed", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
