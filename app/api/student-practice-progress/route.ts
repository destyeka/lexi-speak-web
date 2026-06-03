import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type PracticeProgressPayload = {
  latest_score: number;
  progress_percent: number;
  speaking_attempts: number;
  last_activity_at: string;
  last_unit_index: number | null;
  last_part_index: number;
  notes: string | null;
  metrics: Array<{
    id: string;
    label: string;
    score: number;
    text: string;
  }>;
  assignment_id?: string | null;
  analysis?: Record<string, unknown> | null;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const accessToken = authorization.toLowerCase().startsWith("bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    const body = (await request.json()) as Partial<PracticeProgressPayload>;
    const latestScore = Number(body.latest_score);
    const progressPercent = Number(body.progress_percent);
    const attemptIncrement = Math.max(Number(body.speaking_attempts ?? 1) || 1, 1);
    const lastActivityAt = body.last_activity_at;
    const lastUnitIndex =
      body.last_unit_index === null || body.last_unit_index === undefined
        ? null
        : Number(body.last_unit_index);
    const lastPartIndex = Number(body.last_part_index);
    const notes = body.notes ?? null;
    const metrics = Array.isArray(body.metrics) ? body.metrics : [];
    console.log(
      "API RECEIVED METRICS",
      JSON.stringify(metrics, null, 2)
    );
    const assignmentId = typeof body.assignment_id === "string" ? body.assignment_id : null;
    const analysis = body.analysis && typeof body.analysis === "object" ? body.analysis : null;

    if (!Number.isFinite(latestScore) || !Number.isFinite(progressPercent) || !Number.isFinite(lastPartIndex) || !lastActivityAt) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient(accessToken);
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const studentId = userData.user.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", studentId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (profile?.role !== "user") {
      return NextResponse.json({ error: "Only student accounts can record practice progress" }, { status: 403 });
    }

    const { error: rpcError } = await supabase.rpc("record_student_practice_progress", {
      latest_score: latestScore,
      progress_percent: progressPercent,
      speaking_attempts: attemptIncrement,
      last_activity_at: lastActivityAt,
      last_unit_index: lastUnitIndex,
      last_part_index: lastPartIndex,
      notes,
      metrics,
    });

    if (!rpcError) {
      console.log("RPC SUCCESS");
      return NextResponse.json({ ok: true, mode: "rpc" });
    }

    console.log("RPC FAILED", rpcError);

    const { data: existingProgress, error: progressReadError } = await supabase
      .from("student_progress")
      .select("speaking_attempts")
      .eq("student_id", studentId)
      .maybeSingle();

    if (progressReadError) {
      return NextResponse.json({ error: progressReadError.message }, { status: 500 });
    }

    const nextAttempts = (existingProgress?.speaking_attempts ?? 0) + attemptIncrement;

    const { error: progressWriteError } = await supabase.from("student_progress").upsert(
      {
        student_id: studentId,
        latest_score: latestScore,
        progress_percent: progressPercent,
        speaking_attempts: nextAttempts,
        last_activity_at: lastActivityAt,
        last_unit_index: lastUnitIndex,
        last_part_index: lastPartIndex,
        notes,
        updated_at: lastActivityAt,
        updated_by: studentId,
      },
      { onConflict: "student_id" }
    );

    if (progressWriteError) {
      return NextResponse.json({ error: progressWriteError.message }, { status: 500 });
    }

    // If assignmentId is provided, also upsert the assignment_submissions row
    if (assignmentId) {
      try {
        // Use recorded_at from student_score_history if available to avoid timestamp regressions
        let submittedAt = new Date().toISOString();
        try {
          const { data: latestScoreRow, error: scoreError } = await supabase
            .from("student_score_history")
            .select("recorded_at")
            .eq("student_id", studentId)
            .order("recorded_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!scoreError && latestScoreRow?.recorded_at) {
            submittedAt = latestScoreRow.recorded_at;
          }
        } catch (e) {
          // ignore
        }

        const { error: submissionError } = await supabase
          .from("assignment_submissions")
          .upsert([
            {
              assignment_id: assignmentId,
              student_id: studentId,
              status: "submitted",
              submitted_at: submittedAt,
              updated_at: submittedAt,
              score: latestScore,
              metrics,
              analysis,
            },
          ], { onConflict: "assignment_id,student_id" });
        if (submissionError) {
          const msg = String(submissionError.message || submissionError);
          if (msg.includes("column \"analysis\" does not exist") || msg.includes("42703")) {
            await supabase
              .from("assignment_submissions")
              .upsert([
                {
                  assignment_id: assignmentId,
                  student_id: studentId,
                  status: "submitted",
                  submitted_at: submittedAt,
                  updated_at: submittedAt,
                  score: latestScore,
                  metrics,
                },
              ], { onConflict: "assignment_id,student_id" });
          } else {
            console.error("Failed to upsert assignment_submissions:", submissionError.message || submissionError);
          }
        }
      } catch (e) {
        console.error("Error while upserting assignment_submissions:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      mode: "fallback",
      warning: rpcError.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}