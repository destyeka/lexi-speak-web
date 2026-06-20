"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { renderCertificateBlob } from "@/lib/certificate-generator";
import { Modal } from "@/components/ui/modal";
import { PlayIcon } from "@phosphor-icons/react";

interface Assignment {
  id: string;
  class_id: string;
  part?: number;
  title: string;
  prompt?: string;
  description: string | null;
  start_at: string | null;
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
  score: number | null;
}

interface Certificate {
  assignment_id: string;
  certificate_name: string | null;
  issued_at: string | null;
}

export default function StudentClassAssignmentPage() {
  const params = useParams() as { classId?: string };
  const router = useRouter();
  const classId = params.classId;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [certificates, setCertificates] = useState<Record<string, Certificate>>({});
  const [certificateModalOpen, setCertificateModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [profileCertificateName, setProfileCertificateName] = useState<string>("");
  const [coachCertificateName, setCoachCertificateName] = useState<string>("");
  const [certificateName, setCertificateName] = useState("");
  const [certificatePreviewUrl, setCertificatePreviewUrl] = useState<string | null>(null);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [generatingCertificate, setGeneratingCertificate] = useState(false);
  const [studentName, setStudentName] = useState<string>("");
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
      .select("role, certificate_name")
      .eq("id", user.id)
      .maybeSingle();

    if (roleError || profile?.role !== "user") {
      router.push("/dashboard");
      return;
    }

    if (profile?.certificate_name) {
      setProfileCertificateName(profile.certificate_name);
    }

    // Load class coach -> prefer their `certificate_name` from profiles
    if (classId) {
      const { data: classInfo, error: classErr } = await supabase
        .from("classes")
        .select("coach_id")
        .eq("id", classId)
        .maybeSingle();

      if (!classErr && classInfo?.coach_id) {
        const { data: coachProfile, error: coachErr } = await supabase
          .from("profiles")
          .select("certificate_name, email")
          .eq("id", classInfo.coach_id)
          .maybeSingle();

        if (!coachErr && coachProfile) {
          setCoachCertificateName(coachProfile.certificate_name || coachProfile.email || "");
        }
      }
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
    await fetchStudentName(user);
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
      setCertificates({});
      return;
    }

    const assignmentIds = assignmentRows.map((a) => a.id);
    const [{ data: submissionData, error: submissionError }, { data: certificateData, error: certificateError }] = await Promise.all([
      supabase
        .from("assignment_submissions")
        .select("*")
        .in("assignment_id", assignmentIds)
        .eq("student_id", studentId),
      supabase
        .from("certificates")
        .select("assignment_id, certificate_name, issued_at")
        .in("assignment_id", assignmentIds)
        .eq("student_id", studentId),
    ]);

    if (submissionError) {
      setNotice(submissionError.message);
      setSubmissions({});
    } else {
      const byAssignment = (submissionData as Submission[] | null)?.reduce((acc, row) => {
        if (row.assignment_id) acc[row.assignment_id] = row;
        return acc;
      }, {} as Record<string, Submission>) || {};
      setSubmissions(byAssignment);
    }

    if (certificateError) {
      console.warn("Failed to load certificates", certificateError.message);
      setCertificates({});
    } else {
      const byCertificate = (certificateData as Certificate[] | null)?.reduce((acc, row) => {
        if (row.assignment_id) acc[row.assignment_id] = row;
        return acc;
      }, {} as Record<string, Certificate>) || {};
      setCertificates(byCertificate);
    }
  };


  const fetchStudentName = async (user: { user_metadata?: any; email?: string | null }) => {
    const metadataName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      [user.user_metadata?.first_name, user.user_metadata?.last_name]
        .filter(Boolean)
        .join(" ");

    setStudentName(metadataName || user.email?.split("@")[0] || "Student");
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  };

  const formatCompletionDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const openCertificateModal = (assignment: Assignment, submission: Submission) => {
    const certificate = certificates[assignment.id];
    setSelectedAssignment(assignment);
    setSelectedSubmission(submission);
    setCertificateName(
      profileCertificateName || certificate?.certificate_name || studentName || ""
    );
    setCertificateError(null);
    setCertificatePreviewUrl(null);
    setCertificateModalOpen(true);
  };

  const closeCertificateModal = () => {
    setCertificateModalOpen(false);
    setSelectedAssignment(null);
    setSelectedSubmission(null);
    setCertificateName("");
    setCertificateError(null);
    setCertificatePreviewUrl(null);
    setGeneratingCertificate(false);
  };

  const handleGenerateCertificate = async () => {
    if (!selectedAssignment || !selectedSubmission) {
      return;
    }

    if (!certificateName.trim()) {
      setCertificateError("Certificate name cannot be empty.");
      return;
    }

    setGeneratingCertificate(true);
    setCertificateError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || "";

      const response = await fetch("/api/generate-certificate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          assignment_id: selectedAssignment.id,
          certificate_name: certificateName.trim(),
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload.error) {
        setCertificateError(payload.error || "Gagal membuat sertifikat.");
        setGeneratingCertificate(false);
        return;
      }

      const blob = await renderCertificateBlob({
        studentName: certificateName.trim(),
        speakingBand: `Band ${selectedSubmission.score?.toFixed(1) ?? "-"}`,
        completionDate: formatCompletionDate(selectedSubmission.submitted_at),
        certificateId: selectedAssignment.id,
        coachName: coachCertificateName || "Coach",
      });

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setCertificateError("Gagal memuat user. Silakan login ulang.");
        setGeneratingCertificate(false);
        return;
      }

      const storageBucket = "certificates";
      const storagePath = `${userData.user.id}/${selectedAssignment.id}.png`;
      // Convert Blob to File to preserve correct mime and filename when uploading
      const file = new File([blob], `${selectedAssignment.id}.png`, { type: "image/png" });
      // Remove existing file first to avoid cached/old content issues, ignore error if not exist
      try {
        await supabase.storage.from(storageBucket).remove([storagePath]);
      } catch (err) {
        // ignore
      }
      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(storagePath, file, { upsert: true });

      if (uploadError) {
        setCertificateError(uploadError.message || "Gagal mengunggah sertifikat.");
        setGeneratingCertificate(false);
        return;
      }

      if (certificatePreviewUrl) {
        URL.revokeObjectURL(certificatePreviewUrl);
      }

      const downloadUrl = URL.createObjectURL(blob);
      setCertificatePreviewUrl(downloadUrl);
      setCertificates((prev) => ({
        ...prev,
        [selectedAssignment.id]: {
          assignment_id: selectedAssignment.id,
          certificate_name: certificateName.trim(),
          issued_at: new Date().toISOString(),
        },
      }));
      setGeneratingCertificate(false);
    } catch (error) {
      setCertificateError(error instanceof Error ? error.message : String(error));
      setGeneratingCertificate(false);
    }
  };

  const handleStartAssignment = async (assignment: Assignment) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      alert("Please sign in again.");
      return;
    }

    const startDate = assignment.start_at ? new Date(assignment.start_at).getTime() : null;
    if (startDate && startDate > Date.now()) {
      alert("Assignment belum bisa dikerjakan sebelum start date.");
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

    router.push(`/learn?assignmentId=${assignment.id}&part=${assignment.part ?? 1}`);
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
              const startDate = assignment.start_at ? new Date(assignment.start_at) : null;
              const isExpired = dueDate ? dueDate.getTime() < Date.now() : false;
              const isLocked = startDate ? startDate.getTime() > Date.now() : false;
              const submission = submissions[assignment.id];
              const isCompletedSubmission = submission?.status === "submitted" || submission?.status === "complete";
              const statusLabel = submission
                ? isCompletedSubmission
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
                      {/* assignment-level prompt removed; prompts are per-question now */}
                      <p className="mt-3 text-sm leading-6 text-slate-600">{assignment.description || "Tidak ada deskripsi tugas."}</p>
                      <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-500">
                        <span>Part: {assignment.part ?? 1}</span>
                        <span>|</span>
                        <span>Start: {formatDate(assignment.start_at)}</span>
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
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 flex justify-between items-center">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Submitted</p>
                          <p className="mt-2 font-medium text-slate-900">{formatDate(submission.submitted_at)}</p>
                        </div>
                        {submission.score !== null && (
                          <div className="text-right flex items-center gap-3">
                            <span className="inline-block rounded-xl bg-brand-50 px-3 py-1 text-sm font-bold text-brand-600 border border-brand-100">
                              Band {submission.score}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                // ✅ UBAH DISINI: Arahkan ke rute detail dashboard yang sudah diperbaiki kodenya
                                window.open(`/learn/result?assignmentId=${submission.assignment_id}`, '_blank');
                              }}
                              className="rounded-lg bg-white border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Detail
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      {isExpired
                        ? "Assignment sudah lewat tenggat waktu."
                        : isLocked
                          ? `Assignment akan tersedia mulai ${formatDate(assignment.start_at)}.`
                          : submission?.status === "submitted"
                            ? "Assignment sudah selesai dan tidak bisa dikerjakan ulang."
                            : "Klik untuk mulai atau lanjutkan tugas."}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {isCompletedSubmission ? (
                        <button
                          type="button"
                          onClick={() => openCertificateModal(assignment, submission)}
                          className="rounded-2xl bg-secondary text-secondary-foreground px-4 py-2 text-sm font-semibold transition hover:bg-secondary/90"
                        >
                          Print Certificate
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={async () => {
                          if (submission?.status === "submitted" || submission?.status === "complete") return;
                          const duePassed = assignment.due_at ? new Date(assignment.due_at).getTime() < Date.now() : false;
                          if (duePassed) {
                            alert("Assignment is expired and cannot be started.");
                            return;
                          }
                          const startFuture = assignment.start_at ? new Date(assignment.start_at).getTime() > Date.now() : false;
                          if (startFuture) {
                            alert("Assignment belum bisa dikerjakan sebelum start date.");
                            return;
                          }
                          await handleStartAssignment(assignment);
                        }}
                        disabled={isExpired || isLocked || submission?.status === "submitted" || submission?.status === "complete"}
                        className={
                          `inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition ${submission?.status === "submitted"
                            ? "bg-slate-200 text-slate-900 cursor-not-allowed"
                            : isExpired || isLocked
                              ? "bg-slate-300 text-slate-600 cursor-not-allowed"
                              : "bg-primary text-white hover:bg-primary/90"
                          }`
                        }
                      >
                        <PlayIcon size={18} />
                        <span className="ml-2">{submission?.status === "submitted" ? "Completed" : "Start"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <Modal isOpen={certificateModalOpen} onClose={closeCertificateModal} className="max-w-3xl p-6">
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Cetak Sertifikat</h2>
            <p className="mt-2 text-sm text-slate-500">
              Buat sertifikat untuk tugas selesai dan unduh sebagai file PNG.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2 text-sm text-slate-700">
              <p className="font-medium">Nama pada sertifikat</p>
              <input
                type="text"
                value={certificateName}
                disabled
                className="w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed dark:bg-gray-800 dark:text-white/90"
              />
              <p className="text-xs text-slate-500">
                Nama ini diambil dari profil Anda. Untuk mengubahnya, buka halaman profil. Perubahan dapat dilakukan sekali setiap 24 jam.
              </p>
            </div>
            <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Rincian sertifikat</p>
              <p>{selectedAssignment?.title || "-"}</p>
              <p>Band: {selectedSubmission?.score?.toFixed(1) ?? "-"}</p>
              <p>
                Tanggal selesai:{" "}
                {formatCompletionDate(selectedSubmission?.submitted_at ?? null)}
              </p>
            </div>
            {certificateError ? <p className="text-sm text-rose-600">{certificateError}</p> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={closeCertificateModal}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleGenerateCertificate}
                disabled={generatingCertificate}
                className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generatingCertificate ? "Printing..." : "Print Certificate"}
              </button>
            </div>

            {certificatePreviewUrl ? (
              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium text-slate-900">Sertifikat sudah siap</p>
                <img
                  src={certificatePreviewUrl}
                  alt="Preview Sertifikat"
                  className="w-full rounded-3xl border border-slate-200 object-cover"
                />
                <div className="flex flex-wrap gap-3">
                  <a
                    href={certificatePreviewUrl}
                    download={`certificate-${selectedAssignment?.title?.replace(/\s+/g, "-") || selectedAssignment?.id}.png`}
                    className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Download PNG
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Modal>
    </main>
  );
}
