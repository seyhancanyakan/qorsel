"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type User = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  credits: number;
  created_at: string;
};

type Job = {
  id: string;
  user_id: string;
  type: string;
  status: string;
  queue_position: number | null;
  created_at: string;
  profiles: { email: string; display_name: string | null };
};

type Image = {
  id: string;
  filename: string;
  storage_path: string;
  type: string;
  created_at: string;
  profiles: { email: string; display_name: string | null };
};

type Stats = {
  totalUsers: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalImages: number;
  successRate: string;
};

export default function AdminPage() {
  const [currentTab, setCurrentTab] = useState<"users" | "jobs" | "images" | "stats">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState(0);
  const [editRole, setEditRole] = useState("");

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAdmin();
    loadData();
    const interval = setInterval(() => {
      if (currentTab === "jobs") loadJobs();
    }, 3000);
    return () => clearInterval(interval);
  }, [currentTab]);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      router.push("/");
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      if (currentTab === "users") await loadUsers();
      else if (currentTab === "jobs") await loadJobs();
      else if (currentTab === "images") await loadImages();
      else if (currentTab === "stats") await loadStats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
  }

  async function loadJobs() {
    const res = await fetch("/api/admin/jobs");
    const data = await res.json();
    setJobs(data.jobs || []);
  }

  async function loadImages() {
    const res = await fetch("/api/admin/images");
    const data = await res.json();
    setImages(data.images || []);
  }

  async function loadStats() {
    const res = await fetch("/api/admin/stats");
    const data = await res.json();
    setStats(data.stats || null);
  }

  async function handleUpdateUser(userId: string) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, credits: editCredits, role: editRole }),
      });

      if (!res.ok) throw new Error("Update failed");

      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Delete this user?")) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) throw new Error("Delete failed");

      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-orange-900 to-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Super Admin</h1>
            <p className="text-purple-100 text-xs">Platform Management</p>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleLogout} className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-semibold">
            Logout
          </motion.button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden bg-gray-900">
        <AnimatePresence mode="wait">
          {/* Users Tab */}
          {currentTab === "users" && (
            <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-4 overflow-auto">
              <h2 className="text-xl font-bold text-white mb-4">Users Management</h2>

              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div key={user.id} className="bg-gray-800/50 rounded-xl p-4">
                      {editingUser === user.id ? (
                        <div className="space-y-3">
                          <input type="number" value={editCredits} onChange={(e) => setEditCredits(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm" placeholder="Credits" />
                          <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm">
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                          <div className="flex gap-2">
                            <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleUpdateUser(user.id)} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold">
                              Save
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setEditingUser(null)} className="flex-1 py-2 bg-gray-700 text-white rounded-lg text-sm">
                              Cancel
                            </motion.button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-white font-semibold">{user.display_name || user.email}</p>
                              <p className="text-gray-400 text-xs">{user.email}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.role === "admin" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"}`}>
                              {user.role}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
                            <span>Credits: {user.credits}</span>
                            <span>{new Date(user.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex gap-2">
                            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setEditingUser(user.id); setEditCredits(user.credits); setEditRole(user.role); }} className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm">
                              Edit
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleDeleteUser(user.id)} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm">
                              Delete
                            </motion.button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Jobs Tab */}
          {currentTab === "jobs" && (
            <motion.div key="jobs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-4 overflow-auto">
              <h2 className="text-xl font-bold text-white mb-4">All Jobs (Real-time)</h2>

              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <div key={job.id} className="bg-gray-800/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-white font-semibold text-sm">{job.profiles?.display_name || job.profiles?.email}</p>
                          <p className="text-gray-400 text-xs">{job.type}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          job.status === "completed" ? "bg-green-500/20 text-green-400" :
                          job.status === "processing" ? "bg-blue-500/20 text-blue-400" :
                          job.status === "queued" ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-red-500/20 text-red-400"
                        }`}>
                          {job.status}
                          {job.queue_position && ` (#${job.queue_position})`}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs">{new Date(job.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Images Tab */}
          {currentTab === "images" && (
            <motion.div key="images" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-4 overflow-auto">
              <h2 className="text-xl font-bold text-white mb-4">All Images</h2>

              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {images.map((img) => (
                    <div key={img.id} className="bg-gray-800/50 rounded-xl overflow-hidden">
                      <div className="aspect-video bg-gray-700 flex items-center justify-center">
                        <p className="text-gray-500 text-xs">Image Preview</p>
                      </div>
                      <div className="p-2">
                        <p className="text-white text-xs font-semibold truncate">{img.filename}</p>
                        <p className="text-gray-400 text-xs">{img.profiles?.display_name || img.profiles?.email}</p>
                        <p className="text-gray-500 text-xs">{img.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Stats Tab */}
          {currentTab === "stats" && (
            <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-4 overflow-auto">
              <h2 className="text-xl font-bold text-white mb-4">Platform Analytics</h2>

              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                </div>
              ) : stats && (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Total Users", value: stats.totalUsers, icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", color: "purple" },
                    { label: "Total Jobs", value: stats.totalJobs, icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", color: "blue" },
                    { label: "Completed", value: stats.completedJobs, icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", color: "green" },
                    { label: "Failed", value: stats.failedJobs, icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z", color: "red" },
                    { label: "Total Images", value: stats.totalImages, icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", color: "pink" },
                    { label: "Success Rate", value: `${stats.successRate}%`, icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", color: "yellow" },
                  ].map((stat, idx) => (
                    <motion.div key={idx} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.1 }} className={`bg-gradient-to-br from-${stat.color}-600/20 to-${stat.color}-800/20 border border-${stat.color}-500/30 rounded-xl p-4`}>
                      <div className="flex items-center justify-between mb-2">
                        <svg className={`w-8 h-8 text-${stat.color}-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                        </svg>
                      </div>
                      <p className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</p>
                      <p className="text-gray-400 text-xs">{stat.label}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-gray-900 border-t border-gray-800 px-6 py-3 flex justify-around">
        {[
          { id: "users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", label: "Users" },
          { id: "jobs", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", label: "Jobs" },
          { id: "images", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", label: "Images" },
          { id: "stats", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", label: "Stats" },
        ].map((tab) => (
          <motion.button
            key={tab.id}
            whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentTab(tab.id as any)}
            className={`flex flex-col items-center space-y-1 ${currentTab === tab.id ? "text-purple-400" : "text-gray-500"}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            <span className="text-xs">{tab.label}</span>
          </motion.button>
        ))}
      </div>

      {error && (
        <div className="fixed top-4 right-4 bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-300 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
