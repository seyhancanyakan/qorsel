import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createAdminClient();

    const [
      { count: totalUsers },
      { count: totalJobs },
      { count: completedJobs },
      { count: failedJobs },
      { count: totalImages },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("jobs").select("*", { count: "exact", head: true }),
      supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "failed"),
      supabase.from("images").select("*", { count: "exact", head: true }),
    ]);

    const successRate = totalJobs ? ((completedJobs || 0) / totalJobs) * 100 : 0;

    return NextResponse.json({
      stats: {
        totalUsers: totalUsers || 0,
        totalJobs: totalJobs || 0,
        completedJobs: completedJobs || 0,
        failedJobs: failedJobs || 0,
        totalImages: totalImages || 0,
        successRate: successRate.toFixed(1),
      },
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
