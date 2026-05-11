"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { exportToExcel } from "@/lib/exportExcel";

type AppRole = "user" | "guru" | "admin";

type ProfileRow = {
  id: string;
  email: string;
  role: AppRole;
  created_at: string | null;
  affiliation?: string | null;
};

type RoleInsightTableProps = {
  role: Exclude<AppRole, "admin">;
  title: string;
  description: string;
  emptyLabel: string;
  summaryLabel: string;
};


const roleLabel = (role: AppRole) => {
  if (role === "admin") return "admin";
  if (role === "guru") return "coach";
  return "student";
};


export default function RoleInsightTable({
  role,
  title,
  description,
  emptyLabel,
  summaryLabel,
}: RoleInsightTableProps) {
  const router = useRouter();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState<5 | 10>(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [coachClasses, setCoachClasses] = useState<any[]>([]);

  const [progress, setProgress] = useState<any[]>([]);

  const [activityFilter, setActivityFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");

  const handleExport = () => {
    const exportData = filteredRows.map((r: any) => ({
      Email: r.email,
      Role: roleLabel(r.role),
      Class: getClassName(r),
      "Created At": r.created_at
        ? new Date(r.created_at).toLocaleDateString()
        : "-",
    }));

    exportToExcel(exportData);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: me } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (me?.role !== "admin") {
        setIsUnauthorized(true);
        setLoading(false);
        return;
      }

      // 👇 profiles (students)
      const { data: profiles } = await supabase
        .from("profiles")
        .select(`
        id,
        email,
        role,
        created_at,
        affiliation,
        class_members (
          class_id,
          classes (
            id,
            name
          )
        )
      `)
        .order("created_at", { ascending: false });

      // 👇 coach classes
      const { data: classes } = await supabase
        .from("classes")
        .select("id, name, coach_id");

      const { data: progressData } = await supabase
        .from("student_progress")
        .select("student_id, latest_score");

      setProgress(progressData ?? []);

      setRows((profiles as any[]) ?? []);
      setCoachClasses(classes ?? []);
      setLoading(false);
    };

    load();
  }, [router]);

  const coachClassMap = useMemo(() => {
    const map: Record<string, string[]> = {};

    coachClasses.forEach((c: any) => {
      if (!map[c.coach_id]) map[c.coach_id] = [];
      map[c.coach_id].push(c.name);
    });

    return map;
  }, [coachClasses]);

  const progressMap = useMemo(() => {
    const map: Record<string, number> = {};

    progress.forEach((p: any) => {
      map[p.student_id] = p.latest_score ?? 0;
    });

    return map;
  }, [progress]);


  const getClassName = (row: any) => {
    // 👇 STUDENT
    if (row.role === "user") {
      if (!row.class_members?.length) return "No Class";
      return row.class_members[0]?.classes?.name ?? "Unknown";
    }

    // 👇 COACH
    if (row.role === "guru") {
      const classes = coachClassMap[row.id];
      if (!classes?.length) return "No Class";
      return classes.join(", ");
    }

    return "-";
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize, role, selectedClass]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    return rows.filter((row: any) => {
      if (row.role !== role) return false;

      if (selectedClass !== "all") {
        if (getClassName(row) !== selectedClass) return false;
      }

      if (activityFilter === "active") {
        if (row.role !== "user" || progressMap[row.id] === undefined) return false;
      }

      if (activityFilter === "inactive") {
        if (row.role !== "user" || progressMap[row.id] !== undefined) return false;
      }

      if (role === "user") {
        const score = progressMap[row.id] ?? 0;

        if (scoreFilter === "high" && score < 7) return false;
        if (scoreFilter === "medium" && (score < 5 || score >= 7)) return false;
        if (scoreFilter === "low" && score >= 5) return false;
      }


      if (!normalizedQuery) return true;

      return row.email.toLowerCase().includes(normalizedQuery);
    });
  }, [
    rows,
    role,
    searchTerm,
    selectedClass,
    activityFilter,
    scoreFilter,
    progressMap
  ]);

  const baseRows = useMemo(() => {
    return rows.filter((r) => r.role === role);
  }, [rows, role]);

  const classSummary = useMemo(() => {
    const map: Record<string, number> = {};

    baseRows.forEach((r: any) => {
      const cls = getClassName(r);
      map[cls] = (map[cls] || 0) + 1;
    });

    return map;
  }, [baseRows]);

  const classOptions = useMemo(() => {
    const set = new Set<string>();

    rows.forEach((r: any) => {
      const name = getClassName(r);
      if (name) set.add(name);
    });

    return ["all", ...Array.from(set)];
  }, [rows]);

  const baseClassSummary = useMemo(() => {
    const map: Record<string, number> = {};

    baseRows.forEach((r: any) => {
      const cls = getClassName(r);
      map[cls] = (map[cls] || 0) + 1;
    });

    return map;
  }, [baseRows]);

  const activeStudentCount = useMemo(() => {
    return baseRows.filter(
      (r) => r.role === "user" && progressMap[r.id] !== undefined
    ).length;
  }, [baseRows, progressMap]);

  const avgScore = useMemo(() => {
    const activeStudents = baseRows.filter(
      (r) => r.role === "user" && progressMap[r.id] !== undefined
    );

    if (activeStudents.length === 0) return 0;

    const total = activeStudents.reduce(
      (sum, s) => sum + progressMap[s.id],
      0
    );

    return (total / activeStudents.length).toFixed(2);
  }, [baseRows, progressMap]);


  const totalClasses = coachClasses.length;

  const unassignedClasses = useMemo(() => {
    return coachClasses.filter((c: any) => !c.coach_id).length;
  }, [coachClasses]);

  const activeClasses = useMemo(() => {
    let count = 0;

    coachClasses.forEach((cls: any) => {
      const hasActiveStudent = rows.some(
        (r: any) =>
          r.role === "user" &&
          r.class_members?.some((cm: any) => cm.class_id === cls.id) &&
          progressMap[r.id] !== undefined
      );

      if (hasActiveStudent) count++;
    });

    return count;
  }, [coachClasses, rows, progressMap]);



  const totalRows = baseRows.length;

  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const startIndex = (safePage - 1) * pageSize;
  const visibleRows = filteredRows.slice(startIndex, startIndex + pageSize);
  const startLabel = totalRows === 0 ? 0 : startIndex + 1;
  const endLabel = Math.min(startIndex + pageSize, totalRows);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">{title}</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        {notice ? <p className="mt-3 text-sm text-error-600">{notice}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

        {/* TOTAL */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-xs text-gray-500 uppercase">Total {summaryLabel}</p>
          <p className="text-2xl font-bold">{baseRows.length}</p>
        </div>

        {/* TOTAL CLASSES */}
        {role === "guru" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <p className="text-xs uppercase text-gray-500">Total Classes</p>
            <p className="text-2xl font-bold">{totalClasses}</p>
          </div>
        )}

        {/* ACTIVE CLASSES */}
        {role === "guru" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <p className="text-xs uppercase text-gray-500">Active Classes</p>
            <p className="text-2xl font-bold">{activeClasses}</p>
          </div>
        )}

        {/* UNASSIGNED CLASSES */}
        {role === "guru" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <p className="text-xs uppercase text-gray-500">Unassigned Classes</p>
            <p className="text-2xl font-bold">{unassignedClasses}</p>
          </div>
        )}

        {/* NO CLASS */}
        {role === "user" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-xs text-gray-500 uppercase">No Class</p>
            <p className="text-2xl font-bold">
              {baseClassSummary["No Class"] || 0}
            </p>
          </div>
        )}

        {/* CLASS CARDS */}
        {role === "user" && Object.entries(classSummary)
          .filter(([cls]) => cls !== "No Class")
          .map(([cls, count]) => (
            <div key={cls} className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <p className="text-xs text-gray-500 uppercase">{cls}</p>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          ))}

        {role === "user" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-xs uppercase text-gray-500">Active Students</p>
            <p className="text-2xl font-bold">{activeStudentCount}</p>
          </div>
        )}

        {role === "user" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-xs uppercase text-gray-500">Avg Score</p>
            <p className="text-2xl font-bold">{avgScore}</p>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {/* Top Controls Bar */}
        <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={`Search...`}
            className="w-full sm:w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          />

          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">All Activity</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {role === "user" && (
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="all">All Scores</option>
              <option value="high">High (7+)</option>
              <option value="medium">Medium (5–7)</option>
              <option value="low">Low (&lt;5)</option>
            </select>
          )}

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All Classes" : c}
              </option>
            ))}
          </select>

          {/* Entries Per Page */}
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => setPageSize(parseInt(event.target.value) as 5 | 10)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
            <span className="text-sm text-gray-600 dark:text-gray-400">entries per page</span>
          </div>

          <button
            onClick={handleExport}
            className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-600"
          >
            Export Excel
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {isUnauthorized ? (
            <div className="px-5 py-6 text-sm text-gray-600 dark:text-gray-300">
              Admin access required. Please set your account role to <span className="font-semibold">admin</span> in Supabase table <span className="font-semibold">profiles</span>.
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                    Class
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                    Affiliation
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-5 py-4 text-sm text-gray-500" colSpan={3}>
                      Loading {emptyLabel.toLowerCase()}...
                    </td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td className="px-5 py-4 text-sm text-gray-500" colSpan={3}>
                      No {emptyLabel.toLowerCase()} found.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                      <td className="px-5 py-4 text-sm font-medium text-gray-800 dark:text-white/90">{row.email}</td>
                      <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{roleLabel(row.role)}</td>
                      <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {getClassName(row)}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500">
                        {row.affiliation || "-"} {/* 🔥 */}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString() : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom Info & Pagination */}
        {!loading ? (
          <div className="space-y-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800 sm:flex sm:items-center sm:justify-between sm:space-y-0">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {totalRows === 0 ? (
                `No ${emptyLabel.toLowerCase()} found`
              ) : (
                `Showing ${startLabel} to ${endLabel} of ${totalRows} entries`
              )}
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
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${safePage === page
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
    </section>
  );
}
