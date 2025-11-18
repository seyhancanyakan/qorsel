"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Profile, Job, Image } from "@/lib/types/database";
import Link from "next/link";

const COMFY_BASE = process.env.NEXT_PUBLIC_COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

// Animated status icons
const StatusIcon = ({ status }: { status: Job['status'] }) => {
  switch (status) {
    case 'queued':
      return (
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-3 h-3 bg-purple-500 rounded-full"
        />
      );
    case 'processing':
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-5 h-5"
        >
          <svg className="w-full h-full text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </motion.div>
      );
    case 'completed':
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-5 h-5 text-green-500"
        >
          <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      );
    case 'failed':
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-5 h-5 text-red-500"
        >
          <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.div>
      );
  }
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAuth();
    fetchData();
    setupRealtimeSubscriptions();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }
  }

  async function fetchData() {
    try {
      setLoading(true);

      // Fetch profile
      const profileRes = await fetch("/api/profile");
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
      }

      // Fetch jobs
      const jobsRes = await fetch("/api/jobs");
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData.jobs || []);
        setImages(jobsData.images || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  function setupRealtimeSubscriptions() {
    // Subscribe to jobs table changes
    const jobsChannel = supabase
      .channel('jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs'
        },
        (payload) => {
          console.log('Job change received:', payload);
          fetchData(); // Refetch data on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobsChannel);
    };
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function downloadImage(filename: string) {
    const link = document.createElement("a");
    link.href = `/api/download-image?filename=${encodeURIComponent(filename)}`;
    link.download = filename;
    link.click();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-purple-100 text-xs">Welcome back, {profile?.display_name || profile?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold">
              {profile?.credits || 0} Credits
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {(profile?.display_name || profile?.email || "U")[0].toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{profile?.display_name || "User"}</h2>
                <p className="text-gray-400 text-sm">{profile?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    profile?.role === 'admin'
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}>
                    {profile?.role || 'user'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Link href="/qwen-edit">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-semibold rounded-xl"
                >
                  Multi-Image
                </motion.button>
              </Link>
              <Link href="/tekqwen">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs font-semibold rounded-xl"
                >
                  Quick Edit
                </motion.button>
              </Link>
              <Link href="/upscale-page">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white text-xs font-semibold rounded-xl"
                >
                  Upscale
                </motion.button>
              </Link>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl"
            >
              Logout
            </motion.button>
          </div>

          {profile?.role === 'admin' && (
            <Link href="/admin">
              <motion.button
                whileTap={{ scale: 0.95 }}
                className="w-full mt-3 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-xl"
              >
                Admin Panel
              </motion.button>
            </Link>
          )}
        </motion.div>

        {/* Job History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700"
        >
          <h2 className="text-xl font-bold text-white mb-4">Job History</h2>

          {jobs.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-gray-400">No jobs yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job, idx) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <StatusIcon status={job.status} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold capitalize">{job.type}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            job.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                            job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                            'bg-purple-500/20 text-purple-400'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs mt-1">
                          {new Date(job.created_at).toLocaleString()}
                        </p>
                        {job.error_message && (
                          <p className="text-red-400 text-xs mt-1">{job.error_message}</p>
                        )}
                      </div>
                    </div>
                    {job.queue_position !== null && job.status === 'queued' && (
                      <div className="px-3 py-1 bg-purple-500/20 rounded-full">
                        <span className="text-purple-400 text-xs font-semibold">
                          #{job.queue_position} in queue
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Image Gallery */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700"
        >
          <h2 className="text-xl font-bold text-white mb-4">
            Image Gallery ({images.length})
          </h2>

          {images.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-400">No images yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {images.map((img, idx) => (
                <motion.div
                  key={img.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative bg-gray-800/50 rounded-xl overflow-hidden aspect-video cursor-pointer group"
                  onClick={() => setFullscreenImage(img.comfy_filename || img.filename)}
                >
                  <img
                    src={`${COMFY_BASE}/view?filename=${img.comfy_filename || img.filename}`}
                    alt={img.filename}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadImage(img.comfy_filename || img.filename);
                      }}
                      className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </motion.button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-white text-xs truncate">{img.filename}</p>
                    {img.type && (
                      <span className="text-xs text-purple-300 capitalize">{img.type}</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Fullscreen Image Modal */}
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
                  className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
    </div>
  );
}
