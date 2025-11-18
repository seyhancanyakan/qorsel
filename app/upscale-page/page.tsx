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

export default function UpscalePage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [resolution, setResolution] = useState(4096);
  const [seed, setSeed] = useState(42);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpscale() {
    if (!imageFile) return;
    setLoading(true);
    setResult(null);

    try {
      const imageName = await uploadImage(imageFile);

      const formData = new FormData();
      formData.append("imageName", imageName);
      formData.append("resolution", String(resolution));
      formData.append("seed", String(seed));

      const res = await fetch("/api/upscale/run", { method: "POST", body: formData });
      const data = await res.json();

      const promptId = data.prompt_id;
      let completed = false;

      while (!completed) {
        await new Promise((r) => setTimeout(r, 3000));
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
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-orange-900 to-gray-900 flex flex-col">
      <div className="bg-gradient-to-r from-green-600 to-blue-600 px-6 py-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Image Upscale</h1>
            <p className="text-green-100 text-xs">4K/8K AI Enhancement</p>
          </div>
          <Link href="/dashboard">
            <motion.button whileTap={{ scale: 0.9 }} className="px-4 py-2 bg-white/20 rounded-lg text-sm">
              ← Back
            </motion.button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-white text-xl font-semibold mb-2">Upscaling...</p>
            <p className="text-gray-400 text-sm">This may take a few minutes</p>
          </div>
        ) : result ? (
          <div className="h-full flex flex-col">
            <h2 className="text-xl font-bold text-white mb-4">Upscaled Result</h2>
            <div className="flex-1 bg-gray-800 rounded-xl overflow-hidden mb-4">
              <img src={`${COMFY_BASE}/view?filename=${result}`} alt="Result" className="w-full h-full object-contain" />
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setResult(null); setImageFile(null); }} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl">
              Upscale Another
            </motion.button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Upload Image to Upscale</label>
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="hidden" id="img" />
              <label htmlFor="img" className="block w-full h-64 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-green-500 overflow-hidden flex items-center justify-center bg-gray-800">
                {imageFile ? (
                  <img src={URL.createObjectURL(imageFile)} alt="Preview" className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    <p className="text-sm">Click to upload</p>
                  </div>
                )}
              </label>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Target Resolution</label>
                <select value={resolution} onChange={(e) => setResolution(Number(e.target.value))} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value={2048}>2K - 2048px</option>
                  <option value={4096}>4K - 4096px</option>
                  <option value={8192}>8K - 8192px</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Seed</label>
                <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>

            <motion.button whileTap={{ scale: 0.98 }} onClick={handleUpscale} disabled={!imageFile} className="w-full py-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold rounded-xl disabled:opacity-50">
              Start Upscale
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
