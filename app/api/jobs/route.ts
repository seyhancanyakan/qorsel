import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch jobs for the user, ordered by creation date (newest first)
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50); // Limit to last 50 jobs

    if (jobsError) {
      console.error("Jobs fetch error:", jobsError);
      return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
    }

    // Fetch images for the user, ordered by creation date (newest first)
    const { data: images, error: imagesError } = await supabase
      .from("images")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100); // Limit to last 100 images

    if (imagesError) {
      console.error("Images fetch error:", imagesError);
      return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
    }

    return NextResponse.json({
      jobs: jobs || [],
      images: images || [],
    });
  } catch (error: any) {
    console.error("Jobs API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
