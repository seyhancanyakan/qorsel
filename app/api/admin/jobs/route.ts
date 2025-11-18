import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    const supabase = await createAdminClient();

    let query = supabase
      .from("jobs")
      .select(`
        *,
        profiles(email, display_name),
        images(*)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (userId) query = query.eq("user_id", userId);
    if (status) query = query.eq("status", status);
    if (type) query = query.eq("type", type);

    const { data: jobs, error } = await query;

    if (error) throw error;

    return NextResponse.json({ jobs }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
