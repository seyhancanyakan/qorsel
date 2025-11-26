"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import MobileFooter from "@/components/MobileFooter";

const COMFY_BASE = process.env.NEXT_PUBLIC_COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

const PRESET_MODELS = [
  { id: 1, name: "Model 1", url: "/presets/models/model1.jpg" },
  { id: 2, name: "Model 2", url: "/presets/models/model2.jpg" },
  { id: 3, name: "Model 3", url: "/presets/models/model3.jpg" },
  { id: 4, name: "Model 4", url: "/presets/models/model4.jpg" },
];

const PRESET_CLOTHES = [
  { id: 1, name: "Dress", url: "/presets/clothes/dress1.jpg" },
  { id: 2, name: "Pants", url: "/presets/clothes/pants1.jpg" },
  { id: 3, name: "Pants", url: "/presets/clothes/pants2.jpg" },
  { id: 4, name: "Jacket", url: "/presets/clothes/jacket1.jpg" },
  { id: 5, name: "Jacket", url: "/presets/clothes/jacket2.jpg" },
  { id: 6, name: "Jacket", url: "/presets/clothes/jacket3.jpg" },
  { id: 7, name: "Dress", url: "/presets/clothes/dress2.jpg" },
  { id: 8, name: "Dress", url: "/presets/clothes/dress3.jpg" },
];

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("/api/upload-image", { method: "POST", body: formData });
  const data = await res.json();
  return data.name;
}

async function uploadPresetImage(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  const file = new File([blob], url.split('/').pop() || 'preset.jpg', { type: blob.type });
  return uploadImage(file);
}

