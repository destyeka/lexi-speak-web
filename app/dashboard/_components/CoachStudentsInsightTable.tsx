"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type StudentRow = {
  id: string;
  email: string;
  created_at: string | null;
  role: "user";
};

type StudentProgressRow = {
  student_id: string;
  latest_score: number | null;
  progress_percent: number | null;
  speaking_attempts: number | null;
  last_activity_at: string | null;
  updated_at: string | null;
  notes: string | null;
};

type ClassRow = {
  id: string;
  name: string;
};

type StudentInsight = StudentRow & {
  name: string;
  latest_score: number | null;
  progress_percent: number | null;
  speaking_attempts: number;
  last_activity_at: string | null;
  updated_at: string | null;
  notes: string | null;
  classes: string[];
  class_ids: string[];
};

const getStudentNameFromEmail = (email: string) => {
  const left = email.split("@")[0] ?? "student";
  return left
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

const isActiveToday = (value: string | null) => {
  if (!value) return false;
  const target = new Date(value);
  const now = new Date();
  return target.toDateString() === now.toDateString();
};

export default function CoachStudentsInsightTable() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [students, setStudents] = useState<StudentInsight[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState<5 | 10>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailStudent, setDetailStudent] = useState<StudentInsight | null>(null);
  const [coachNote, setCoachNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    const getUserWithRetry = async () => {
      const maxAttempts = 4;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await supabase.auth.getUser();
          return result;
        } catch (err: any) {
          const msg = err?.message ?? String(err ?? "");
          console.warn(`supabase.auth.getUser attempt ${attempt} failed:`, msg);
          if (attempt < maxAttempts && msg.includes("lock")) {
            await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
            continue;
          }
          throw err;
        }
      }
      return supabase.auth.getUser();
    };

    const load = async () => {
      setLoading(true);
      setNotice("");

      const {
        data: { user },
      } = await getUserWithRetry();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: me, error: meError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (meError) {
        setNotice(meError.message);
        setLoading(false);
        return;
      }

      if (me?.role !== "guru" && me?.role !== "admin") {
        setNotice("Coach access only.");
        setLoading(false);
        return;
      }

      const { data: classesData, error: classesError } = await supabase
        .from("classes")
        .select("id, name")
        .or(`coach_id.eq.${user.id},created_by.eq.${user.id}`)
        .order("name", { ascending: true });

      if (classesError) {
        setNotice(`Failed to load classes: ${classesError.message}.`);
      }

      const classRows = (classesData as ClassRow[] | null) ?? [];
      setClasses(classRows);
      const classIds = classRows.map((cls) => cls.id);

      const { data: classMembersData, error: classMembersError } = classIds.length > 0
        ? await supabase
            .from("class_members")
            .select("class_id, student_id")
            .in("class_id", classIds)
        : { data: [], error: null };

      if (classMembersError) {
        setNotice(`Failed to load class members: ${classMembersError.message}.`);
      }

      const classMembers = (classMembersData as { class_id: string; student_id: string }[] | null) ?? [];
      const classStudentIds = classMembers.map((member) => member.student_id);

      const { data: directStudentsData, error: directStudentsError } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "user")
        .eq("coach_id", user.id);

      if (directStudentsError) {
        setNotice(`${directStudentsError.message}. If coach_id is not created yet, run supabase/profiles_setup.sql.`);
      }

      const directStudentIds = ((directStudentsData as { id: string }[] | null) ?? []).map((row) => row.id);
      const studentIds = Array.from(new Set([...classStudentIds, ...directStudentIds]));

      if (studentIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, role, created_at")
        .in("id", studentIds)
        .eq("role", "user")
        .order("created_at", { ascending: false });

      if (error) {
        setNotice(`${error.message}. If coach_id is not created yet, run supabase/profiles_setup.sql.`);
      }

      const studentRows = (data as StudentRow[] | null) ?? [];
      if (studentRows.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const { data: progressRows, error: progressError } = await supabase
        .from("student_progress")
        .select("student_id, speaking_attempts, notes")
        .in("student_id", studentIds);

      if (progressError) {
        setNotice(
          `${progressError.message}. Jika table student_progress belum dibuat, jalankan ulang supabase/profiles_setup.sql.`
        );
      }

      const { data: submissionsData, error: submissionsError } = await supabase
        .from("assignment_submissions")
        .select("student_id, assignment_id, status, score, started_at, submitted_at")
        .in("student_id", studentIds);

      if (submissionsError) {
        setNotice(`${submissionsError.message}. Failed to load assignment activity for student insight.`);
      }

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("assignments")
        .select("id, class_id")
        .in("class_id", classIds);

      if (assignmentsError) {
        setNotice(`${assignmentsError.message}. Failed to load assignments for coach's classes.`);
      }

      const assignmentsByClass = new Map<string, number>();
      ((assignmentsData as Array<{ id: string; class_id: string }> | null) ?? []).forEach((assignment) => {
        assignmentsByClass.set(assignment.class_id, (assignmentsByClass.get(assignment.class_id) ?? 0) + 1);
      });

      const progressMap = new Map(
        ((progressRows as StudentProgressRow[] | null) ?? []).map((row) => [row.student_id, row])
      );
      const submissionsByStudent = new Map<string, Array<{
        student_id: string;
        assignment_id: string;
        status: string;
        score: number | null;
        started_at: string | null;
        submitted_at: string | null;
      }>>();

      ((submissionsData as Array<{
        student_id: string;
        assignment_id: string;
        status: string;
        score: number | null;
        started_at: string | null;
        submitted_at: string | null;
      }> | null) ?? []).forEach((submission) => {
        const list = submissionsByStudent.get(submission.student_id) ?? [];
        list.push(submission);
        submissionsByStudent.set(submission.student_id, list);
      });

      const classNameMap = new Map(classRows.map((cls) => [cls.id, cls.name]));
      const membershipMap = new Map<string, string[]>();

      classMembers.forEach((member) => {
        const className = classNameMap.get(member.class_id);
        if (!className) return;
        const existing = membershipMap.get(member.student_id) ?? [];
        membershipMap.set(member.student_id, Array.from(new Set([...existing, className])));
      });

      const mergedRows: StudentInsight[] = studentRows.map((row) => {
        const progress = progressMap.get(row.id);
        const submissions = submissionsByStudent.get(row.id) ?? [];

        const latestActivityAt = submissions.reduce<string | null>((latest, submission) => {
          const timestamps = [submission.submitted_at, submission.started_at].filter(Boolean) as string[];
          const candidate = timestamps
            .map((value) => new Date(value).getTime())
            .reduce((max, current) => Math.max(max, current), -Infinity);
          if (candidate === -Infinity) return latest;
          const currentDate = new Date(candidate).toISOString();
          return !latest || new Date(currentDate) > new Date(latest) ? currentDate : latest;
        }, null);

        const scoredSubmissions = submissions.filter((submission) => submission.score !== null && submission.score !== undefined);
        const avgScore = scoredSubmissions.length > 0
          ? scoredSubmissions.reduce((sum, submission) => sum + (submission.score ?? 0), 0) / scoredSubmissions.length
          : null;

        const completedAssignments = submissions.filter((submission) =>
          submission.status === "submitted" || submission.status === "in_progress"
        ).length;

        const studentClassIds = classMembers
          .filter((member) => member.student_id === row.id)
          .map((member) => member.class_id);

        const totalAssignmentsForStudent = studentClassIds.reduce(
          (sum, classId) => sum + (assignmentsByClass.get(classId) ?? 0),
          0
        );

        const progressPercent = totalAssignmentsForStudent > 0
          ? Number(((completedAssignments / totalAssignmentsForStudent) * 100).toFixed(1))
          : null;

        const classesForStudent = membershipMap.get(row.id) ?? [];
        return {
          ...row,
          name: getStudentNameFromEmail(row.email),
          latest_score: avgScore,
          progress_percent: progressPercent,
          speaking_attempts: progress?.speaking_attempts ?? 0,
          last_activity_at: latestActivityAt,
          updated_at: null,
          notes: progress?.notes ?? null,
          classes: classesForStudent,
          class_ids: classMembers
            .filter((member) => member.student_id === row.id)
            .map((member) => member.class_id),
        };
      });

      setStudents(mergedRows);
      setLoading(false);
    };

    void load();
  }, [router]);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return students.filter((row) => {
      if (selectedClassId && !row.class_ids.includes(selectedClassId)) {
        return false;
      }

      if (!query) return true;
      return (
        row.email.toLowerCase().includes(query) ||
        row.name.toLowerCase().includes(query) ||
        row.classes.join(" ").toLowerCase().includes(query)
      );
    });
  }, [searchTerm, selectedClassId, students]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedClassId, pageSize]);

  const totalRows = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const startIndex = (safePage - 1) * pageSize;
  const visibleRows = filteredRows.slice(startIndex, startIndex + pageSize);
  const startLabel = totalRows === 0 ? 0 : startIndex + 1;
  const endLabel = Math.min(startIndex + pageSize, totalRows);

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

  useEffect(() => {
    setCoachNote(detailStudent?.notes ?? "");
  }, [detailStudent]);

  const handleSaveCoachNote = async () => {
    if (!detailStudent) return;

    setSavingNote(true);
    setNotice("");

    const { error } = await supabase
      .from("student_progress")
      .upsert(
        {
          student_id: detailStudent.id,
          notes: coachNote,
          last_activity_at: detailStudent.last_activity_at ?? new Date().toISOString(),
        },
        { onConflict: "student_id" }
      );

    if (error) {
      setNotice(error.message);
      setSavingNote(false);
      return;
    }

    setStudents((prev) =>
      prev.map((row) => (row.id === detailStudent.id ? { ...row, notes: coachNote } : row))
    );
    setDetailStudent((prev) => (prev ? { ...prev, notes: coachNote } : prev));
    setSavingNote(false);
    setNotice("Coach feedback saved.");
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Students Insight</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Halaman ini fokus ke tabel monitoring siswa. Action Detail menampilkan ringkasan progress per siswa.
        </p>
        {notice ? <p className="mt-3 text-sm text-error-600">{notice}</p> : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Students Monitoring</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Core monitoring table for your assigned students.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search nama/email/kelas..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 sm:w-64 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            />
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 sm:w-auto"
            >
              <option value="">Filter by class</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(parseInt(event.target.value) as 5 | 10)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Nama</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Class</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Last Activity</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Avg Score</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Progress (%)</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-5 py-4 text-sm text-gray-500" colSpan={7}>Loading students...</td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td className="px-5 py-4 text-sm text-gray-500" colSpan={7}>No assigned students found.</td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const active = isActiveToday(row.last_activity_at);
                  return (
                    <tr key={row.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                      <td className="px-5 py-4 text-sm font-medium text-gray-800 dark:text-white/90">{row.name}</td>
                      <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {row.classes.length > 0 ? row.classes.join(", ") : "-"}
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            active
                              ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">{formatDate(row.last_activity_at)}</td>
                      <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {row.latest_score !== null ? row.latest_score.toFixed(1) : "-"}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {row.progress_percent !== null ? `${row.progress_percent.toFixed(1)}%` : "-"}
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <button
                          type="button"
                          onClick={() => setDetailStudent(row)}
                          className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-50 dark:border-brand-500/30 dark:text-brand-300 dark:hover:bg-brand-500/10"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading ? (
          <div className="space-y-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800 sm:flex sm:items-center sm:justify-between sm:space-y-0">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {totalRows === 0 ? "No students assigned" : `Showing ${startLabel} to ${endLabel} of ${totalRows} students`}
            </p>
            {totalRows > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                >
                  ‹
                </button>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      safePage === page
                        ? "bg-brand-500 text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage >= pageCount}
                  onClick={() => setCurrentPage((value) => Math.min(pageCount, value + 1))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {detailStudent ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Student Detail</h3>
            <button
              type="button"
              onClick={() => setDetailStudent(null)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Nama</p>
              <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">{detailStudent.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Avg Score</p>
              <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
                {detailStudent.latest_score !== null ? detailStudent.latest_score.toFixed(1) : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Progress</p>
              <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
                {detailStudent.progress_percent !== null ? `${detailStudent.progress_percent.toFixed(1)}%` : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Last Activity</p>
              <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">{formatDate(detailStudent.last_activity_at)}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Notes</p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{detailStudent.notes ?? "No notes yet."}</p>
            <textarea
              value={coachNote}
              onChange={(event) => setCoachNote(event.target.value)}
              placeholder="Write coach feedback for this student..."
              className="mt-3 min-h-28 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveCoachNote}
                disabled={savingNote}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingNote ? "Saving..." : "Save Coach Feedback"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
