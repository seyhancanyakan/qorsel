import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    const supabase = await createAdminClient();

    let query = supabase
      .from("images")
      .select(`
        *,
        profiles(email, display_name),
        jobs(type, status)
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (userId) query = query.eq("user_id", userId);

    const { data: images, error } = await query;

    if (error) throw error;

    return NextResponse.json({ images }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { imageIds } = await req.json();
    const supabase = await createAdminClient();

    const { error } = await supabase
      .from("images")
      .delete()
      .in("id", imageIds);

    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
