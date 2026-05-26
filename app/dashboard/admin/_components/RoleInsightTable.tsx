"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { exportToExcel } from "@/lib/exportExcel";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

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
  const [pageSize, setPageSize] = useState<10 | 25 | 50 | 100>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClass,
    setSelectedClass] =
    useState<string>("all");
  const [selectedAffiliation,
    setSelectedAffiliation] =
    useState<string>("all");
  const [coachClasses, setCoachClasses] = useState<any[]>([]);

  const [progress, setProgress] = useState<any[]>([]);

  const [averageScores, setAverageScores] =
    useState<Record<string, number>>(
      {}
    );

  const [highestScores, setHighestScores] =
    useState<Record<string, number>>(
      {}
    );

  const [lowestScores, setLowestScores] =
    useState<Record<string, number>>(
      {}
    );

  const [attemptCounts,
    setAttemptCounts] =
    useState<
      Record<string, number>
    >({});

  const [isHistoryOpen, setIsHistoryOpen] =
    useState(false);

  const [selectedStudent, setSelectedStudent] =
    useState<any>(null);

  const [scoreHistory, setScoreHistory] =
    useState<any[]>([]);

  const [selectedHistory, setSelectedHistory] =
    useState<string[]>([]);

  const [selectedStudents,
    setSelectedStudents] =
    useState<string[]>([]);

  const [studentExportColumns,
    setStudentExportColumns] =
    useState<string[]>(
      role === "user"
        ? [
          "email",
          "class",
          "affiliation",
          "latest",
          "average",
          "attempts",
          "cefr",
          "created",
        ]
        : [
          "email",
          "class",
          "students",
          "active_classes",
          "affiliation",
          "created",
        ]
    );

  const [exportColumns,
    setExportColumns] =
    useState<string[]>([
      "score",
      "attempts",
      "unit",
      "part",
      "recorded",
    ]);

  const [historyCefr, setHistoryCefr] =
    useState("all");

  const [historyStartDate,
    setHistoryStartDate] =
    useState<Date | null>(null);

  const [historyEndDate,
    setHistoryEndDate] =
    useState<Date | null>(null);

  const [historySortBy,
    setHistorySortBy] =
    useState("recorded_at");

  const [historySortOrder,
    setHistorySortOrder] =
    useState<"asc" | "desc">(
      "desc"
    );

  const [activityFilter, setActivityFilter] = useState("all");
  const [cefrFilter,
    setCefrFilter] =
    useState("all");

  const [attemptFilter,
    setAttemptFilter] =
    useState("all");

  const [startDate,
    setStartDate] =
    useState<Date | null>(null);

  const [endDate,
    setEndDate] =
    useState<Date | null>(null);

  const [studentSortBy,
    setStudentSortBy] =
    useState("created_at");

  const [studentSortOrder,
    setStudentSortOrder] =
    useState<"asc" | "desc">(
      "desc"
    );

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

  const handleOpenHistory = async (
    student: any
  ) => {

    setSelectedStudent(student);

    const { data } =
      await supabase
        .from("student_score_history")
        .select(`
        id,
        score,
        speaking_attempts,
        recorded_at,
        recorded_by,
        metrics,
        unit_index,
        part_index
      `)
        .eq("student_id", student.id)
        .order("recorded_at", {
          ascending: false,
        });

    setScoreHistory(data || []);
    setSelectedHistory([]);
    setIsHistoryOpen(true);
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

      const { data: historyData } =
        await supabase
          .from("student_score_history")
          .select(`
      student_id,
      score
    `);

      setProgress(progressData ?? []);

      const grouped:
        Record<string, number[]> = {};

      const attempts:
        Record<string, number> = {};

      historyData?.forEach((item) => {

        attempts[item.student_id] =
          (attempts[item.student_id]
            || 0) + 1;

        if (!grouped[item.student_id]) {
          grouped[item.student_id] = [];
        }

        grouped[item.student_id].push(
          item.score
        );
      });

      const avgMap:
        Record<string, number> = {};

      const highMap:
        Record<string, number> = {};

      const lowMap:
        Record<string, number> = {};

      Object.entries(grouped).forEach(
        ([studentId, scores]) => {

          const avg =
            scores.reduce(
              (a, b) => a + b,
              0
            ) / scores.length;

          avgMap[studentId] =
            Number(avg.toFixed(2));

          highMap[studentId] =
            Math.max(...scores);

          lowMap[studentId] =
            Math.min(...scores);
        }
      );

      setAverageScores(avgMap);
      setHighestScores(highMap);
      setLowestScores(lowMap);
      setAttemptCounts(attempts);

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

      if (!row.class_members?.length) {
        return "No Class";
      }

      return row.class_members
        .map(
          (cm: any) =>
            cm.classes?.name
        )
        .filter(Boolean)
        .join(", ");
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

  const getCEFRLevel = (
    score: number
  ) => {

    if (score < 4) {
      return "a1";
    }

    if (score < 5) {
      return "a2";
    }

    if (score < 6) {
      return "b1";
    }

    if (score < 7) {
      return "b2";
    }

    if (score < 8) {
      return "c1";
    }

    return "c2";
  };

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    return rows
      .filter(
        (row: any) => {
          if (row.role !== role) return false;

          if (selectedClass !== "all") {

            if (row.role === "user") {

              const studentClassIds =
                row.class_members
                  ?.map(
                    (cm: any) =>
                      cm.class_id
                  )
                  .filter(Boolean) || [];

              if (
                selectedClass === "none"
              ) {

                if (
                  studentClassIds.length > 0
                ) {
                  return false;
                }

              } else {

                if (
                  !studentClassIds.includes(
                    selectedClass
                  )
                ) {
                  return false;
                }
              }
            }

            if (row.role === "guru") {

              const coachClassIds =
                coachClasses
                  .filter(
                    (c: any) =>
                      c.coach_id === row.id
                  )
                  .map(
                    (c: any) => c.id
                  );

              if (
                selectedClass === "none"
              ) {

                if (
                  coachClassIds.length > 0
                ) {
                  return false;
                }

              } else {

                if (
                  !coachClassIds.includes(
                    selectedClass
                  )
                ) {
                  return false;
                }
              }
            }
          }

          if (
            selectedAffiliation !== "all"
          ) {

            const affiliation =
              row.affiliation?.trim();

            if (
              selectedAffiliation === "none"
            ) {

              if (affiliation) {
                return false;
              }

            } else {

              if (
                affiliation !==
                selectedAffiliation
              ) {
                return false;
              }
            }
          }

          if (role === "user") {

            if (activityFilter === "active") {

              if (
                progressMap[row.id]
                === undefined
              ) {
                return false;
              }
            }

            if (activityFilter === "inactive") {

              if (
                progressMap[row.id]
                !== undefined
              ) {
                return false;
              }
            }
          }

          if (role === "user") {

            const score =
              progressMap[row.id];

            if (
              cefrFilter !== "all"
            ) {

              if (
                score === undefined
              ) {
                return false;
              }

              const cefr =
                getCEFRLevel(score);

              if (cefr !== cefrFilter) {
                return false;
              }
            }
          }

          if (role === "user") {

            const attempts =
              attemptCounts[row.id] || 0;

            if (
              attemptFilter === "none" &&
              attempts > 0
            ) {
              return false;
            }

            if (
              attemptFilter === "low" &&
              (attempts < 1 ||
                attempts > 5)
            ) {
              return false;
            }

            if (
              attemptFilter === "medium" &&
              (attempts < 6 ||
                attempts > 20)
            ) {
              return false;
            }

            if (
              attemptFilter === "high" &&
              attempts <= 20
            ) {
              return false;
            }
          }

          if (startDate || endDate) {

            const createdAt =
              row.created_at
                ? new Date(row.created_at)
                : null;

            if (!createdAt) {
              return false;
            }

            if (
              startDate &&
              createdAt < startDate
            ) {
              return false;
            }

            if (
              endDate &&
              createdAt > endDate
            ) {
              return false;
            }
          }

          if (!normalizedQuery) return true;

          return row.email.toLowerCase().includes(normalizedQuery);
        })

      .sort((a: any, b: any) => {

        let aValue: any;
        let bValue: any;

        switch (studentSortBy) {

          case "score":
            aValue =
              progressMap[a.id] || 0;

            bValue =
              progressMap[b.id] || 0;
            break;

          case "attempts":
            aValue =
              attemptCounts[a.id] || 0;

            bValue =
              attemptCounts[b.id] || 0;
            break;

          case "students":
            aValue =
              coachStudentCountMap[a.id]
              || 0;

            bValue =
              coachStudentCountMap[b.id]
              || 0;
            break;

          case "classes":
            aValue =
              coachClassCountMap[a.id]
              || 0;

            bValue =
              coachClassCountMap[b.id]
              || 0;
            break;

          case "email":
            aValue = a.email;
            bValue = b.email;
            break;

          default:
            aValue =
              new Date(
                a.created_at || 0
              ).getTime();

            bValue =
              new Date(
                b.created_at || 0
              ).getTime();
        }

        if (
          studentSortOrder ===
          "asc"
        ) {

          return aValue > bValue
            ? 1
            : -1;
        }

        return aValue < bValue
          ? 1
          : -1;
      });
  }, [
    rows,
    role,
    searchTerm,
    selectedClass,
    selectedAffiliation,
    startDate,
    endDate,
    activityFilter,
    cefrFilter,
    attemptFilter,
    attemptCounts,
    progressMap,
    studentSortBy,
    studentSortOrder,
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

    return [
      {
        id: "all",
        label: "All Classes",
      },

      ...coachClasses.map(
        (c: any) => ({
          id: c.id,
          label: c.name,
        })
      ),

      {
        id: "none",
        label: "No Class",
      },
    ];

  }, [coachClasses]);

  const affiliationOptions =
    useMemo(() => {

      const affiliations =
        Array.from(
          new Set(
            rows
              .filter(
                (r) =>
                  r.role === role &&
                  r.affiliation
              )
              .map(
                (r) =>
                  r.affiliation?.trim()
              )
              .filter(Boolean)
          )
        );

      return [
        {
          id: "all",
          label: "All Affiliations",
        },

        ...affiliations.map(
          (a) => ({
            id: a as string,
            label: a as string,
          })
        ),

        {
          id: "none",
          label: "No Affiliation",
        },
      ];

    }, [rows, role]);

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

  const highestStudent = useMemo(() => {

    const students =
      baseRows.filter(
        (r) =>
          r.role === "user" &&
          progressMap[r.id] !== undefined
      );

    if (!students.length) {
      return null;
    }

    return students.reduce(
      (best, current) => {

        return (
          progressMap[current.id] >
          progressMap[best.id]
        )
          ? current
          : best;
      }
    );
  }, [baseRows, progressMap]);

  const lowestStudent = useMemo(() => {

    const students =
      baseRows.filter(
        (r) =>
          r.role === "user" &&
          progressMap[r.id] !== undefined
      );

    if (!students.length) {
      return null;
    }

    return students.reduce(
      (worst, current) => {

        return (
          progressMap[current.id] <
          progressMap[worst.id]
        )
          ? current
          : worst;
      }
    );
  }, [baseRows, progressMap]);

  const mostActiveStudent =
    useMemo(() => {

      const students =
        baseRows.filter(
          (r) =>
            r.role === "user"
        );

      if (!students.length) {
        return null;
      }

      return students.reduce(
        (most, current) => {

          return (
            (attemptCounts[
              current.id
            ] || 0) >
            (attemptCounts[
              most.id
            ] || 0)
          )
            ? current
            : most;
        }
      );

    }, [
      baseRows,
      attemptCounts
    ]);

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

  const coachStudentCountMap =
    useMemo(() => {

      const map:
        Record<string, number> = {};

      coachClasses.forEach(
        (cls: any) => {

          if (!cls.coach_id) return;

          const students =
            rows.filter(
              (r: any) =>
                r.role === "user" &&
                r.class_members?.some(
                  (cm: any) =>
                    cm.class_id === cls.id
                )
            );

          map[cls.coach_id] =
            (map[cls.coach_id] || 0)
            + students.length;
        }
      );

      return map;
    }, [coachClasses, rows]);

  const coachClassCountMap =
    useMemo(() => {

      const map:
        Record<string, number> = {};

      coachClasses.forEach(
        (cls: any) => {

          if (!cls.coach_id) return;

          map[cls.coach_id] =
            (map[cls.coach_id] || 0)
            + 1;
        }
      );

      return map;
    }, [coachClasses]);

  const coachActiveClassCountMap =
    useMemo(() => {

      const map:
        Record<string, number> = {};

      coachClasses.forEach(
        (cls: any) => {

          if (!cls.coach_id) return;

          const hasActiveStudent =
            rows.some(
              (r: any) =>
                r.role === "user" &&
                r.class_members?.some(
                  (cm: any) =>
                    cm.class_id === cls.id
                ) &&
                progressMap[r.id]
                !== undefined
            );

          if (hasActiveStudent) {

            map[cls.coach_id] =
              (map[cls.coach_id] || 0)
              + 1;
          }
        }
      );

      return map;
    }, [
      coachClasses,
      rows,
      progressMap
    ]);


  const totalRows = filteredRows.length;

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

  const filteredHistory =
    scoreHistory
      .filter((item) => {

        const cefr =
          getCEFRLevel(
            item.score
          );

        if (
          historyCefr !== "all" &&
          cefr !== historyCefr
        ) {
          return false;
        }

        const recordedDate =
          new Date(
            item.recorded_at
          );

        if (
          historyStartDate &&
          recordedDate <
          historyStartDate
        ) {
          return false;
        }

        if (
          historyEndDate &&
          recordedDate >
          historyEndDate
        ) {
          return false;
        }

        return true;
      })

      .sort((a, b) => {

        let aValue =
          a[historySortBy];

        let bValue =
          b[historySortBy];

        if (
          historySortBy ===
          "recorded_at"
        ) {

          aValue = new Date(
            aValue
          ).getTime();

          bValue = new Date(
            bValue
          ).getTime();
        }

        if (
          historySortOrder ===
          "asc"
        ) {

          return aValue > bValue
            ? 1
            : -1;
        }

        return aValue < bValue
          ? 1
          : -1;
      });

  const allSelected =
    filteredHistory.length > 0 &&
    selectedHistory.length ===
    filteredHistory.length;

  const toggleExportColumn = (
    key: string
  ) => {

    setExportColumns((prev) => {

      if (prev.includes(key)) {

        return prev.filter(
          (c) => c !== key
        );
      }

      return [...prev, key];
    });
  };

  const toggleStudentExportColumn = (
    key: string
  ) => {

    setStudentExportColumns(
      (prev) => {

        if (
          prev.includes(key)
        ) {

          return prev.filter(
            (c) => c !== key
          );
        }

        return [...prev, key];
      }
    );
  };

  const exportStudentsToExcel = (
    exportRows: any[]
  ) => {

    const exportData =
      exportRows.map(
        (r: any) => {

          const row:
            Record<string, any> = {};

          if (
            studentExportColumns.includes(
              "email"
            )
          ) {
            row.Email = r.email;
          }

          if (
            studentExportColumns.includes(
              "class"
            )
          ) {
            row.Class =
              getClassName(r);
          }

          if (
            studentExportColumns.includes(
              "affiliation"
            )
          ) {
            row.Affiliation =
              r.affiliation || "-";
          }

          if (
            studentExportColumns.includes(
              "latest"
            )
          ) {
            row["Latest Score"] =
              progressMap[r.id] || 0;
          }

          if (
            studentExportColumns.includes(
              "average"
            )
          ) {
            row["Average Score"] =
              averageScores[r.id] || 0;
          }

          if (
            studentExportColumns.includes(
              "attempts"
            )
          ) {
            row.Attempts =
              attemptCounts[r.id] || 0;
          }

          if (
            studentExportColumns.includes(
              "cefr"
            )
          ) {

            row.CEFR =
              getCEFRLevel(
                progressMap[r.id] || 0
              ).toUpperCase();
          }

          if (
            role === "guru" &&
            studentExportColumns.includes(
              "students"
            )
          ) {

            row.Students =
              coachStudentCountMap[r.id]
              || 0;
          }

          if (
            role === "guru" &&
            studentExportColumns.includes(
              "active_classes"
            )
          ) {

            row["Active Classes"] =
              coachActiveClassCountMap[
              r.id
              ] || 0;
          }

          if (
            studentExportColumns.includes(
              "created"
            )
          ) {

            row.Created =
              r.created_at
                ? new Date(
                  r.created_at
                ).toLocaleDateString()
                : "-";
          }

          return row;
        }
      );

    exportToExcel(exportData);
  };

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

        {/* IN CLASS */}
        {role === "user" && (
          <div className="
    rounded-2xl border
    border-gray-200 bg-white
    p-6 dark:border-gray-800
    dark:bg-white/[0.03]
  ">
            <p className="
      text-xs text-gray-500
      uppercase
    ">
              In Class
            </p>

            <p className="
      text-2xl font-bold
    ">
              {
                baseRows.length -
                (baseClassSummary[
                  "No Class"
                ] || 0)
              }
            </p>
          </div>
        )}

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

        {role === "user" && (
          <div className="
    rounded-2xl border
    border-gray-200 bg-white
    p-6
  ">
            <p className="
      text-xs uppercase
      text-gray-500
    ">
              Top Student
            </p>

            <p className="
      mt-2 text-sm
      font-semibold
    ">
              {
                highestStudent?.email
                || "-"
              }
            </p>

            <p className="
      mt-1 text-2xl
      font-bold text-emerald-600
    ">
              {
                highestStudent
                  ? progressMap[
                  highestStudent.id
                  ]
                  : "-"
              }
            </p>
          </div>
        )}

        {role === "user" && (
          <div className="
    rounded-2xl border
    border-gray-200 bg-white
    p-6
  ">
            <p className="
      text-xs uppercase
      text-gray-500
    ">
              Lowest Student
            </p>

            <p className="
      mt-2 text-sm
      font-semibold
    ">
              {
                activeStudentCount <= 1
                  ? "-"
                  : lowestStudent?.email || "-"
              }
            </p>

            <p className="
      mt-1 text-2xl
      font-bold text-rose-600
    ">
              {
                activeStudentCount <= 1
                  ? "-"
                  : lowestStudent
                    ? progressMap[
                    lowestStudent.id
                    ]
                    : "-"
              }
            </p>
          </div>
        )}

        {role === "user" && (
          <div className="
    rounded-2xl border
    border-gray-200 bg-white
    p-6
  ">
            <p className="
      text-xs uppercase
      text-gray-500
    ">
              Most Active
            </p>

            <p className="
      mt-2 text-sm
      font-semibold
    ">
              {
                mostActiveStudent?.email
                || "-"
              }
            </p>

            <p className="
      mt-1 text-2xl
      font-bold text-primary
    ">
              {
                mostActiveStudent
                  ? attemptCounts[
                  mostActiveStudent.id
                  ]
                  : "-"
              }
            </p>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {/* Top Controls Bar */}
        <div
          className="
    border-b border-gray-100
    px-5 py-5
    space-y-5
  "
        >

          {/* SEARCH + EXPORT */}
          <div
            className="
      flex flex-col gap-3
      lg:flex-row lg:items-center
      lg:justify-between
    "
          >

            <input
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
              placeholder={
                role === "user"
                  ? "Search student..."
                  : "Search coach..."
              }
              className="
        w-full lg:w-80
        rounded-xl border
        px-4 py-2.5 text-sm
      "
            />

            <div className="flex flex-wrap gap-2">

              {/* PAGE SIZE */}
              <select
                value={pageSize}
                onChange={(e) =>
                  setPageSize(
                    parseInt(e.target.value) as 10 | 25 | 50 | 100
                  )
                }
                className="
    rounded-xl border
    px-3 py-2.5 text-sm
    min-w-[110px]
  "
              >
                <option value={10}>10 Rows</option>
                <option value={25}>25 Rows</option>
                <option value={50}>50 Rows</option>
                <option value={100}>100 Rows</option>
              </select>

              {/* EXPORT SELECTED */}
              <button
                onClick={() => {

                  const selectedRows =
                    filteredRows.filter(
                      (r) =>
                        selectedStudents.includes(
                          r.id
                        )
                    );

                  exportStudentsToExcel(
                    selectedRows
                  );
                }}

                disabled={
                  selectedStudents.length === 0
                }

                className="
      rounded-xl bg-green-500
      px-5 py-2.5 text-sm
      font-medium text-white
      transition hover:bg-green-600

      disabled:cursor-not-allowed
      disabled:opacity-50
    "
              >
                Export Selected
                ({selectedStudents.length})
              </button>

              {/* EXPORT ALL */}
              <button
                onClick={() => {

                  exportStudentsToExcel(
                    filteredRows
                  );
                }}

                disabled={
                  filteredRows.length === 0
                }

                className="
      rounded-xl border
      border-green-200
      bg-green-50
      px-5 py-2.5 text-sm
      font-medium
      text-green-700
      transition hover:bg-green-100

      disabled:cursor-not-allowed
      disabled:opacity-50
    "
              >
                Export All
                ({filteredRows.length})
              </button>

            </div>
          </div>

          {/* EXPORT COLUMNS */}
          <div className="space-y-2">

            <p
              className="
        text-xs font-medium
        uppercase tracking-wide
        text-gray-500
      "
            >
              Export Columns
            </p>

            <div className="flex flex-wrap gap-2">

              {(
                role === "user"
                  ? [
                    ["email", "Email"],
                    ["class", "Class"],
                    ["affiliation", "Affiliation"],
                    ["latest", "Latest"],
                    ["average", "Average"],
                    ["attempts", "Attempts"],
                    ["cefr", "CEFR"],
                    ["created", "Created"],
                  ]
                  : [
                    ["email", "Email"],
                    ["class", "Classes"],
                    ["students", "Students"],
                    ["active_classes", "Active Classes"],
                    ["affiliation", "Affiliation"],
                    ["created", "Created"],
                  ]
              ).map(([key, label]) => {

                const active =
                  studentExportColumns.includes(
                    key
                  );

                return (

                  <button
                    key={key}

                    type="button"

                    onClick={() =>
                      toggleStudentExportColumn(
                        key
                      )
                    }

                    className={`
              rounded-full border
              px-4 py-2 text-sm
              font-medium transition

              ${active
                        ? `
                  border-primary
                  bg-primary
                  text-white
                `
                        : `
                  border-gray-300
                  bg-white
                  text-gray-600
                  hover:bg-gray-50
                `
                      }
            `}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* FILTERS */}
          <div className="space-y-3">

            <p
              className="
      text-xs font-medium
      uppercase tracking-wide
      text-gray-500
    "
            >
              FILTERS
            </p>

            <div className="flex flex-wrap gap-4">

              {/* ACTIVITY */}
              {role === "user" && (
                <div className="flex flex-col gap-1">

                  <label
                    className="
            text-xs font-medium
            text-gray-500
          "
                  >
                    Activity
                  </label>

                  <select
                    value={activityFilter}
                    onChange={(e) =>
                      setActivityFilter(
                        e.target.value
                      )
                    }
                    className="
            min-w-[150px]
            rounded-xl border
            px-3 py-2 text-sm
          "
                  >
                    <option value="all">
                      All Activity
                    </option>

                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </div>
              )}

              {/* CEFR */}
              {role === "user" && (
                <div className="flex flex-col gap-1">

                  <label
                    className="
            text-xs font-medium
            text-gray-500
          "
                  >
                    CEFR Level
                  </label>

                  <select
                    value={cefrFilter}
                    onChange={(e) =>
                      setCefrFilter(
                        e.target.value
                      )
                    }
                    className="
            min-w-[150px]
            rounded-xl border
            px-3 py-2 text-sm
          "
                  >
                    <option value="all">
                      All CEFR
                    </option>

                    <option value="a1">A1</option>
                    <option value="a2">A2</option>
                    <option value="b1">B1</option>
                    <option value="b2">B2</option>
                    <option value="c1">C1</option>
                    <option value="c2">C2</option>
                  </select>
                </div>
              )}

              {/* ATTEMPTS */}
              {role === "user" && (
                <div className="flex flex-col gap-1">

                  <label
                    className="
            text-xs font-medium
            text-gray-500
          "
                  >
                    Attempts
                  </label>

                  <select
                    value={attemptFilter}
                    onChange={(e) =>
                      setAttemptFilter(
                        e.target.value
                      )
                    }
                    className="
            min-w-[150px]
            rounded-xl border
            px-3 py-2 text-sm
          "
                  >
                    <option value="all">
                      All Attempts
                    </option>

                    <option value="none">
                      No Attempts
                    </option>

                    <option value="low">
                      1–5 Attempts
                    </option>

                    <option value="medium">
                      6–20 Attempts
                    </option>

                    <option value="high">
                      20+ Attempts
                    </option>
                  </select>
                </div>
              )}

              {/* CLASS */}
              <div className="flex flex-col gap-1">

                <label
                  className="
          text-xs font-medium
          text-gray-500
        "
                >
                  Class
                </label>

                <select
                  value={selectedClass}
                  onChange={(e) =>
                    setSelectedClass(
                      e.target.value
                    )
                  }
                  className="
          min-w-[170px]
          rounded-xl border
          px-3 py-2 text-sm
        "
                >
                  {classOptions.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                    >
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* AFFILIATION */}
              <div className="flex flex-col gap-1">

                <label
                  className="
          text-xs font-medium
          text-gray-500
        "
                >
                  Affiliation
                </label>

                <select
                  value={selectedAffiliation}
                  onChange={(e) =>
                    setSelectedAffiliation(
                      e.target.value
                    )
                  }
                  className="
          min-w-[180px]
          rounded-xl border
          px-3 py-2 text-sm
        "
                >
                  {affiliationOptions.map(
                    (a) => (
                      <option
                        key={a.id}
                        value={a.id}
                      >
                        {a.label}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* DATES */}
          <div className="space-y-3">

            <p
              className="
      text-xs font-medium
      uppercase tracking-wide
      text-gray-500
    "
            >
              DATES
            </p>

            <div className="flex flex-wrap gap-4">

              {/* FROM DATE */}
              <div className="flex flex-col gap-1">

                <label
                  className="
          text-xs font-medium
          text-gray-500
        "
                >
                  From Date
                </label>

                <DatePicker
                  selected={startDate}
                  onChange={(date: Date | null) =>
                    setStartDate(date)
                  }
                  placeholderText="Start date"
                  className="
          min-w-[160px]
          rounded-xl border
          px-3 py-2 text-sm
        "
                  dateFormat="dd MMM yyyy"
                />
              </div>

              {/* TO DATE */}
              <div className="flex flex-col gap-1">

                <label
                  className="
          text-xs font-medium
          text-gray-500
        "
                >
                  To Date
                </label>

                <DatePicker
                  selected={endDate}
                  onChange={(date: Date | null) =>
                    setEndDate(date)
                  }
                  placeholderText="End date"
                  className="
          min-w-[160px]
          rounded-xl border
          px-3 py-2 text-sm
        "
                  dateFormat="dd MMM yyyy"
                />
              </div>

            </div>
          </div>

          {/* SORT */}
          <div className="space-y-3">

            <p
              className="
      text-xs font-medium
      uppercase tracking-wide
      text-gray-500
    "
            >
              SORT
            </p>

            <div className="flex flex-wrap gap-4">

              {/* SORT BY */}
              <div className="flex flex-col gap-1">

                <label
                  className="
          text-xs font-medium
          text-gray-500
        "
                >
                  Sort By
                </label>

                <select
                  value={studentSortBy}
                  onChange={(e) =>
                    setStudentSortBy(
                      e.target.value
                    )
                  }
                  className="
          min-w-[160px]
          rounded-xl border
          px-3 py-2 text-sm
        "
                >
                  <option value="created_at">
                    Created Date
                  </option>

                  {role === "user" && (
                    <>
                      <option value="score">
                        Latest Score
                      </option>

                      <option value="attempts">
                        Attempts
                      </option>
                    </>
                  )}

                  {role === "guru" && (
                    <>
                      <option value="students">
                        Students
                      </option>

                      <option value="classes">
                        Classes
                      </option>
                    </>
                  )}

                  <option value="email">
                    Email
                  </option>
                </select>
              </div>

              {/* ORDER */}
              <div className="flex flex-col gap-1">

                <label
                  className="
          text-xs font-medium
          text-gray-500
        "
                >
                  Order
                </label>

                <select
                  value={studentSortOrder}
                  onChange={(e) =>
                    setStudentSortOrder(
                      e.target.value as
                      "asc" | "desc"
                    )
                  }
                  className="
          min-w-[140px]
          rounded-xl border
          px-3 py-2 text-sm
        "
                >
                  <option value="desc">
                    Descending
                  </option>

                  <option value="asc">
                    Ascending
                  </option>
                </select>
              </div>

              {/* RESET */}
              <div className="flex flex-col gap-1">

                <label
                  className="
          text-xs opacity-0
        "
                >
                  reset
                </label>

                <button
                  onClick={() => {

                    setSearchTerm("");

                    setActivityFilter(
                      "all"
                    );

                    setCefrFilter(
                      "all"
                    );

                    setAttemptFilter(
                      "all"
                    );

                    setSelectedClass(
                      "all"
                    );

                    setSelectedAffiliation(
                      "all"
                    );

                    setStartDate(null);

                    setEndDate(null);

                    setStudentSortBy(
                      "created_at"
                    );

                    setStudentSortOrder(
                      "desc"
                    );
                  }}

                  className="
          rounded-xl border
          px-4 py-2 text-sm
          transition hover:bg-gray-50
        "
                >
                  Reset All
                </button>
              </div>

            </div>
          </div>
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
                  <th className="
  px-5 py-3 text-left
">
                    <input
                      type="checkbox"

                      checked={
                        visibleRows.length > 0 &&
                        selectedStudents.length ===
                        visibleRows.length
                      }

                      onChange={(e) => {

                        if (e.target.checked) {

                          setSelectedStudents(
                            visibleRows.map(
                              (r) => r.id
                            )
                          );

                        } else {

                          setSelectedStudents([]);
                        }
                      }}
                    />
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                    Class
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                    Affiliation
                  </th>
                  {role === "user" ? (
                    <>
                      <th className="
      px-5 py-3 text-left
      text-xs font-medium
      text-gray-500
    ">
                        Latest
                      </th>

                      <th className="
      px-5 py-3 text-left
      text-xs font-medium
      text-gray-500
    ">
                        Average
                      </th>

                      <th className="
      px-5 py-3 text-left
      text-xs font-medium
      text-gray-500
    ">
                        Attempts
                      </th>

                      <th className="
      px-5 py-3 text-left
      text-xs font-medium
      text-gray-500
    ">
                        CEFR
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="
      px-5 py-3 text-left
      text-xs font-medium
      text-gray-500
    ">
                        Students
                      </th>

                      <th className="
      px-5 py-3 text-left
      text-xs font-medium
      text-gray-500
    ">
                        Classes
                      </th>

                      <th className="
      px-5 py-3 text-left
      text-xs font-medium
      text-gray-500
    ">
                        Active Classes
                      </th>

                      <th className="
      px-5 py-3 text-left
      text-xs font-medium
      text-gray-500
    ">
                        Status
                      </th>
                    </>
                  )}
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
                    <tr
                      key={row.id}

                      onClick={() => {
                        if (row.role === "user") {
                          handleOpenHistory(row);
                        }
                      }}

                      className="
    cursor-pointer
    border-b border-gray-100
    transition hover:bg-gray-50
    last:border-0
    dark:border-gray-800
  "
                    >
                      <td className="
  px-5 py-4
">
                        <input
                          type="checkbox"

                          checked={selectedStudents.includes(
                            row.id
                          )}

                          onChange={(e) => {

                            e.stopPropagation();

                            if (e.target.checked) {

                              setSelectedStudents(
                                (prev) => [
                                  ...prev,
                                  row.id,
                                ]
                              );

                            } else {

                              setSelectedStudents(
                                (prev) =>
                                  prev.filter(
                                    (p) =>
                                      p !== row.id
                                  )
                              );
                            }
                          }}
                        />
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-gray-800 dark:text-white/90">{row.email}</td>
                      <td className="
  max-w-[220px]
  px-5 py-4 text-sm
  text-gray-500
  dark:text-gray-400
">

                        <div
                          className="
      truncate
    "

                          title={getClassName(row)}
                        >
                          {getClassName(row)}
                        </div>

                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500">
                        {row.affiliation || "-"} {/* 🔥 */}
                      </td>
                      {row.role === "user" ? (
                        <>
                          {/* LATEST */}
                          <td className="
      px-5 py-4 text-sm
      font-semibold
    ">
                            {progressMap[row.id] ?? "-"}
                          </td>

                          {/* AVERAGE */}
                          <td className="
      px-5 py-4 text-sm
    ">
                            {averageScores[row.id] ?? "-"}
                          </td>

                          {/* ATTEMPTS */}
                          <td className="
      px-5 py-4 text-sm
    ">
                            {attemptCounts[row.id] ?? 0}
                          </td>

                          {/* CEFR */}
                          <td className="
      px-5 py-4 text-sm
    ">
                            <span
                              className={`
          rounded-full px-3 py-1
          text-xs font-semibold

          ${(() => {

                                  const score =
                                    progressMap[row.id]
                                    ?? 0;

                                  const cefr =
                                    getCEFRLevel(score);

                                  if (
                                    cefr === "a1" ||
                                    cefr === "a2"
                                  ) {
                                    return `
                bg-rose-100
                text-rose-700
              `;
                                  }

                                  if (
                                    cefr === "b1" ||
                                    cefr === "b2"
                                  ) {
                                    return `
                bg-amber-100
                text-amber-700
              `;
                                  }

                                  return `
              bg-emerald-100
              text-emerald-700
            `;
                                })()}
        `}
                            >
                              {
                                getCEFRLevel(
                                  progressMap[row.id]
                                  ?? 0
                                ).toUpperCase()
                              }
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* STUDENTS */}
                          <td className="
      px-5 py-4 text-sm
      font-semibold
    ">
                            {
                              coachStudentCountMap[
                              row.id
                              ] || 0
                            }
                          </td>

                          {/* CLASSES */}
                          <td className="
      px-5 py-4 text-sm
    ">
                            {
                              coachClassCountMap[
                              row.id
                              ] || 0
                            }
                          </td>

                          {/* ACTIVE CLASSES */}
                          <td className="
      px-5 py-4 text-sm
    ">
                            {
                              coachActiveClassCountMap[
                              row.id
                              ] || 0
                            }
                          </td>

                          {/* STATUS */}
                          <td className="
      px-5 py-4 text-sm
    ">
                            <span className={`
        rounded-full px-3 py-1
        text-xs font-semibold

        ${coachClassCountMap[
                                row.id
                              ] > 0
                                ? `
              bg-emerald-100
              text-emerald-700
            `
                                : `
              bg-gray-100
              text-gray-600
            `
                              }
      `}>
                              {
                                coachClassCountMap[
                                  row.id
                                ] > 0
                                  ? "Active"
                                  : "No Classes"
                              }
                            </span>
                          </td>
                        </>
                      )}
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
              {totalRows > 0 && (
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
      {isHistoryOpen && selectedStudent && (

        <div className="
    fixed inset-0 z-[100000]
    flex items-center justify-center
    bg-black/40
  ">

          <div className="
      w-full max-w-5xl
      rounded-2xl bg-white
      p-6 shadow-lg
    ">

            {/* HEADER */}
            <div className="
        mb-5 flex items-start
        justify-between
      ">

              <div>

                <h2 className="
            text-xl font-semibold
          ">
                  Student Performance
                </h2>

                <p className="
            mt-1 text-sm text-gray-500
          ">
                  {selectedStudent.email}
                </p>

              </div>

              <button
                onClick={() =>
                  setIsHistoryOpen(false)
                }
                className="
            rounded-lg border
            px-4 py-2 text-sm
          "
              >
                Close
              </button>

            </div>

            {/* STUDENT INFO */}
            <div className="
  mb-6 grid gap-4
  lg:grid-cols-[1.4fr_1fr]
">

              {/* LEFT SIDE */}
              <div className="
    grid gap-4
  ">

                {/* Classes */}
                <div className="
      rounded-xl border
      px-4 py-3
    ">
                  <p className="
        text-xs uppercase
        text-gray-500
      ">
                    Classes
                  </p>

                  <p className="
        mt-2 text-sm
        font-medium
      ">
                    {getClassName(
                      selectedStudent
                    )}
                  </p>
                </div>

                {/* Affiliation */}
                <div className="
      rounded-xl border
      px-4 py-3
    ">
                  <p className="
        text-xs uppercase
        text-gray-500
      ">
                    Affiliation
                  </p>

                  <p className="
        mt-2 text-sm
        font-medium
      ">
                    {
                      selectedStudent.affiliation
                      || "-"
                    }
                  </p>
                </div>

              </div>

              {/* RIGHT SIDE */}
              <div className="
    grid grid-cols-2
    gap-3
  ">

                {/* Latest */}
                <div className="
      rounded-xl border
      px-4 py-3
    ">
                  <p className="
        text-xs uppercase
        text-gray-500
      ">
                    Latest CEFR
                  </p>

                  <p className="
        mt-2 text-lg
        font-bold
      ">
                    {
                      progressMap[
                      selectedStudent.id
                      ] ?? "-"
                    }
                  </p>
                </div>

                {/* Average */}
                <div className="
      rounded-xl border
      px-4 py-3
    ">
                  <p className="
        text-xs uppercase
        text-gray-500
      ">
                    Average Score
                  </p>

                  <p className="
        mt-2 text-lg
        font-bold
      ">
                    {
                      averageScores[
                      selectedStudent.id
                      ] ?? "-"
                    }
                  </p>
                </div>

                {/* Highest */}
                <div className="
      rounded-xl border
      px-4 py-3
    ">
                  <p className="
        text-xs uppercase
        text-gray-500
      ">
                    Highest Score
                  </p>

                  <p className="
        mt-2 text-lg
        font-bold text-emerald-600
      ">
                    {
                      highestScores[
                      selectedStudent.id
                      ] ?? "-"
                    }
                  </p>
                </div>

                {/* Lowest */}
                <div className="
      rounded-xl border
      px-4 py-3
    ">
                  <p className="
        text-xs uppercase
        text-gray-500
      ">
                    Lowest Score
                  </p>

                  <p className="
        mt-2 text-lg
        font-bold text-rose-500
      ">
                    {
                      lowestScores[
                      selectedStudent.id
                      ] ?? "-"
                    }
                  </p>
                </div>

              </div>
            </div>

            {/* HISTORY TABLE */}
            <div className="
        max-h-[450px]
        overflow-y-auto
      ">

              {scoreHistory.length === 0 ? (

                <p className="
            text-sm text-gray-500
          ">
                  No score history found.
                </p>

              ) : (
                <>
                  <div className="
  mb-4 flex flex-wrap
  items-end justify-between
  gap-4
">

                    {/* FILTERS */}
                    <div className="
  flex flex-col gap-2
">

                      <p className="
    text-xs font-medium
    uppercase tracking-wide
    text-gray-500
  ">
                        Export Columns
                      </p>

                      <div className="
    flex flex-wrap gap-2
  ">

                        {[
                          ["score", "Score"],
                          ["attempts", "Attempts"],
                          ["unit", "Unit"],
                          ["part", "Part"],
                          ["recorded", "Recorded"],
                        ].map(([key, label]) => {

                          const active =
                            exportColumns.includes(
                              key
                            );

                          return (

                            <button
                              key={key}

                              type="button"

                              onClick={() =>
                                toggleExportColumn(key)
                              }

                              className={`
            rounded-full border
            px-4 py-2 text-sm
            font-medium transition

            ${active
                                  ? `
                border-primary
                bg-primary
                text-white
              `
                                  : `
                border-gray-300
                bg-white
                text-gray-600
                hover:bg-gray-50
              `
                                }
          `}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="
    flex flex-wrap gap-3
  ">

                      {/* CEFR */}
                      <div className="
      flex flex-col gap-1
    ">
                        <label className="
        text-xs font-medium
        text-gray-500
      ">
                          CEFR Level
                        </label>

                        <select
                          value={historyCefr}
                          onChange={(e) =>
                            setHistoryCefr(
                              e.target.value
                            )
                          }
                          className="
          rounded-lg border
          px-3 py-2 text-sm
        "
                        >
                          <option value="all">
                            All Levels
                          </option>

                          <option value="a1">
                            A1
                          </option>

                          <option value="a2">
                            A2
                          </option>

                          <option value="b1">
                            B1
                          </option>

                          <option value="b2">
                            B2
                          </option>

                          <option value="c1">
                            C1
                          </option>

                          <option value="c2">
                            C2
                          </option>
                        </select>
                      </div>

                      {/* START DATE */}
                      <div className="
      flex flex-col gap-1
    ">
                        <label className="
        text-xs font-medium
        text-gray-500
      ">
                          From Date
                        </label>

                        <DatePicker
                          selected={historyStartDate}
                          onChange={(date: Date | null) =>
                            setHistoryStartDate(date)
                          }
                          placeholderText="Select start date"
                          className="
    rounded-lg border
    px-3 py-2 text-sm
  "
                          dateFormat="dd MMM yyyy"
                        />
                      </div>

                      {/* END DATE */}
                      <div className="
      flex flex-col gap-1
    ">
                        <label className="
        text-xs font-medium
        text-gray-500
      ">
                          To Date
                        </label>

                        <DatePicker
                          selected={historyEndDate}
                          onChange={(date: Date | null) =>
                            setHistoryEndDate(date)
                          }
                          placeholderText="Select end date"
                          className="
    rounded-lg border
    px-3 py-2 text-sm
  "
                          dateFormat="dd MMM yyyy"
                        />
                      </div>

                      {/* SORT BY */}
                      <div className="
  flex flex-col gap-1
">
                        <label className="
    text-xs font-medium
    text-gray-500
  ">
                          Sort By
                        </label>

                        <select
                          value={historySortBy}
                          onChange={(e) =>
                            setHistorySortBy(
                              e.target.value
                            )
                          }
                          className="
      rounded-lg border
      px-3 py-2 text-sm
    "
                        >
                          <option value="recorded_at">
                            Date
                          </option>

                          <option value="score">
                            Score
                          </option>

                          <option value="speaking_attempts">
                            Attempts
                          </option>

                          <option value="unit_index">
                            Unit
                          </option>

                          <option value="part_index">
                            Part
                          </option>
                        </select>
                      </div>

                      {/* ORDER */}
                      <div className="
  flex flex-col gap-1
">
                        <label className="
    text-xs font-medium
    text-gray-500
  ">
                          Order
                        </label>

                        <select
                          value={historySortOrder}
                          onChange={(e) =>
                            setHistorySortOrder(
                              e.target.value as
                              "asc" | "desc"
                            )
                          }
                          className="
      rounded-lg border
      px-3 py-2 text-sm
    "
                        >
                          <option value="desc">
                            Descending
                          </option>

                          <option value="asc">
                            Ascending
                          </option>
                        </select>
                      </div>

                      {/* RESET */}
                      <div className="
      flex flex-col gap-1
    ">
                        <label className="
        text-xs opacity-0
      ">
                          reset
                        </label>

                        <button
                          onClick={() => {

                            setHistoryCefr("all");

                            setHistoryStartDate(null);
                            setHistoryEndDate(null);

                            setHistorySortBy(
                              "recorded_at"
                            );

                            setHistorySortOrder(
                              "desc"
                            );
                          }}

                          className="
          rounded-lg border
          px-4 py-2 text-sm
          transition hover:bg-gray-50
        "
                        >
                          Reset
                        </button>
                      </div>

                    </div>

                    {/* EXPORT */}
                    <button
                      onClick={() => {

                        const selectedRows =
                          filteredHistory.filter(
                            (s) =>
                              selectedHistory.includes(
                                s.id
                              )
                          );

                        const infoSection = [
                          {
                            Report:
                              "Student Performance History",

                            Student:
                              selectedStudent.email,

                            Generated:
                              new Date()
                                .toLocaleString(),
                          },
                        ];

                        const historySection =
                          selectedRows.map(
                            (item) => {

                              const row:
                                Record<string, any> = {};

                              if (
                                exportColumns.includes(
                                  "score"
                                )
                              ) {
                                row.Score =
                                  item.score;
                              }

                              if (
                                exportColumns.includes(
                                  "attempts"
                                )
                              ) {
                                row.Attempts =
                                  item.speaking_attempts;
                              }

                              if (
                                exportColumns.includes(
                                  "unit"
                                )
                              ) {
                                row.Unit =
                                  item.unit_index + 1;
                              }

                              if (
                                exportColumns.includes(
                                  "part"
                                )
                              ) {
                                row.Part =
                                  item.part_index + 1;
                              }

                              if (
                                exportColumns.includes(
                                  "recorded"
                                )
                              ) {
                                row.Recorded =
                                  new Date(
                                    item.recorded_at
                                  ).toLocaleString();
                              }

                              return row;
                            }
                          );

                        const exportData = [
                          ...infoSection,
                          ...historySection,
                        ];

                        exportToExcel(exportData);
                      }}

                      disabled={
                        selectedHistory.length === 0
                      }

                      className="
      rounded-lg bg-green-500
      px-4 py-2 text-sm
      text-white transition

      hover:bg-green-600

      disabled:cursor-not-allowed
      disabled:opacity-50
    "
                    >
                      Export ({selectedHistory.length})
                    </button>
                  </div>

                  <table className="
            min-w-full
          ">

                    <thead className="
  sticky top-0 z-10
  bg-white
">

                      <tr className="
                border-b border-gray-200
              ">
                        <th className="
  px-4 py-3 text-left
">
                          <input
                            type="checkbox"

                            checked={allSelected}

                            onChange={(e) => {

                              if (e.target.checked) {

                                setSelectedHistory(
                                  filteredHistory.map(
                                    (s) => s.id
                                  )
                                );

                              } else {

                                setSelectedHistory([]);
                              }
                            }}
                          />
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                          Score
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                          Attempts
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                          Unit
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                          Part
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                          Recorded
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {filteredHistory.length === 0 ? (

                        <tr>

                          <td
                            colSpan={6}
                            className="
          px-4 py-10 text-center
          text-sm text-gray-500
        "
                          >
                            No data found.
                          </td>

                        </tr>

                      ) : (

                        filteredHistory.map(
                          (item, index) => (

                            <tr
                              key={index}
                              className="
                      border-b
                      border-gray-100
                    "
                            >

                              <td className="px-4 py-3">

                                <input
                                  type="checkbox"

                                  checked={selectedHistory.includes(
                                    item.id
                                  )}

                                  onChange={(e) => {

                                    if (e.target.checked) {

                                      setSelectedHistory(
                                        (prev) => [
                                          ...prev,
                                          item.id,
                                        ]
                                      );

                                    } else {

                                      setSelectedHistory(
                                        (prev) =>
                                          prev.filter(
                                            (p) =>
                                              p !== item.id
                                          )
                                      );
                                    }
                                  }}
                                />
                              </td>

                              <td className={`
  px-4 py-3
  text-sm font-semibold

  ${item.score < 5
                                  ? "text-rose-600"
                                  : item.score < 7
                                    ? "text-amber-600"
                                    : "text-emerald-600"
                                }
`}>
                                {item.score}
                              </td>

                              <td className="
                      px-4 py-3 text-sm
                    ">
                                {
                                  item.speaking_attempts
                                }
                              </td>

                              <td className="
                      px-4 py-3 text-sm
                    ">
                                Unit {
                                  item.unit_index
                                }
                              </td>

                              <td className="
                      px-4 py-3 text-sm
                    ">
                                Part {
                                  item.part_index
                                }
                              </td>

                              <td className="
                      px-4 py-3 text-sm
                      text-gray-500
                    ">
                                {new Date(
                                  item.recorded_at
                                ).toLocaleString()}
                              </td>

                            </tr>
                          )
                        )
                      )}

                    </tbody>

                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>


  );
}
