import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const COMFY_BASE = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type, parameters } = body;

    // Check ComfyUI queue
    const queueRes = await fetch(`${COMFY_BASE}/queue`);
    const queueData = await queueRes.json();

    const isQueueBusy = queueData.queue_running?.length > 0 || queueData.queue_pending?.length > 0;
    const queuePosition = isQueueBusy ? queueData.queue_pending?.length + 1 : null;

    // Create job in database
    const { data: job, error: dbError } = await supabase
      .from("jobs")
      .insert({
        user_id: user.id,
        type,
        status: isQueueBusy ? "queued" : "processing",
        queue_position: queuePosition,
        parameters,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ job }, { status: 200 });
  } catch (err: any) {
    console.error("Create job error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