export default function VirtualTryOnPage() {
  const [selectedModel, setSelectedModel] = useState<number | null>(null);
  const [selectedClothing, setSelectedClothing] = useState<number | null>(null);
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [clothingFile, setClothingFile] = useState<File | null>(null);
  const [poseFile, setPoseFile] = useState<File | null>(null);
  const [multiView, setMultiView] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [upscaling, setUpscaling] = useState<string | null>(null);

  const prompt = multiView
    ? "Extract the EXACT outfit from the clothing image preserving all details: color, pattern, style, fabric texture. Show the model wearing this IDENTICAL outfit from front, back, and side view. The outfit must match EXACTLY with the original clothing image."
    : "Extract the EXACT outfit from the clothing image with all details: exact color, pattern, style, fabric. Preserve every detail accurately.";

  const transferPrompt = multiView
    ? "FULL BODY SHOT of the model including face, head, and entire body. Transfer this EXACT outfit onto the model with 100% accuracy. The model must wear the IDENTICAL clothing preserving: exact color, exact pattern, exact style, exact fit. Display the COMPLETE model (head to toe, including face) wearing this outfit in 3 different angles: front view, back view, and side view. Each view shows the FULL BODY of the same model from head to toe. Background: professional studio lighting, full body fashion photography."
    : "FULL BODY SHOT of the model including face, head, arms, legs, and entire body from head to toe. Transfer this EXACT outfit onto the model with perfect accuracy. The clothing must be IDENTICAL to the reference: same color, same pattern, same style, same fit. Show COMPLETE full body of the model wearing the outfit. Professional fashion photography, full body shot, good lighting.";

  async function handleGenerate() {
    const hasModel = selectedModel !== null || personFile !== null;
    const hasClothing = selectedClothing !== null || clothingFile !== null;

    if (!hasModel || !hasClothing) {
      alert("Please select model and clothing!");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      let personName: string;
      let clothingName: string;
      let poseName: string | null = null;

      // Priority: Use uploaded files if available, otherwise use presets
      if (personFile && clothingFile) {
        // Use uploaded images
        personName = await uploadImage(personFile);
        clothingName = await uploadImage(clothingFile);
        poseName = poseFile ? await uploadImage(poseFile) : null;
      } else if (selectedModel !== null && selectedClothing !== null) {
        // Use preset images
        const modelPreset = PRESET_MODELS.find(m => m.id === selectedModel);
        const clothingPreset = PRESET_CLOTHES.find(c => c.id === selectedClothing);

        if (!modelPreset || !clothingPreset) {
          alert("Invalid selection!");
          return;
        }

        personName = await uploadPresetImage(modelPreset.url);
        clothingName = await uploadPresetImage(clothingPreset.url);
      } else {
        alert("Please select preset or upload images!");
        return;
      }

      const formData = new FormData();
      formData.append("personImage", personName);
      formData.append("clothingImage", clothingName);
      if (poseName) formData.append("poseImage", poseName);
      formData.append("extractPrompt", prompt);
      formData.append("transferPrompt", transferPrompt);

      const res = await fetch("/api/virtual-tryon/run", { method: "POST", body: formData });
      const data = await res.json();
      const promptId = data.prompt_id;
      let completed = false;
      const startTime = Date.now();
      const timeout = 200000; // 200 seconds

      while (!completed) {
        // Check timeout
        if (Date.now() - startTime > timeout) {
          // Clear ComfyUI queue
          await fetch("http://127.0.0.1:8188/queue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clear: true })
          });

          setLoading(false);
          alert("İşlem zaman aşımına uğradı (200 saniye). ComfyUI queue temizlendi. Lütfen tekrar deneyin.");
          return;
        }

        await new Promise((r) => setTimeout(r, 3000));
        const statusRes = await fetch(`/api/virtual-tryon/status?prompt_id=${promptId}&_=${Date.now()}`, {
          cache: "no-store"
        });
        const statusData = await statusRes.json();

        if (statusData.completed && statusData.images.length > 0) {
          setResults(statusData.images);
          // Clear uploaded files and selections
          setPersonFile(null);
          setClothingFile(null);
          setPoseFile(null);
          setSelectedModel(null);
          setSelectedClothing(null);
          completed = true;
        }
      }
    } catch (err) {
      console.error(err);
      alert("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadImage(filename: string) {
    try {
      const response = await fetch(`${COMFY_BASE}/view?filename=${filename}`);
      const blob = await response.blob();
      const img = new Image();
      img.src = URL.createObjectURL(blob);

      await new Promise((resolve) => { img.onload = resolve; });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);

      canvas.toBlob((jpegBlob) => {
        if (jpegBlob) {
          const url = URL.createObjectURL(jpegBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename.replace(/\.[^.]+$/, '.jpg');
          link.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/jpeg', 0.95);

      URL.revokeObjectURL(img.src);
    } catch (err) {
      console.error('Download error:', err);
    }
  }

  async function upscaleImage(filename: string) {
    setUpscaling(filename);

    try {
      const formData = new FormData();
      formData.append('imageName', filename);

      const res = await fetch('/api/upscale/run', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok) {
        const promptId = data.prompt_id;

        // Poll for upscale completion
        let completed = false;
        const startTime = Date.now();
        const timeout = 120000; // 2 minutes for upscale

        while (!completed && (Date.now() - startTime < timeout)) {
          await new Promise(r => setTimeout(r, 2000));

          const statusRes = await fetch(`/api/qwen-edit/status?prompt_id=${promptId}&_=${Date.now()}`, {
            cache: 'no-store'
          });
          const statusData = await statusRes.json();

          if (statusData.completed && statusData.images.length > 0) {
            alert('Upscale tamamlandı! Dashboard > Gallery\'de görebilirsiniz.');
            completed = true;
          }
        }

        if (!completed) {
          alert('Upscale zaman aşımına uğradı. Dashboard\'ı kontrol edin.');
        }
      } else {
        alert('Upscale hatası: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Upscale error:', err);
      alert('Upscale başlatılamadı');
    } finally {
      setUpscaling(null);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-700 px-4 py-3 text-white shadow-lg flex-shrink-0">
        <h1 className="text-lg font-bold">Virtual Try-On</h1>
      </div>

      {/* Upscale Loading Overlay */}
      {upscaling && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-8 flex flex-col items-center shadow-2xl">
            <div className="w-20 h-20 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4"></div>
            <p className="text-white font-bold text-lg mb-2">Upscaling...</p>
            <p className="text-gray-400 text-sm text-center">Bu işlem 1-2 dakika sürebilir</p>
            <p className="text-purple-400 text-xs mt-2">{upscaling}</p>
          </div>
        </div>
      )}

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-2 pb-16">

        {loading ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4"></div>
            <p className="text-white font-semibold">Processing...</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-3 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-sm">Results</h2>
              <button onClick={() => setResults([])} className="text-xs text-purple-400 hover:text-purple-300 px-2 py-1">
                ✕ Clear
              </button>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3">
              {results.map((img, idx) => (
                <div key={idx} className="bg-gray-800 rounded-xl overflow-hidden flex flex-col shadow-lg">
                  <div className="px-3 py-2 bg-gray-700/50">
                    <p className="text-white text-sm font-semibold">
                      {idx === 0 ? "Extracted Outfit" : "Final Result"}
                    </p>
                  </div>
                  <div
                    className="flex-1 p-2 flex items-center justify-center bg-gray-900 cursor-pointer relative group"
                    onClick={() => setFullscreenImage(img)}
                  >
                    <img
                      src={`${COMFY_BASE}/view?filename=${img}`}
                      alt="Result"
                      className="max-w-full max-h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white text-sm">Tam boy için tıkla</p>
                    </div>
                  </div>
                  <div className="p-2 grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => setFullscreenImage(img)}
                      className="py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
                    >
                      🔍
                    </button>
                    <button
                      onClick={() => downloadImage(img)}
                      className="py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg"
                    >
                      📥
                    </button>
                    <button
                      onClick={() => upscaleImage(img)}
                      className="py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg"
                    >
                      4x
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Models - Grid 4 columns */}
            <div className="bg-gray-800/30 rounded-lg p-2">
              <h3 className="text-white text-xs font-bold mb-1.5">Models</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {PRESET_MODELS.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => setSelectedModel(selectedModel === model.id ? null : model.id)}
                    className={`relative aspect-[2/3] rounded-lg overflow-hidden cursor-pointer border-2 ${
                      selectedModel === model.id ? "border-purple-500 shadow-lg shadow-purple-500/50" : "border-gray-700"
                    }`}
                  >
                    <img src={model.url} alt={model.name} className="w-full h-full object-cover" />
                    {selectedModel === model.id && (
                      <div className="absolute top-1 right-1 bg-purple-600 rounded-full p-1">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Clothes - Grid 4 columns, 2 rows */}
            <div className="bg-gray-800/30 rounded-lg p-2">
              <h3 className="text-white text-xs font-bold mb-1.5">Clothes</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {PRESET_CLOTHES.map((clothing) => (
                  <div
                    key={clothing.id}
                    onClick={() => setSelectedClothing(selectedClothing === clothing.id ? null : clothing.id)}
                    className={`relative aspect-[2/3] rounded-lg overflow-hidden cursor-pointer border-2 ${
                      selectedClothing === clothing.id ? "border-pink-500 shadow-lg shadow-pink-500/50" : "border-gray-700"
                    }`}
                  >
                    <img src={clothing.url} alt={clothing.name} className="w-full h-full object-cover" />
                    {selectedClothing === clothing.id && (
                      <div className="absolute top-1 right-1 bg-pink-600 rounded-full p-1">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Upload Section */}
            <div className="bg-gray-800/50 rounded-lg p-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Person</label>
                  <input type="file" accept="image/*" onChange={(e) => setPersonFile(e.target.files?.[0] ?? null)} className="hidden" id="person" />
                  <label htmlFor="person" className="h-20 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer flex items-center justify-center bg-gray-800">
                    {personFile ? (
                      <img src={URL.createObjectURL(personFile)} alt="P" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-gray-500 text-2xl">+</span>
                    )}
                  </label>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Clothing</label>
                  <input type="file" accept="image/*" onChange={(e) => setClothingFile(e.target.files?.[0] ?? null)} className="hidden" id="clothing" />
                  <label htmlFor="clothing" className="h-20 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer flex items-center justify-center bg-gray-800">
                    {clothingFile ? (
                      <img src={URL.createObjectURL(clothingFile)} alt="C" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-gray-500 text-2xl">+</span>
                    )}
                  </label>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Pose</label>
                  <input type="file" accept="image/*" onChange={(e) => setPoseFile(e.target.files?.[0] ?? null)} className="hidden" id="pose" />
                  <label htmlFor="pose" className="h-20 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer flex items-center justify-center bg-gray-800">
                    {poseFile ? (
                      <img src={URL.createObjectURL(poseFile)} alt="P" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-gray-500 text-2xl">+</span>
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={multiView} onChange={(e) => setMultiView(e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-white text-xs font-medium">3 Views</span>
              </label>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerate}
                disabled={!selectedModel && !personFile || !selectedClothing && !clothingFile}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-700 text-white font-bold rounded-lg disabled:opacity-50 text-sm"
              >
                ✨ Try On
              </motion.button>
            </div>
          </div>
        )}
      </div>

      <MobileFooter />

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setFullscreenImage(null)}
          >
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img
                src={`${COMFY_BASE}/view?filename=${fullscreenImage}`}
                alt="Fullscreen"
                className="max-w-full max-h-full object-contain"
              />

              <div className="absolute top-4 right-4 flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadImage(fullscreenImage);
                  }}
                  className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    upscaleImage(fullscreenImage);
                  }}
                  className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenImage(null);
                  }}
                  className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full shadow-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>

              <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-sm rounded-xl p-3">
                <p className="text-white text-sm text-center">{fullscreenImage}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
