"use client";

import { useEffect, useRef, useState } from "react";
import { fabric } from "fabric";

interface FabricCanvasProps {
  backgroundImage: File | null;
  overlayImages: (File | null)[];
  enableRMBG: boolean[];
  onCompositeReady: (compositeFile: File) => void;
}

interface Layer {
  id: string;
  name: string;
  object: fabric.Object;
  visible: boolean;
}

export default function FabricCanvas({
  backgroundImage,
  overlayImages,
  enableRMBG,
  onCompositeReady,
}: FabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [editingLayer, setEditingLayer] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");


  useEffect(() => {
    if (!canvasRef.current) return;

    // Calculate responsive canvas size
    const containerWidth = canvasRef.current.parentElement?.clientWidth || 1280;
    const maxWidth = Math.min(containerWidth - 32, 1280); // 32px for padding
    const aspectRatio = 736 / 1280;
    const canvasHeight = maxWidth * aspectRatio;

    // Initialize Fabric canvas with responsive settings
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: maxWidth,
      height: canvasHeight,
      backgroundColor: "#1a1a1a",
      preserveObjectStacking: true,
    });

    // Enable mouse wheel zoom
    canvas.on("mouse:wheel", (opt) => {
      const delta = opt.e.deltaY;
      let newZoom = canvas.getZoom();
      newZoom *= 0.999 ** delta;
      if (newZoom > 5) newZoom = 5;
      if (newZoom < 0.1) newZoom = 0.1;
      canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, newZoom);
      setZoom(newZoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Pan with middle mouse or space+drag
    let isPanning = false;
    let lastPosX = 0;
    let lastPosY = 0;

    canvas.on("mouse:down", (opt) => {
      const evt = opt.e;
      if (evt.button === 1 || (evt.button === 0 && evt.shiftKey)) {
        isPanning = true;
        canvas.selection = false;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
        canvas.defaultCursor = "grab";
      }
    });

    canvas.on("mouse:move", (opt) => {
      if (isPanning) {
        const evt = opt.e;
        const vpt = canvas.viewportTransform!;
        vpt[4] += evt.clientX - lastPosX;
        vpt[5] += evt.clientY - lastPosY;
        canvas.requestRenderAll();
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
    });

    canvas.on("mouse:up", () => {
      isPanning = false;
      canvas.selection = true;
      canvas.defaultCursor = "default";
    });

    // Track selection
    canvas.on("selection:created", (e) => {
      if (e.selected && e.selected[0]) {
        setSelectedLayer((e.selected[0] as any).layerId || null);
      }
    });

    canvas.on("selection:updated", (e) => {
      if (e.selected && e.selected[0]) {
        setSelectedLayer((e.selected[0] as any).layerId || null);
      }
    });

    canvas.on("selection:cleared", () => {
      setSelectedLayer(null);
    });

    fabricRef.current = canvas;
    setIsReady(true);

    return () => {
      canvas.dispose();
    };
  }, []);

  useEffect(() => {
    if (!isReady || !fabricRef.current) return;

    const canvas = fabricRef.current;
    canvas.clear();
    canvas.backgroundColor = "#1a1a1a";
    const newLayers: Layer[] = [];

    // Load background
    if (backgroundImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        fabric.Image.fromURL(e.target?.result as string, (img) => {
          const layerId = "bg-layer";
          img.scaleToWidth(canvas.width!);
          img.scaleToHeight(canvas.height!);
          img.selectable = false;
          (img as any).layerId = layerId;
          canvas.add(img);
          canvas.sendToBack(img);

          newLayers.push({
            id: layerId,
            name: "Background",
            object: img,
            visible: true,
          });
          setLayers([...newLayers]);
          canvas.renderAll();
        });
      };
      reader.readAsDataURL(backgroundImage);
    }

    // Load overlay images
    overlayImages.forEach((file, idx) => {
      if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          let imgUrl = e.target?.result as string;

          // Apply background removal if enabled
          if (enableRMBG[idx]) {
            try {
              console.log(`🎭 Removing background for Layer ${idx + 1}...`);
              setIsProcessing(true);
              setProcessingMessage(`Removing background for Layer ${idx + 1}...`);

              const formData = new FormData();
              formData.append("image", file);
              const res = await fetch("/api/remove-background", {
                method: "POST",
                body: formData,
              });

              if (res.ok) {
                const blob = await res.blob();
                console.log(`📦 RMBG blob for Layer ${idx + 1} - type:`, blob.type, "size:", blob.size);

                // Check if blob is valid (has content)
                if (blob.size > 0) {
                  imgUrl = URL.createObjectURL(blob);
                  console.log(`✅ Background removed for Layer ${idx + 1}`);
                } else {
                  console.error(`❌ RMBG returned empty blob for Layer ${idx + 1}`);
                  alert(`Background removal failed for Layer ${idx + 1}. Empty response.`);
                }
              } else {
                const errorText = await res.text();
                console.error(`❌ RMBG API error for Layer ${idx + 1}:`, errorText);
                alert(`Background removal failed for Layer ${idx + 1}: ${errorText}`);
              }
            } catch (err) {
              console.error("Background removal error:", err);
              alert(`Background removal error for Layer ${idx + 1}. Using original image.`);
            } finally {
              setIsProcessing(false);
              setProcessingMessage("");
            }
          }

          fabric.Image.fromURL(imgUrl, (img) => {
            const layerId = `layer-${idx}`;

            // Scale to reasonable size
            const maxSize = 400;
            if (img.width! > maxSize || img.height! > maxSize) {
              const scale = Math.min(maxSize / img.width!, maxSize / img.height!);
              img.scale(scale);
            }

            // Position with slight offset
            img.set({
              left: canvas.width! / 2 - (img.width! * img.scaleX!) / 2 + (idx * 50),
              top: canvas.height! / 2 - (img.height! * img.scaleY!) / 2 + (idx * 50),
              selectable: true,
              hasControls: true,
              hasBorders: true,
            });

            (img as any).layerId = layerId;
            canvas.add(img);

            newLayers.push({
              id: layerId,
              name: `Layer ${idx + 1}`,
              object: img,
              visible: true,
            });
            setLayers([...newLayers]);
            canvas.renderAll();
          });
        };
        reader.readAsDataURL(file);
      }
    });
  }, [backgroundImage, overlayImages, enableRMBG, isReady]);

  function handleLayerVisibility(layerId: string) {
    const layer = layers.find((l) => l.id === layerId);
    if (layer) {
      layer.object.visible = !layer.object.visible;
      layer.visible = layer.object.visible;
      setLayers([...layers]);
      fabricRef.current?.renderAll();
    }
  }

  function handleLayerSelect(layerId: string) {
    const layer = layers.find((l) => l.id === layerId);
    if (layer && fabricRef.current) {
      fabricRef.current.setActiveObject(layer.object);
      fabricRef.current.renderAll();
      setSelectedLayer(layerId);
    }
  }

  function handleLayerDelete(layerId: string) {
    const layer = layers.find((l) => l.id === layerId);
    if (layer && fabricRef.current) {
      fabricRef.current.remove(layer.object);
      setLayers(layers.filter((l) => l.id !== layerId));
    }
  }

  function handleZoomReset() {
    if (fabricRef.current) {
      fabricRef.current.setViewportTransform([1, 0, 0, 1, 0, 0]);
      setZoom(1);
    }
  }

  function handleDeleteSelected() {
    if (fabricRef.current) {
      const active = fabricRef.current.getActiveObject();
      if (active) {
        fabricRef.current.remove(active);
        const layerId = (active as any).layerId;
        setLayers(layers.filter((l) => l.id !== layerId));
      }
    }
  }

  async function handleEditLayer(layerId: string) {
    setEditingLayer(layerId);
    const layer = layers.find((l) => l.id === layerId);
    if (layer) {
      setEditPrompt("");
    }
  }


  async function handleRemoveBackground(layerId: string) {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer || !fabricRef.current) return;

    const canvas = fabricRef.current;
    const obj = layer.object as fabric.Image;

    try {
      setIsProcessing(true);
      setProcessingMessage(`Removing background from ${layer.name}...`);

      // Export the layer as image
      const dataURL = obj.toDataURL({ format: "png" });
      const blob = await (await fetch(dataURL)).blob();
      const file = new File([blob], "layer.png", { type: "image/png" });

      // Send to remove-background API
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/remove-background", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`RMBG API error: ${errorText}`);
      }

      const resultBlob = await res.blob();
      console.log("📦 Result blob type:", resultBlob.type, "size:", resultBlob.size);

      // Accept any blob that looks like an image (including empty type for PNGs)
      if (resultBlob.size === 0) {
        throw new Error(`RMBG returned empty blob`);
      }

      const imgUrl = URL.createObjectURL(resultBlob);
      console.log("🖼️ Created object URL:", imgUrl);

      // Replace layer with background-removed version
      fabric.Image.fromURL(imgUrl, (newImg) => {
        // Keep position and scale
        newImg.set({
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
          selectable: true,
          hasControls: true,
          hasBorders: true,
        });

        (newImg as any).layerId = layerId;

        canvas.remove(obj);
        canvas.add(newImg);

        // Update layer reference
        const updatedLayers = layers.map((l) =>
          l.id === layerId ? { ...l, object: newImg } : l
        );
        setLayers(updatedLayers);

        canvas.renderAll();
        console.log(`✅ Background removed from ${layer.name}`);
      });
    } catch (err) {
      console.error("Remove background error:", err);
      alert(`Failed to remove background: ${err}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  }

  async function handleApplyEdit() {
    if (!editPrompt.trim() || !editingLayer || !fabricRef.current) return;

    const layer = layers.find((l) => l.id === editingLayer);
    if (!layer) return;

    const canvas = fabricRef.current;

    try {
      setIsProcessing(true);
      setProcessingMessage(`Editing ${layer.name}...`);
      // Translate prompt to English if needed
      let englishPrompt = editPrompt;
      const hasTurkish = /[ğüşıöçĞÜŞİÖÇ]/.test(editPrompt);

      if (hasTurkish) {
        console.log("🌐 Translating edit prompt to English...");
        try {
          const translateRes = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: editPrompt })
          });
          const translateData = await translateRes.json();
          englishPrompt = translateData.translated || editPrompt;
          console.log("✅ Translated:", englishPrompt);
        } catch (err) {
          console.error("Translation failed, using original prompt:", err);
        }
      }

      // Export just this layer - use object's own toDataURL
      const obj = layer.object as fabric.Image;

      // Clone the object to avoid modifying the original
      const clonedObj = await new Promise<fabric.Image>((resolve) => {
        obj.clone((cloned: fabric.Image) => {
          resolve(cloned);
        });
      });

      // Reset transformations to get the raw image
      clonedObj.set({
        left: 0,
        top: 0,
        angle: 0,
      });

      // Create a temporary canvas with just this object
      const tempCanvas = new fabric.Canvas(document.createElement('canvas'), {
        width: clonedObj.width! * clonedObj.scaleX!,
        height: clonedObj.height! * clonedObj.scaleY!,
      });

      tempCanvas.add(clonedObj);
      tempCanvas.centerObject(clonedObj);
      tempCanvas.renderAll();

      const dataURL = tempCanvas.toDataURL({ format: "png", quality: 1.0 });
      tempCanvas.dispose();

      // Convert to file and upload
      const blob = await (await fetch(dataURL)).blob();
      const file = new File([blob], "layer.png", { type: "image/png" });

      // Upload to ComfyUI
      const uploadForm = new FormData();
      uploadForm.append("image", file);
      const uploadRes = await fetch("/api/upload-image", {
        method: "POST",
        body: uploadForm,
      });
      const uploadData = await uploadRes.json();
      const imageName = uploadData.name;

      // Run Qwen edit with English prompt
      const layerWidth = Math.round(clonedObj.width! * clonedObj.scaleX!);
      const layerHeight = Math.round(clonedObj.height! * clonedObj.scaleY!);

      const editForm = new FormData();
      editForm.append("prompt", englishPrompt);
      editForm.append("imageName", imageName);
      editForm.append("steps", "4");
      editForm.append("cfg", "1");
      editForm.append("width", String(layerWidth));
      editForm.append("height", String(layerHeight));
      editForm.append("seed", String(Math.floor(Math.random() * 1000000)));

      const editRes = await fetch("/api/tekqwen/run", {
        method: "POST",
        body: editForm,
      });
      const editData = await editRes.json();
      const promptId = editData.prompt_id;

      // Poll for result
      let completed = false;
      const startTime = Date.now();

      while (!completed && Date.now() - startTime < 60000) {
        await new Promise((r) => setTimeout(r, 2000));

        const statusRes = await fetch(
          `/api/qwen-edit/status?prompt_id=${promptId}&_=${Date.now()}`,
          { cache: "no-store" }
        );
        const statusData = await statusRes.json();

        if (statusData.completed && statusData.images.length > 0) {
          console.log("✅ Edit completed, starting upscale...");
          const editedImageName = statusData.images[0];

          // Upscale the edited image
          const upscaleForm = new FormData();
          upscaleForm.append("imageName", editedImageName);

          const upscaleRes = await fetch("/api/upscale-simple", {
            method: "POST",
            body: upscaleForm,
          });

          if (!upscaleRes.ok) {
            console.warn("⚠️ Upscale failed, using original edited image");
            // Use the non-upscaled version
            const proxyUrl = `/api/proxy-image?filename=${encodeURIComponent(editedImageName)}`;
            const imgRes = await fetch(proxyUrl);
            const imgBlob = await imgRes.blob();
            const imgUrl = URL.createObjectURL(imgBlob);

            fabric.Image.fromURL(imgUrl, (newImg) => {
              newImg.set({
                left: obj.left,
                top: obj.top,
                scaleX: obj.scaleX,
                scaleY: obj.scaleY,
                angle: obj.angle,
                selectable: true,
                hasControls: true,
                hasBorders: true,
              });
              (newImg as any).layerId = editingLayer;
              canvas.remove(obj);
              canvas.add(newImg);
              const updatedLayers = layers.map((l) =>
                l.id === editingLayer ? { ...l, object: newImg } : l
              );
              setLayers(updatedLayers);
              canvas.renderAll();
              setEditingLayer(null);
              setEditPrompt("");
            });
            completed = true;
            return;
          }

          const upscaleData = await upscaleRes.json();
          const upscalePromptId = upscaleData.prompt_id;

          console.log("🔍 Upscaling, prompt_id:", upscalePromptId);
          setProcessingMessage(`Upscaling ${layer.name}...`);

          // Poll for upscale completion
          let upscaleCompleted = false;
          const upscaleStart = Date.now();

          while (!upscaleCompleted && Date.now() - upscaleStart < 120000) {
            await new Promise((r) => setTimeout(r, 2000));

            const upscaleStatusRes = await fetch(
              `/api/qwen-edit/status?prompt_id=${upscalePromptId}&_=${Date.now()}`,
              { cache: "no-store" }
            );
            const upscaleStatusData = await upscaleStatusRes.json();

            if (upscaleStatusData.completed && upscaleStatusData.images.length > 0) {
              console.log("✅ Upscale completed:", upscaleStatusData.images[0]);

              // Load upscaled image
              const proxyUrl = `/api/proxy-image?filename=${encodeURIComponent(upscaleStatusData.images[0])}`;
              const imgRes = await fetch(proxyUrl);
              const imgBlob = await imgRes.blob();
              const imgUrl = URL.createObjectURL(imgBlob);

              // Replace layer image with upscaled version
              fabric.Image.fromURL(imgUrl, (newImg) => {
                newImg.set({
                  left: obj.left,
                  top: obj.top,
                  scaleX: obj.scaleX,
                  scaleY: obj.scaleY,
                  angle: obj.angle,
                  selectable: true,
                  hasControls: true,
                  hasBorders: true,
                });

                (newImg as any).layerId = editingLayer;

                canvas.remove(obj);
                canvas.add(newImg);

                const updatedLayers = layers.map((l) =>
                  l.id === editingLayer ? { ...l, object: newImg } : l
                );
                setLayers(updatedLayers);

                canvas.renderAll();
                setEditingLayer(null);
                setEditPrompt("");
                alert("✅ Edit + Upscale completed!");
              });

              upscaleCompleted = true;
            }
          }

          if (!upscaleCompleted) {
            console.warn("⚠️ Upscale timeout, using non-upscaled version");
          }

          completed = true;
        }
      }
    } catch (err) {
      console.error("Edit layer error:", err);
      alert("Layer edit failed");
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  }


  async function handleExportComposite() {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;

    // Reset viewport for export
    const vpt = canvas.viewportTransform;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    const dataURL = canvas.toDataURL({ format: "png", quality: 1.0 });

    // Restore viewport
    if (vpt) canvas.setViewportTransform(vpt);

    const blob = await (await fetch(dataURL)).blob();
    const file = new File([blob], "composite.png", { type: "image/png" });

    onCompositeReady(file);
  }

  return (
    <div className="flex gap-3 relative">
      {/* Loading Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 rounded-xl">
          <div className="w-16 h-16 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-4"></div>
          <p className="text-white font-semibold">{processingMessage}</p>
        </div>
      )}

      {/* Canvas Area */}
      <div className="flex-1 space-y-2">
        <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-700 relative w-full">
          <canvas ref={canvasRef} className="max-w-full h-auto" />

          {/* Zoom indicator */}
          <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
            {Math.round(zoom * 100)}%
          </div>
        </div>

        {/* Toolbar */}
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExportComposite}
              disabled={!backgroundImage}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm"
            >
              📸 Use Composition
            </button>
            <button
              onClick={handleZoomReset}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg text-sm"
            >
              🔍 Reset Zoom
            </button>
            <button
              onClick={handleDeleteSelected}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm"
            >
              🗑️ Delete
            </button>
          </div>
        </div>

        <p className="text-gray-400 text-xs">
          💡 <strong>Scroll</strong> to zoom • <strong>Shift+Drag</strong> to pan • <strong>Click</strong> to select
        </p>
      </div>

      {/* Layers Panel */}
      <div className="w-64 bg-gray-800 rounded-xl p-3">
        <h4 className="text-white font-bold mb-2 text-sm">Layers</h4>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {layers.length === 0 ? (
            <p className="text-gray-500 text-xs">No layers yet</p>
          ) : (
            [...layers].reverse().map((layer) => (
              <div key={layer.id}>
                <div
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                    selectedLayer === layer.id ? "bg-blue-600/30 border border-blue-500" : "bg-gray-700 hover:bg-gray-600"
                  }`}
                  onClick={() => handleLayerSelect(layer.id)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLayerVisibility(layer.id);
                    }}
                    className="text-xs"
                  >
                    {layer.visible ? "👁️" : "🚫"}
                  </button>
                  <span className="flex-1 text-white text-xs truncate">{layer.name}</span>
                  {layer.id !== "bg-layer" && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveBackground(layer.id);
                        }}
                        className="text-purple-400 hover:text-purple-300 text-xs px-1"
                        title="Remove Background"
                      >
                        🎭
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditLayer(layer.id);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-xs px-1"
                        title="Edit with AI"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLayerDelete(layer.id);
                        }}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Layer Modal */}
      {editingLayer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-white font-bold mb-3">Edit Layer with AI</h3>
            <p className="text-gray-400 text-xs mb-3">
              Describe how you want to edit this layer:
            </p>
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="IMPORTANT: Describe changes to ADD, not the full image. E.g: 'add red sunglasses to face', 'add pink slippers to feet', 'change hair color to blue'"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              rows={4}
              autoFocus
              disabled={isProcessing}
            />
            <div className="flex gap-2">
              <button
                onClick={handleApplyEdit}
                disabled={!editPrompt.trim() || isProcessing}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>✨ Apply Edit</>
                )}
              </button>
              <button
                onClick={() => {
                  setEditingLayer(null);
                  setEditPrompt("");
                }}
                disabled={isProcessing}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
