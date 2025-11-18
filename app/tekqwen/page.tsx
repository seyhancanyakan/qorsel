"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

const COMFY_BASE = process.env.NEXT_PUBLIC_COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("/api/upload-image", { method: "POST", body: formData });
  const data = await res.json();
  return data.name;
}

export default function TekQwenPage() {
  const [prompt, setPrompt] = useState("İstediğin değişikliği yaz");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [steps, setSteps] = useState(4);
  const [cfg, setCfg] = useState(1);
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [seed, setSeed] = useState(42);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (!imageFile) return;
    setLoading(true);
    setResult(null);

    try {
      const imageName = await uploadImage(imageFile);

      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("imageName", imageName);
      formData.append("steps", String(steps));
      formData.append("cfg", String(cfg));
      formData.append("width", String(width));
      formData.append("height", String(height));
      formData.append("seed", String(seed));

      const res = await fetch("/api/tekqwen/run", { method: "POST", body: formData });
      const data = await res.json();

      const promptId = data.prompt_id;
      let completed = false;

      while (!completed) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(`/api/qwen-edit/status?prompt_id=${promptId}&_=${Date.now()}`, { cache: "no-store" });
        const statusData = await statusRes.json();

        if (statusData.completed && statusData.images.length > 0) {
          setResult(statusData.images[0]);
          completed = true;
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tek Resim Analiz</h1>
            <p className="text-purple-100 text-xs">Hızlı AI düzenleme</p>
          </div>
          <Link href="/dashboard">
            <motion.button whileTap={{ scale: 0.9 }} className="px-4 py-2 bg-white/20 rounded-lg text-sm">
              ← Geri
            </motion.button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-white text-xl font-semibold mb-2">Analyzing...</p>
            <p className="text-gray-400 text-sm">Please wait</p>
          </div>
        ) : result ? (
          <div className="h-full flex flex-col">
            <h2 className="text-xl font-bold text-white mb-4">Result</h2>
            <div className="flex-1 bg-gray-800 rounded-xl overflow-hidden mb-4">
              <img src={`${COMFY_BASE}/view?filename=${result}`} alt="Result" className="w-full h-full object-contain" />
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setResult(null); setImageFile(null); }} className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl">
              Analyze Another
            </motion.button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Prompt</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Resim Yükle</label>
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="hidden" id="img" />
              <label htmlFor="img" className="block w-full h-48 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-purple-500 overflow-hidden flex items-center justify-center bg-gray-800">
                {imageFile ? (
                  <img src={URL.createObjectURL(imageFile)} alt="Preview" className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <p className="text-sm">Click to upload</p>
                  </div>
                )}
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Steps", value: steps, setter: setSteps },
                { label: "CFG", value: cfg, setter: setCfg, step: 0.1 },
                { label: "Width", value: width, setter: setWidth },
                { label: "Height", value: height, setter: setHeight },
                { label: "Seed", value: seed, setter: setSeed },
              ].map((p, idx) => (
                <div key={idx} className={idx === 4 ? "col-span-2" : ""}>
                  <label className="block text-xs text-gray-400 mb-1">{p.label}</label>
                  <input type="number" step={p.step} value={p.value} onChange={(e) => p.setter(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              ))}
            </div>

            <motion.button whileTap={{ scale: 0.98 }} onClick={handleGenerate} disabled={!imageFile} className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl disabled:opacity-50">
              Analyze Image
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
