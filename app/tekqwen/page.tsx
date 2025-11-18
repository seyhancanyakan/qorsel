"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const COMFY_BASE = process.env.NEXT_PUBLIC_COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("/api/upload-image", { method: "POST", body: formData });
  const data = await res.json();
  return data.name;
}

export default function TekQwenPage() {
  const [prompt, setPrompt] = useState("Describe what changes you want to make to this image");
  const [imageFile, setImageFile] = useState<File | null>(null);
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
      formData.append("steps", "4");
      formData.append("cfg", "1");
      formData.append("width", "1920");
      formData.append("height", "1080");

      const res = await fetch("/api/tekqwen/run", { method: "POST", body: formData });
      const data = await res.json();

      // Poll for result
      const promptId = data.prompt_id;
      let completed = false;

      while (!completed) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(`/api/qwen-edit/status?prompt_id=${promptId}`);
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
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 text-white">
        <h1 className="text-2xl font-bold">Quick Image Analysis</h1>
        <p className="text-purple-100 text-xs">Single image AI editing</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Your Prompt</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Upload Image</label>
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="hidden" id="img" />
            <label htmlFor="img" className="block w-full h-48 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-purple-500 overflow-hidden">
              {imageFile ? (
                <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              )}
            </label>
          </div>

          <motion.button whileTap={{ scale: 0.98 }} onClick={handleGenerate} disabled={!imageFile || loading} className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl disabled:opacity-50">
            {loading ? "Analyzing..." : "Analyze Image"}
          </motion.button>

          {loading && (
            <div className="flex flex-col items-center py-12">
              <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4"></div>
              <p className="text-white">Processing...</p>
            </div>
          )}

          {result && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-gray-800 rounded-xl overflow-hidden">
              <img src={`${COMFY_BASE}/view?filename=${result}`} alt="Result" className="w-full" />
              <div className="p-4">
                <p className="text-white font-semibold mb-2">Result:</p>
                <p className="text-gray-400 text-sm">{result}</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
