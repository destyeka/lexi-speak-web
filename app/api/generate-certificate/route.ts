import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

interface GenerateCertificatePayload {
  assignment_id: string;
  certificate_name: string;
  file_path?: string | null;
}

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

    const body = (await request.json()) as GenerateCertificatePayload;
    const assignmentId = body.assignment_id;
    const certificateName = body.certificate_name?.trim();

    if (!assignmentId || !certificateName) {
      return NextResponse.json({ error: "assignment_id and certificate_name are required" }, { status: 400 });
    }

    // Use client with access token to verify user auth
    const supabase = getSupabaseServerClient(accessToken);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const studentId = userData.user.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, certificate_name, last_cert_name_update")
      .eq("id", studentId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!profile || profile.role !== "user") {
      return NextResponse.json({ error: "Only student accounts can generate certificates" }, { status: 403 });
    }

    if (profile.certificate_name && profile.certificate_name !== certificateName) {
      // Allow change once per calendar day (server local date). Compare date components in server timezone.
      const lastUpdateDate = profile.last_cert_name_update ? new Date(profile.last_cert_name_update) : null;
      const now = new Date();
      if (
        lastUpdateDate &&
        lastUpdateDate.getFullYear() === now.getFullYear() &&
        lastUpdateDate.getMonth() === now.getMonth() &&
        lastUpdateDate.getDate() === now.getDate()
      ) {
        return NextResponse.json({ error: "Certificate name may only be changed once per day" }, { status: 429 });
      }
    }

    const { data: submission, error: submissionError } = await supabase
      .from("assignment_submissions")
      .select("score, status")
      .eq("assignment_id", assignmentId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (submissionError) {
      return NextResponse.json({ error: submissionError.message }, { status: 500 });
    }

    if (!submission || submission.status !== "submitted" || submission.score === null) {
      return NextResponse.json({ error: "Completed assignment submission with score is required to generate a certificate" }, { status: 400 });
    }

    // Update profile to track certificate name history
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        certificate_name: certificateName,
        last_cert_name_update: new Date().toISOString(),
      })
      .eq("id", studentId);

    if (profileUpdateError) {
      console.error("[generate-certificate] Profile update error:", profileUpdateError);
      return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
    }

    // Return approval - client will handle certificate generation and storage upload
    return NextResponse.json({
      ok: true,
      message: "Student approved to generate certificate",
      studentId,
      assignmentId,
    });
  } catch (error) {
    console.error("[generate-certificate] Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
