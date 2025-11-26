"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import FabricCanvas from "@/components/FabricCanvas";
import MobileFooter from "@/components/MobileFooter";

const COMFY_BASE = process.env.NEXT_PUBLIC_COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("/api/upload-image", { method: "POST", body: formData });
  const data = await res.json();
  return data.name;
}

export default function CanvasEditPage() {
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundMode, setBackgroundMode] = useState<"upload" | "generate">("upload");
  const [backgroundPrompt, setBackgroundPrompt] = useState("");
  const [generatingBG, setGeneratingBG] = useState(false);

  const [imageFiles, setImageFiles] = useState<(File | null)[]>(Array(7).fill(null));
  const [enableRMBG, setEnableRMBG] = useState<boolean[]>(Array(7).fill(false));

  const [compositeFile, setCompositeFile] = useState<File | null>(null);

  const [positivePrompt, setPositivePrompt] = useState("high quality, detailed composition");
  const [negativePrompt, setNegativePrompt] = useState("blurry, low quality");

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"setup" | "canvas" | "enhance">("setup");
  const [previewImage, setPreviewImage] = useState<File | null>(null);

  function handleImageUpload(index: number, file: File | null) {
    const newFiles = [...imageFiles];
    newFiles[index] = file;
    setImageFiles(newFiles);
  }

  function toggleRMBG(index: number) {
    const newRMBG = [...enableRMBG];
    newRMBG[index] = !newRMBG[index];
    setEnableRMBG(newRMBG);
  }

  async function generateBackground() {
    if (!backgroundPrompt.trim()) {
      alert("Please enter a background prompt!");
      return;
    }

    setGeneratingBG(true);

    try {
      // Translate Turkish to English if needed
      let englishPrompt = backgroundPrompt;
      const hasTurkish = /[ğüşıöçĞÜŞİÖÇ]/.test(backgroundPrompt);

      if (hasTurkish) {
        console.log("🌐 Translating Turkish prompt to English...");
        try {
          const translateRes = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: backgroundPrompt })
          });
          const translateData = await translateRes.json();
          englishPrompt = translateData.translated || backgroundPrompt;
          console.log("✅ Translated:", englishPrompt);
        } catch (err) {
          console.error("Translation failed, using original prompt:", err);
        }
      }

      // Create a proper sized placeholder image (1280x736) with gray background
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 736;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Fill with neutral gray color for better AI generation
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Convert to blob and upload
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png')
      );
      const placeholderFile = new File([blob], "placeholder.png", { type: "image/png" });
      const imageName = await uploadImage(placeholderFile);

      // Use tekqwen to generate background with English prompt
      const formData = new FormData();
      formData.append("prompt", englishPrompt);
      formData.append("imageName", imageName);
      formData.append("steps", "4");
      formData.append("cfg", "1");
      formData.append("width", "1280");
      formData.append("height", "736");
      formData.append("seed", String(Math.floor(Math.random() * 1000000)));

      const res = await fetch("/api/tekqwen/run", { method: "POST", body: formData });
      const data = await res.json();

      if (!data.prompt_id) {
        alert("Failed to start generation");
        return;
      }

      const promptId = data.prompt_id;
      console.log("🎨 Background generation started:", promptId);

      let completed = false;
      const startTime = Date.now();
      const timeout = 120000; // 2 minutes

      while (!completed && (Date.now() - startTime) < timeout) {
        await new Promise(r => setTimeout(r, 3000));

        try {
          const statusRes = await fetch(`/api/canvas-edit/status?prompt_id=${promptId}&_=${Date.now()}`, {
            cache: "no-store"
          });
          const statusData = await statusRes.json();
          console.log("📊 Status:", statusData);

          if (statusData.completed && statusData.images.length > 0) {
            console.log("✅ Background generated:", statusData.images[0]);
            // Use Next.js API route to proxy the image (avoids CORS)
            const proxyUrl = `/api/proxy-image?filename=${encodeURIComponent(statusData.images[0])}`;
            const imgRes = await fetch(proxyUrl);
            const blob = await imgRes.blob();
            const file = new File([blob], statusData.images[0], { type: blob.type });
            setBackgroundFile(file);
            completed = true;
          } else if (statusData.status === "error") {
            throw new Error("ComfyUI generation error");
          }
        } catch (pollErr) {
          console.error("Polling error:", pollErr);
        }
      }

      if (!completed) {
        throw new Error("Timeout - generation took too long");
      }
    } catch (err) {
      console.error(err);
      alert("Background generation failed");
    } finally {
      setGeneratingBG(false);
    }
  }

  async function handleGenerate() {
    if (!compositeFile) {
      alert("Please create a composition first using the canvas!");
      return;
    }

    setLoading(true);

    try {
      // Translate prompts to English if needed
      let englishPositive = positivePrompt;
      let englishNegative = negativePrompt;

      const hasTurkish = /[ğüşıöçĞÜŞİÖÇ]/.test(positivePrompt + negativePrompt);

      if (hasTurkish) {
        console.log("🌐 Translating prompts to English...");
        try {
          const [posRes, negRes] = await Promise.all([
            fetch('/api/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: positivePrompt })
            }),
            fetch('/api/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: negativePrompt })
            })
          ]);

          const [posData, negData] = await Promise.all([posRes.json(), negRes.json()]);
          englishPositive = posData.translated || positivePrompt;
          englishNegative = negData.translated || negativePrompt;
          console.log("✅ Translated positive:", englishPositive);
          console.log("✅ Translated negative:", englishNegative);
        } catch (err) {
          console.error("Translation failed:", err);
        }
      }

      // Upload composite
      const compositeName = await uploadImage(compositeFile);

      // Canvas-edit API
      const formData = new FormData();
      formData.append('backgroundImage', compositeName);
      formData.append('positivePrompt', englishPositive);
      formData.append('negativePrompt', englishNegative);

      const res = await fetch('/api/canvas-edit/run', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        alert('Error: ' + (data.error || 'Unknown error'));
        return;
      }

      const promptId = data.prompt_id;
      let completed = false;
      const startTime = Date.now();

      while (!completed && Date.now() - startTime < 300000) {
        await new Promise(r => setTimeout(r, 3000));

        const statusRes = await fetch(`/api/canvas-edit/status?prompt_id=${promptId}&_=${Date.now()}`, {
          cache: 'no-store'
        });
        const statusData = await statusRes.json();

        if (statusData.completed && statusData.images.length > 0) {
          setResults(statusData.images);
          completed = true;
        }
      }

      if (!completed) {
        alert('Timeout - işlem çok uzun sürdü');
      }
    } catch (err) {
      console.error(err);
      alert('Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-orange-900 to-gray-900 p-4">
      <div className="bg-gradient-to-r from-orange-600 to-red-700 rounded-xl px-6 py-4 text-white shadow-lg mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Canvas AI Edit</h1>
            <p className="text-orange-100 text-xs">AI-Powered Compositor</p>
          </div>
          <Link href="/dashboard">
            <motion.button whileTap={{ scale: 0.9 }} className="px-4 py-2 bg-white/20 rounded-lg text-sm">
              ← Back
            </motion.button>
          </Link>
        </div>
      </div>

      {loading || generatingBG ? (
        <div className="h-96 flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-4"></div>
          <p className="text-white font-semibold">{generatingBG ? "Generating Background..." : "Processing..."}</p>
        </div>
      ) : results.length > 0 ? (
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-lg">Result</h2>
            <button onClick={() => setResults([])} className="text-orange-400 hover:text-orange-300 px-3 py-1">
              ✕ Clear
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {results.map((img, idx) => (
              <div key={idx} className="bg-gray-900 rounded-xl overflow-hidden">
                <img
                  src={`${COMFY_BASE}/view?filename=${img}`}
                  alt="Result"
                  className="w-full object-contain"
                />
                <div className="p-3 flex gap-2">
                  <a
                    href={`${COMFY_BASE}/view?filename=${img}`}
                    download
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-center font-semibold rounded-lg"
                  >
                    📥 Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Tab Navigation */}
          <div className="bg-gray-800 rounded-xl p-2">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("setup")}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === "setup" ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                📋 Setup
              </button>
              <button
                onClick={() => setActiveTab("canvas")}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === "canvas" ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                🎨 Canvas
              </button>
              <button
                onClick={() => setActiveTab("enhance")}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === "enhance" ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                ✨ Enhance
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "setup" && (
            <div className="space-y-3">
              {/* Background Section */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <span className="bg-orange-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                  Background
                </h3>

                {/* Toggle Upload/Generate */}
                <div className="flex gap-2 bg-gray-900 rounded-lg p-1 mb-3">
                  <button
                    onClick={() => setBackgroundMode("upload")}
                    className={`flex-1 py-2 px-3 rounded text-xs font-semibold ${
                      backgroundMode === "upload" ? "bg-orange-600 text-white" : "text-gray-400"
                    }`}
                  >
                    📤 Upload
                  </button>
                  <button
                    onClick={() => setBackgroundMode("generate")}
                    className={`flex-1 py-2 px-3 rounded text-xs font-semibold ${
                      backgroundMode === "generate" ? "bg-orange-600 text-white" : "text-gray-400"
                    }`}
                  >
                    🤖 AI Generate
                  </button>
                </div>

                {backgroundMode === "upload" ? (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setBackgroundFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                      id="background"
                    />
                    <div className="space-y-2">
                      <label
                        htmlFor="background"
                        className="block h-40 w-full border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-orange-500 overflow-hidden bg-gray-900"
                      >
                        <div className="w-full h-full flex items-center justify-center p-2">
                          {backgroundFile ? (
                            <img src={URL.createObjectURL(backgroundFile)} alt="BG" className="max-w-full max-h-full object-contain" />
                          ) : (
                            <span className="text-gray-500">+ Upload Background</span>
                          )}
                        </div>
                      </label>
                      {backgroundFile && (
                        <button
                          onClick={() => setPreviewImage(backgroundFile)}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                        >
                          🔍 View Full Size
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={backgroundPrompt}
                      onChange={(e) => setBackgroundPrompt(e.target.value)}
                      rows={3}
                      placeholder="Describe the background you want... (e.g., 'a sunny beach with palm trees')"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button
                      onClick={generateBackground}
                      disabled={generatingBG || !backgroundPrompt.trim()}
                      className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg disabled:opacity-50 text-sm"
                    >
                      {generatingBG ? "Generating..." : "✨ Generate Background"}
                    </button>
                    {backgroundFile && (
                      <div className="space-y-2">
                        <div className="border border-orange-500 rounded-lg overflow-hidden bg-gray-900">
                          <div className="h-32 flex items-center justify-center p-2">
                            <img src={URL.createObjectURL(backgroundFile)} alt="Generated" className="max-w-full max-h-full object-contain" />
                          </div>
                          <p className="text-orange-400 text-xs p-2">✓ Background generated!</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPreviewImage(backgroundFile)}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                          >
                            🔍 View
                          </button>
                          <a
                            href={URL.createObjectURL(backgroundFile)}
                            download="background.jpg"
                            className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold text-center"
                          >
                            📥 Download
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Overlay Images Section */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <span className="bg-orange-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                  Overlay Images
                </h3>
                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-2 mb-3">
                  <p className="text-blue-400 text-[11px]">
                    💡 <strong>Tip:</strong> Upload PNG images with transparent backgrounds!
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {imageFiles.map((file, idx) => (
                    <div key={idx} className="bg-gray-900 p-2 rounded-lg relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(idx, e.target.files?.[0] ?? null)}
                        className="hidden"
                        id={`img${idx}`}
                      />
                      <label
                        htmlFor={`img${idx}`}
                        className="block h-24 w-full border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-orange-400 overflow-hidden bg-gray-900"
                      >
                        <div className="w-full h-full flex items-center justify-center p-1">
                          {file ? (
                            <img src={URL.createObjectURL(file)} alt={`${idx + 1}`} className="max-w-full max-h-full object-contain" />
                          ) : (
                            <span className="text-gray-500 text-xs">{idx + 1}</span>
                          )}
                        </div>
                      </label>
                      {file && (
                        <button
                          onClick={() => setPreviewImage(file)}
                          className="absolute top-3 right-3 bg-black/70 text-white px-2 py-1 rounded text-xs hover:bg-black"
                        >
                          🔍
                        </button>
                      )}
                      {file && (
                        <div className="mt-2 space-y-1">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={enableRMBG[idx]}
                              onChange={() => toggleRMBG(idx)}
                              className="w-3 h-3"
                            />
                            <span className="text-gray-400 text-[10px]">Remove BG</span>
                          </label>
                          <button
                            onClick={() => handleImageUpload(idx, null)}
                            className="w-full text-red-400 hover:text-red-300 text-xs py-1"
                          >
                            ✕ Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Button */}
              <div className="bg-gray-800 rounded-xl p-4">
                <button
                  onClick={() => setActiveTab("canvas")}
                  disabled={!backgroundFile}
                  className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-700 hover:from-orange-700 hover:to-red-800 disabled:opacity-50 text-white font-bold rounded-xl text-sm"
                >
                  Next: Go to Canvas →
                </button>
                {!backgroundFile && (
                  <p className="text-gray-400 text-xs text-center mt-2">
                    Upload or generate a background first
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "canvas" && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-white font-bold mb-3">Interactive Canvas</h3>
              {backgroundFile ? (
                <FabricCanvas
                  backgroundImage={backgroundFile}
                  overlayImages={imageFiles}
                  enableRMBG={enableRMBG}
                  onCompositeReady={(file) => {
                    setCompositeFile(file);
                    setActiveTab("enhance");
                  }}
                />
              ) : (
                <div className="h-96 bg-gray-900 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-500 mb-2">No background yet</p>
                    <button
                      onClick={() => setActiveTab("setup")}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm"
                    >
                      ← Go to Setup
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "enhance" && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <h3 className="text-white font-bold mb-3">AI Enhancement</h3>

              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 mb-3">
                <p className="text-blue-400 text-sm mb-2">
                  💡 <strong>Tip:</strong> This uses Qwen-Image-Edit with img2img mode
                </p>
                <p className="text-gray-400 text-xs">
                  For individual layer edits, use ✏️ Edit button in Canvas tab.
                </p>
              </div>

              <div>
                <label className="text-white text-sm font-semibold mb-2 block">Positive Prompt</label>
                <textarea
                  value={positivePrompt}
                  onChange={(e) => setPositivePrompt(e.target.value)}
                  rows={2}
                  placeholder="Describe improvements..."
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="text-white text-sm font-semibold mb-2 block">Negative Prompt</label>
                <input
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="What to avoid..."
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {!compositeFile && (
                <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3 mb-3">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ Please create a composition in the Canvas tab first
                  </p>
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerate}
                disabled={!compositeFile || loading}
                className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-700 hover:from-orange-700 hover:to-red-800 text-white font-bold rounded-xl disabled:opacity-50 text-sm"
              >
                🎨 Generate AI Edit
              </motion.button>
            </div>
          )}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <img
              src={URL.createObjectURL(previewImage)}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold"
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}

      <MobileFooter />
    </div>
  );
}
