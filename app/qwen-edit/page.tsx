"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COMFY_BASE = process.env.NEXT_PUBLIC_COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

async function uploadImageToComfy(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("/api/upload-image", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.name;
}

async function downloadImage(filename: string) {
  const link = document.createElement("a");
  link.href = `/api/download-image?filename=${encodeURIComponent(filename)}`;
  link.download = filename;
  link.click();
}

export default function QwenEditPage() {
  const [prompt1, setPrompt1] = useState("They are holding hands, getting married. Wedding photography, pixar style.");
  const [prompt2, setPrompt2] = useState("Create an extreme close up of the faces. The characters are kissing. Their eyes are closed.");
  const [steps, setSteps] = useState(4);
  const [cfg, setCfg] = useState(1);
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);

  const [image1File, setImage1File] = useState<File | null>(null);
  const [image2File, setImage2File] = useState<File | null>(null);
  const [image3File, setImage3File] = useState<File | null>(null);
  const [image4File, setImage4File] = useState<File | null>(null);

  const [promptId, setPromptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("idle");
  const [resultImages, setResultImages] = useState<string[]>([]);

  const [showUpscaleModal, setShowUpscaleModal] = useState(false);
  const [upscaleResolution, setUpscaleResolution] = useState(4096);
  const [upscaleSeed, setUpscaleSeed] = useState(42);
  const [upscaledImages, setUpscaledImages] = useState<string[]>([]);
  const [upscaleProgress, setUpscaleProgress] = useState(0);
  const [isUpscaling, setIsUpscaling] = useState(false);

  const [currentView, setCurrentView] = useState<"home" | "results" | "settings">("home");
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    if (!promptId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/qwen-edit/status?prompt_id=${promptId}&_=${Date.now()}`, {
          cache: "no-store"
        });
        const data = await res.json();
        console.log("Polling result:", data);
        setJobStatus(data.status);
        if (data.completed && data.images.length > 0) {
          setResultImages(data.images);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [promptId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPromptId(null);
    setJobStatus("idle");
    setResultImages([]);
    setUpscaledImages([]);

    try {
      let image1Name = "", image2Name = "", image3Name = "", image4Name = "";

      if (image1File) image1Name = await uploadImageToComfy(image1File);
      if (image2File) image2Name = await uploadImageToComfy(image2File);
      if (image3File) image3Name = await uploadImageToComfy(image3File);
      if (image4File) image4Name = await uploadImageToComfy(image4File);

      const formData = new FormData();
      formData.append("prompt1", prompt1);
      formData.append("prompt2", prompt2);
      formData.append("steps", String(steps));
      formData.append("cfg", String(cfg));
      formData.append("width", String(width));
      formData.append("height", String(height));

      if (image1Name) formData.append("image1Name", image1Name);
      if (image2Name) formData.append("image2Name", image2Name);
      if (image3Name) formData.append("image3Name", image3Name);
      if (image4Name) formData.append("image4Name", image4Name);

      const res = await fetch("/api/qwen-edit/run", { method: "POST", body: formData });
      if (!res.ok) throw new Error("API error");

      const data = await res.json();
      setPromptId(data.prompt_id ?? null);
      setJobStatus("running");
    } catch (err: any) {
      setError(String(err?.message ?? err));
    }
  }

  async function handleUpscaleAll() {
    if (resultImages.length === 0) return;
    setShowUpscaleModal(false);
    setIsUpscaling(true);
    setUpscaleProgress(0);
    setUpscaledImages([]);

    try {
      const upscaledResults: string[] = [];

      for (let i = 0; i < resultImages.length; i++) {
        const imageName = resultImages[i];
        setUpscaleProgress(Math.round(((i + 1) / resultImages.length) * 100));

        const formData = new FormData();
        formData.append("imageName", imageName);
        formData.append("resolution", String(upscaleResolution));
        formData.append("seed", String(upscaleSeed));

        const res = await fetch("/api/upscale/run", { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Upscale failed`);

        const data = await res.json();
        const upscalePromptId = data.prompt_id;

        let completed = false;
        while (!completed) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          const statusRes = await fetch(`/api/qwen-edit/status?prompt_id=${upscalePromptId}`);
          const statusData = await statusRes.json();

          if (statusData.completed && statusData.images.length > 0) {
            upscaledResults.push(...statusData.images);
            completed = true;
          }
        }
      }

      setUpscaledImages(upscaledResults);
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setIsUpscaling(false);
      setUpscaleProgress(0);
    }
  }

  const displayImages = upscaledImages.length > 0 ? upscaledImages : resultImages;

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Studio</h1>
            <p className="text-blue-100 text-xs">Qwen Vision AI</p>
          </div>
          {upscaledImages.length > 0 && (
            <span className="px-3 py-1 bg-blue-500/30 rounded-full text-xs font-semibold">Upscaled</span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden bg-gray-900">
        {currentView === "home" && (
          <div className="h-full p-4">
            {promptId && resultImages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="relative w-24 h-24 mb-6">
                  <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
                </div>
                <p className="text-white text-xl font-semibold mb-2">Generating Images...</p>
                <p className="text-gray-400 text-sm">{jobStatus}</p>
                <div className="w-64 h-2 bg-gray-700 rounded-full mt-6 overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" animate={{ x: ["-100%", "100%"] }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} style={{ width: "50%" }} />
                </div>
              </div>
            ) : resultImages.length > 0 ? (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Results Ready!</h2>
                    <p className="text-green-400 text-sm">{resultImages.length} images</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setCurrentView("results")} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold rounded-xl shadow-lg">
                    View All →
                  </motion.button>
                </div>

                <div className="flex-1 overflow-auto mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    {resultImages.map((img, idx) => (
                      <motion.div key={idx} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.15 }} className="relative bg-gray-800/50 rounded-xl overflow-hidden shadow-lg aspect-video cursor-pointer" onClick={() => setFullscreenImage(img)}>
                        <img src={`${COMFY_BASE}/view?filename=${img}`} alt={`Result ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              downloadImage(img);
                            }}
                            className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullscreenImage(img);
                            }}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={async () => {
                      // Supabase'e kaydet
                      try {
                        const res = await fetch('/api/qwen-edit/save-to-gallery', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            promptId,
                            images: resultImages
                          })
                        });
                        if (res.ok) {
                          alert('Görseller galeriye kaydedildi!');
                        }
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="w-full py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg"
                  >
                    💾 Galeriye Kaydet
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setResultImages([]); setPromptId(null); setJobStatus("idle"); }} className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl">
                    Generate New
                  </motion.button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="h-full flex flex-col">
                <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
                  <div className="space-y-2">
                    <div className="bg-gray-800/50 rounded-xl p-3">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Main Scene</label>
                      <textarea value={prompt1} onChange={(e) => setPrompt1(e.target.value)} rows={2} className="w-full px-2 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>

                    <div className="bg-gray-800/50 rounded-xl p-3">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Close-up</label>
                      <textarea value={prompt2} onChange={(e) => setPrompt2(e.target.value)} rows={2} className="w-full px-2 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Steps", value: steps, setter: setSteps },
                        { label: "CFG", value: cfg, setter: setCfg, step: 0.1 },
                        { label: "Width", value: width, setter: setWidth },
                        { label: "Height", value: height, setter: setHeight },
                      ].map((p, idx) => (
                        <div key={idx} className="bg-gray-800/50 rounded-lg p-2">
                          <label className="block text-xs text-gray-400 mb-1">{p.label}</label>
                          <input type="number" step={p.step} value={p.value} onChange={(e) => p.setter(Number(e.target.value))} className="w-full px-2 py-1 bg-gray-700/50 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { file: image1File, setFile: setImage1File, label: "Img 1", req: true },
                      { file: image2File, setFile: setImage2File, label: "Img 2", req: true },
                      { file: image3File, setFile: setImage3File, label: "Img 3" },
                      { file: image4File, setFile: setImage4File, label: "Pose" },
                    ].map((item, idx) => (
                      <div key={idx}>
                        <label className="block text-xs text-gray-400 mb-1">{item.label} {item.req && <span className="text-red-400">*</span>}</label>
                        <input type="file" accept="image/*" onChange={(e) => item.setFile(e.target.files?.[0] ?? null)} className="hidden" id={`f${idx}`} />
                        <label htmlFor={`f${idx}`} className="block w-full h-28 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-purple-500 transition-all overflow-hidden">
                          {item.file ? (
                            <img src={URL.createObjectURL(item.file)} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-600">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <motion.button whileTap={{ scale: 0.98 }} type="submit" className="mt-3 w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg">
                  Generate Images
                </motion.button>

                {error && <div className="mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-xs">{error}</div>}
              </form>
            )}
          </div>
        )}

        {currentView === "results" && (
          <div className="h-full flex flex-col p-4">
            {displayImages.length > 0 && !isUpscaling ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-xl font-bold text-white">{displayImages.length} Images</h2>
                    <p className="text-gray-400 text-xs">{upscaledImages.length > 0 ? "Upscaled" : "Generated"}</p>
                  </div>
                  {!upscaledImages.length && (
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowUpscaleModal(true)} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-lg flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                      <span>Upscale</span>
                    </motion.button>
                  )}
                </div>

                <div className="flex-1 overflow-auto">
                  <div className="grid grid-cols-2 gap-3 pb-4">
                    {displayImages.map((img, idx) => (
                      <motion.div key={idx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.1 }} className="relative bg-gray-800/50 rounded-xl overflow-hidden aspect-video cursor-pointer" onClick={() => setFullscreenImage(img)}>
                        <img src={`${COMFY_BASE}/view?filename=${img}`} alt={`Result ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              downloadImage(img);
                            }}
                            className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullscreenImage(img);
                            }}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                          </motion.button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-white text-xs truncate">{img}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </>
            ) : isUpscaling ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="relative w-24 h-24 mb-4">
                  <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white font-bold">{upscaleProgress}%</span>
                  </div>
                </div>
                <p className="text-white font-semibold mb-2">Upscaling...</p>
                <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${upscaleProgress}%` }} />
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-20 h-20 mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm">No images</p>
              </div>
            )}
          </div>
        )}

        {currentView === "settings" && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mb-4 mx-auto rounded-full bg-gray-800 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-400">Settings</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="bg-gray-900 border-t border-gray-800 px-6 py-3 flex justify-around">
        {[
          { id: "home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", label: "Home" },
          { id: "results", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", label: "Gallery", badge: resultImages.length },
          { id: "settings", icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4", label: "Settings" },
        ].map((item) => (
          <motion.button
            key={item.id}
            whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentView(item.id as any)}
            className={`flex flex-col items-center space-y-1 relative transition-colors ${currentView === item.id ? "text-purple-400" : "text-gray-500"}`}
          >
            {item.badge && item.badge > 0 && (
              <div className="absolute -top-1 right-0 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{item.badge}</span>
              </div>
            )}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            <span className="text-xs">{item.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Fullscreen Image Modal */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setFullscreenImage(null)}>
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img src={`${COMFY_BASE}/view?filename=${fullscreenImage}`} alt="Fullscreen" className="max-w-full max-h-full object-contain" />

              <div className="absolute top-4 right-4 flex gap-2">
                <motion.button whileTap={{ scale: 0.9 }} onClick={async (e) => { e.stopPropagation(); downloadImage(fullscreenImage); }} className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); }} className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full shadow-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Upscale Modal */}
      <AnimatePresence>
        {showUpscaleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowUpscaleModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()} className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-700 shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4">Upscale Settings</h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Resolution</label>
                  <select value={upscaleResolution} onChange={(e) => setUpscaleResolution(Number(e.target.value))} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <option value={2048}>2K - 2048px</option>
                    <option value={4096}>4K - 4096px</option>
                    <option value={8192}>8K - 8192px</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Seed</label>
                  <input type="number" value={upscaleSeed} onChange={(e) => setUpscaleSeed(Number(e.target.value))} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-blue-300 text-xs">
                    <strong>Note:</strong> Will upscale {resultImages.length} image(s). May take several minutes.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowUpscaleModal(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl">
                  Cancel
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleUpscaleAll} className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl">
                  Start Upscale
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
