"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
      }
    });
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl flex items-center justify-center shadow-2xl">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-5xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
          AI Studio
        </h1>
        <p className="text-xl text-gray-300 mb-2">Professional AI Image Generation</p>
        <p className="text-gray-400">Powered by Qwen Vision & SeedVR2</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-4 w-full max-w-sm">
        {user ? (
          <>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => router.push("/dashboard")} className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg">
              Go to Dashboard
            </motion.button>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => router.push("/qwen-edit")} className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl">
              Generate Images
            </motion.button>
          </>
        ) : (
          <>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => router.push("/login")} className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg">
              Sign In
            </motion.button>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => router.push("/signup")} className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl">
              Create Account
            </motion.button>
          </>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-12 grid grid-cols-3 gap-8 text-center">
        {[
          { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "Ultra Fast", desc: "4-step generation" },
          { icon: "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4", label: "4K/8K Upscale", desc: "Pro quality" },
          { icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", label: "Multi-User", desc: "Team ready" },
        ].map((feature, idx) => (
          <div key={idx} className="text-gray-400">
            <svg className="w-8 h-8 mx-auto mb-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
            </svg>
            <p className="text-white font-semibold text-sm">{feature.label}</p>
            <p className="text-xs">{feature.desc}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
