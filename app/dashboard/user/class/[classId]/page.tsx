"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PlayIcon } from "@phosphor-icons/react";

interface Assignment {
  id: string;
  class_id: string;
  part?: number;
  title: string;
  description: string | null;
  due_at: string | null;
  is_active: boolean;
  created_at: string | null;
}

interface Submission {
  assignment_id: string;
  student_id: string;
  status: string;
  started_at: string | null;
  submitted_at: string | null;
}

export default function StudentClassAssignmentPage() {
  const params = useParams() as { classId?: string };
  const router = useRouter();
  const classId = params.classId;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!classId) {
      router.push("/dashboard/user/class");
      return;
    }
    void initialize();
  }, [classId]);

  const initialize = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: roleError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (roleError || profile?.role !== "user") {
      router.push("/dashboard");
      return;
    }

    const { data: membership, error: membershipError } = await supabase
      .from("class_members")
      .select("*")
      .match({ class_id: classId, student_id: user.id })
      .maybeSingle();

    if (membershipError || !membership) {
      router.push("/dashboard/user/class");
      return;
    }

    await fetchAssignments(user.id);
    setLoading(false);
  };

  const fetchAssignments = async (studentId: string) => {
    const { data: assignmentData, error: assignmentError } = await supabase
      .from("assignments")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });

    if (assignmentError) {
      setNotice(assignmentError.message);
      setAssignments([]);
      return;
    }

    const assignmentRows = (assignmentData as Assignment[]) || [];
    setAssignments(assignmentRows);

    if (assignmentRows.length === 0) {
      setSubmissions({});
      return;
    }

    const assignmentIds = assignmentRows.map((a) => a.id);
    const { data: submissionData, error: submissionError } = await supabase
      .from("assignment_submissions")
      .select("*")
      .in("assignment_id", assignmentIds)
      .eq("student_id", studentId);

    if (submissionError) {
      setNotice(submissionError.message);
      setSubmissions({});
      return;
    }

    const byAssignment = (submissionData as Submission[] | null)?.reduce((acc, row) => {
      if (row.assignment_id) acc[row.assignment_id] = row;
      return acc;
    }, {} as Record<string, Submission>) || {};

    setSubmissions(byAssignment);
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  };

  const handleStartAssignment = async (assignment: Assignment) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      alert("Please sign in again.");
      return;
    }

    const submissionPayload = {
      assignment_id: assignment.id,
      student_id: user.id,
      status: "in_progress",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from("assignment_submissions")
      .upsert(submissionPayload, { onConflict: "assignment_id,student_id" });

    router.push(`/onboarding?assignmentId=${assignment.id}&mode=learn&part=${assignment.part ?? 1}&autostart=1`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-primary font-medium">Loading assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="w-full bg-transparent py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Assignments</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">These are assignments your coach shared for this class.</p>
          {notice ? <p className="mt-3 text-sm text-error-600">{notice}</p> : null}
        </div>

        <div className="space-y-4">
          {assignments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-400 bg-white p-10 text-center text-gray-700">
              <p className="text-lg font-medium">Tidak ada tugas untuk kelas ini.</p>
              <p className="mt-2 text-sm">Tunggu coach membagikan assignment pertama.</p>
            </div>
          ) : (
            assignments.map((assignment) => {
              const dueDate = assignment.due_at ? new Date(assignment.due_at) : null;
              const isExpired = dueDate ? dueDate.getTime() < Date.now() : false;
              const submission = submissions[assignment.id];
              const statusLabel = submission
                ? submission.status === "submitted"
                  ? "Completed"
                  : submission.status === "in_progress"
                  ? "In progress"
                  : "Pending"
                : "Not started";
              const statusColor = isExpired
                ? "text-rose-700 bg-rose-100 border-rose-200"
                : statusLabel === "Completed"
                ? "text-emerald-700 bg-emerald-100 border-emerald-200"
                : statusLabel === "In progress"
                ? "text-sky-700 bg-sky-100 border-sky-200"
                : "text-slate-700 bg-slate-100 border-slate-200";

              return (
                <div key={assignment.id} className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold text-slate-900">{assignment.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{assignment.description || "Tidak ada deskripsi tugas."}</p>
                      <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-500">
                        <span>Part: {assignment.part ?? 1}</span>
                        <span>|</span>
                        <span>Created: {formatDate(assignment.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:items-end">
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusColor}`}>
                        {isExpired ? "Expired" : statusLabel}
                      </span>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Due Date</p>
                        <p className="mt-2 font-medium text-slate-900">{formatDate(assignment.due_at)}</p>
                      </div>
                    </div>
                  </div>

                  {submission ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Started</p>
                        <p className="mt-2 font-medium text-slate-900">{formatDate(submission.started_at)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Submitted</p>
                        <p className="mt-2 font-medium text-slate-900">{formatDate(submission.submitted_at)}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">{isExpired ? "Assignment sudah lewat tenggat waktu." : "Klik untuk mulai atau lanjutkan tugas."}</p>
                    <button
                      type="button"
                      onClick={async () => {
                        const duePassed = assignment.due_at ? new Date(assignment.due_at).getTime() < Date.now() : false;
                        if (duePassed) {
                          alert("Assignment is expired and cannot be started.");
                          return;
                        }
                        await handleStartAssignment(assignment);
                      }}
                      className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                    >
                      <PlayIcon size={18} />
                      <span className="ml-2">Start</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
