"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx-js-style";
import { supabase } from "@/lib/supabase";
import TextButton from "@/components/ui/system/TextButton";

interface ClassSummary {
  id: string;
  name: string;
}

interface AssignmentSummary {
  id: string;
  class_id: string;
  title: string;
}

interface SubmissionRow {
  student_id: string | number;
  assignment_id: string | number;
  submitted_at: string | null;
  score: number | null;
  metrics: any;
  analysis: any;
  notes?: string | null;
  status: string;
}

interface ReportRow {
  id: string;
  classId: string;
  submitDate: string;
  submitAt?: string | null;
  studentEmail: string;
  assignmentName: string;
  overallScore: string;
  fluencyScore: string;
  lexicalScore: string;
  grammarScore: string;
  pronunciationScore: string;
  recommendation: string;
}

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
};

const parseJsonField = (field: any) => {
  if (field === null || field === undefined) return null;
  let working = field;
  while (typeof working === "string") {
    try {
      working = JSON.parse(working);
    } catch {
      break;
    }
  }
  return working;
};

const findMetricsArray = (data: any): any[] => {
  const parsed = parseJsonField(data);
  if (!parsed) return [];

  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed !== "object") return [];

  if (Array.isArray((parsed as any).metrics)) return findMetricsArray((parsed as any).metrics);
  if (Array.isArray((parsed as any).evaluation?.metrics)) return findMetricsArray((parsed as any).evaluation.metrics);
  if (Array.isArray((parsed as any).result?.metrics)) return findMetricsArray((parsed as any).result.metrics);
  if (Array.isArray((parsed as any).data?.metrics)) return findMetricsArray((parsed as any).data.metrics);

  const nestedArray = Object.values(parsed).find((value) => Array.isArray(value) && value.length > 0 && typeof value[0] === "object");
  if (nestedArray) return findMetricsArray(nestedArray);

  const objectEntriesWithScore = Object.entries(parsed)
    .filter(([, value]) => value !== null && typeof value === "object" && ("score" in value || "label" in value || "id" in value))
    .map(([key, value]) => ({ id: key, ...(value as object) }));
  if (objectEntriesWithScore.length) return objectEntriesWithScore;

  return Object.entries(parsed)
    .filter(([, value]) => value !== null && typeof value !== "object")
    .map(([key, value]) => ({ id: key, score: value }));
};

const getMetricScore = (metrics: any, label: string) => {
  const metricList = findMetricsArray(metrics);
  if (!metricList.length) return "-";

  const normalizedLabel = label.toLowerCase();
  const altLabels: Record<string, string[]> = {
    fluency: ["fluency", "coherence", "fluency & coherence", "flow", "fa"],
    lexical: ["lexical", "vocabulary", "lexical resource", "lr"],
    grammar: ["grammar", "grammatical", "grammar range", "accuracy", "gra"],
    pronunciation: ["pronunciation", "pronun", "pronounce", "pr"],
  };

  const candidates = altLabels[normalizedLabel] ?? [normalizedLabel];
  const match = metricList.find((item: any) => {
    const text = String(item.label || item.id || item.name || "").toLowerCase();
    return candidates.some((candidate) => text.includes(candidate));
  });
  if (!match) return "-";

  const score = match.score ?? match.value ?? match.scoring ?? match.band ?? match.result ?? "-";
  if (score === null || score === undefined || score === "") return "-";
  return String(score);
};

const formatOverallScore = (score: any) => {
  if (score === null || score === undefined || score === "") return "-";
  const parsed = Number(score);
  return Number.isNaN(parsed) ? String(score) : parsed.toFixed(1);
};

const truncateText = (text: string, maxLength = 100) => {
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
};

export default function ClassReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [sortOption, setSortOption] = useState<string>("date_desc");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportClassFilter, setExportClassFilter] = useState("");
  const [exportSortOption, setExportSortOption] = useState<string>("date_desc");

  const getSortLabel = (option: string) => {
    switch (option) {
      case "date_desc":
        return "Date (Newest first)";
      case "date_asc":
        return "Date (Oldest first)";
      case "email_date_desc":
        return "Email (A→Z) then Date (Newest)";
      case "assignment_asc":
        return "Assignment (A→Z)";
      default:
        return option;
    }
  };

  const getExportRows = () => {
    let filteredRows = [...rows];
    if (exportClassFilter) {
      filteredRows = filteredRows.filter((row) => row.classId === exportClassFilter);
    }

    const sortedRows = [...filteredRows];
    switch (exportSortOption) {
      case "date_asc":
        sortedRows.sort((a, b) => (a.submitAt ? new Date(a.submitAt).getTime() : 0) - (b.submitAt ? new Date(b.submitAt).getTime() : 0));
        break;
      case "date_desc":
        sortedRows.sort((a, b) => (b.submitAt ? new Date(b.submitAt).getTime() : 0) - (a.submitAt ? new Date(a.submitAt).getTime() : 0));
        break;
      case "email_date_desc":
        sortedRows.sort((a, b) => {
          const emailCmp = String(a.studentEmail || "").localeCompare(String(b.studentEmail || ""));
          if (emailCmp !== 0) return emailCmp;
          return (b.submitAt ? new Date(b.submitAt).getTime() : 0) - (a.submitAt ? new Date(a.submitAt).getTime() : 0);
        });
        break;
      case "assignment_asc":
        sortedRows.sort((a, b) => String(a.assignmentName || "").localeCompare(String(b.assignmentName || "")));
        break;
    }

    return sortedRows;
  };

  const handleExportExcel = () => {
    const exportRows = getExportRows();
    const filterLabel = exportClassFilter
      ? classes.find((cls) => cls.id === exportClassFilter)?.name ?? exportClassFilter
      : "All classes";
    const sortLabel = getSortLabel(exportSortOption);

    const headerRow = [
      "Submit Date",
      "Student Email",
      "Assignment Name",
      "Overall Score",
      "FC Score",
      "LR Score",
      "GRA Score",
      "PR Score",
      "Recommendation",
    ];

    const sheetData = [
      ["LexiSpeak Class Report"],
      [`Filter applied: ${filterLabel}`],
      [`Sort applied: ${sortLabel}`],
      [],
      headerRow,
      ...exportRows.map((row) => [
        row.submitDate,
        row.studentEmail,
        row.assignmentName,
        row.overallScore,
        row.fluencyScore,
        row.lexicalScore,
        row.grammarScore,
        row.pronunciationScore,
        row.recommendation,
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const thinBorder = { style: "thin", color: { rgb: "FFB0B0B0" } };
    const headerStyle = {
      font: { bold: true, color: { rgb: "FF1F2937" } },
      fill: { patternType: "solid", fgColor: { rgb: "FFF3F4F6" } },
      border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
    };
    const titleStyle = { font: { bold: true, sz: 14 } };
    const italicStyle = { font: { italic: true } };
    const bodyBorder = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

    const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[address];
        if (!cell) continue;

        if (R === 0) {
          cell.s = { ...cell.s, ...titleStyle };
        } else if (R === 1 || R === 2) {
          cell.s = { ...cell.s, ...italicStyle };
        } else if (R === 4) {
          cell.s = { ...cell.s, ...headerStyle };
        } else {
          cell.s = { ...cell.s, border: bodyBorder };
        }
      }
    }

    worksheet["!cols"] = [
      { wch: 14 },
      { wch: 28 },
      { wch: 24 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 36 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Class Report");
    XLSX.writeFile(workbook, "LexiSpeak-Class-Report.xlsx");
    setIsExportModalOpen(false);
  };

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);
      setErrorMessage(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData?.user;
      if (userError || !user) {
        setErrorMessage("Please log in to access report data.");
        setLoading(false);
        return;
      }

      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("id, name")
        .eq("coach_id", user.id);

      if (classError) {
        setErrorMessage(classError.message);
        setLoading(false);
        return;
      }

      const fetchedClasses = (classData ?? []) as ClassSummary[];
      setClasses(fetchedClasses);

      if (!fetchedClasses.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      const classIds = fetchedClasses.map((cls) => cls.id);
      const { data: assignmentData, error: assignmentError } = await supabase
        .from("assignments")
        .select("id, class_id, title")
        .in("class_id", classIds);

      if (assignmentError) {
        setErrorMessage(assignmentError.message);
        setLoading(false);
        return;
      }

      const assignments = (assignmentData ?? []) as AssignmentSummary[];
      const assignmentIds = assignments.map((assignment) => assignment.id);
      if (!assignmentIds.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: submissionData, error: submissionError } = await supabase
        .from("assignment_submissions")
        .select("student_id, assignment_id, submitted_at, score, metrics, analysis, status")
        .in("assignment_id", assignmentIds)
        .in("status", ["submitted", "complete"]);

      if (submissionError) {
        setErrorMessage(submissionError.message);
        setLoading(false);
        return;
      }

      const submissions = (submissionData ?? []) as SubmissionRow[];
      const studentIds = Array.from(new Set(submissions.map((row) => row.student_id))).filter(Boolean);
      if (!studentIds.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", studentIds);

      if (profileError) {
        setErrorMessage(profileError.message);
        setLoading(false);
        return;
      }

      const profiles = (profileData ?? []) as { id: string; email: string }[];
      const profileMap = new Map(profiles.map((profile) => [String(profile.id), profile.email]));
      const assignmentMap = new Map<string, AssignmentSummary>();
      assignments.forEach((assignment) => {
        const assignmentKey = String(assignment.id);
        assignmentMap.set(assignmentKey, assignment);
        const numericAssignmentId = Number(assignment.id);
        if (!Number.isNaN(numericAssignmentId)) assignmentMap.set(numericAssignmentId.toString(), assignment);
      });

      const builtRows = submissions.map((submission) => {
        const submissionAssignmentId = String(submission.assignment_id);
        const assignment = assignmentMap.get(submissionAssignmentId) || assignmentMap.get(String(submission.assignment_id));
        const classId = assignment ? String(assignment.class_id) : "";
        const analysisData = parseJsonField(submission.analysis);
        const metricsSource =
          findMetricsArray(analysisData?.metrics) ||
          findMetricsArray(analysisData?.evaluation?.metrics) ||
          findMetricsArray(analysisData?.result?.metrics) ||
          findMetricsArray(analysisData?.data?.metrics) ||
          findMetricsArray(submission.metrics) ||
          [];
        const recommendationSource = submission.notes ?? analysisData?.recommendation ?? analysisData?.suggestion ?? analysisData?.notes ?? null;
        const overallSource = submission.score ?? analysisData?.overallScore ?? analysisData?.overall ?? "-";

        return {
          id: `${submissionAssignmentId}_${String(submission.student_id)}_${submission.submitted_at ?? "unknown"}`,
          classId: assignment ? String(assignment.class_id) : "",
          submitDate: formatDate(submission.submitted_at),
          submitAt: submission.submitted_at ?? null,
          studentEmail: profileMap.get(String(submission.student_id)) ?? "Unknown",
          assignmentName: assignment?.title ?? "Unknown assignment",
          overallScore: formatOverallScore(overallSource),
          fluencyScore: getMetricScore(metricsSource, "fluency"),
          lexicalScore: getMetricScore(metricsSource, "lexical"),
          grammarScore: getMetricScore(metricsSource, "grammar"),
          pronunciationScore: getMetricScore(metricsSource, "pronunciation"),
          recommendation: recommendationSource ? String(recommendationSource) : "-",
        };
      });

      setRows(builtRows);
      setLoading(false);
    };

    void loadReport();
  }, []);

  const filteredRows = useMemo(() => {
    if (!selectedClassId) return rows;
    return rows.filter((row) => row.classId === selectedClassId);
  }, [rows, selectedClassId]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    const getTime = (r: ReportRow) => (r.submitAt ? new Date(r.submitAt).getTime() : Number.NEGATIVE_INFINITY);
    switch (sortOption) {
      case "date_desc":
        return copy.sort((a, b) => getTime(b) - getTime(a));
      case "date_asc":
        return copy.sort((a, b) => getTime(a) - getTime(b));
      case "email_date_desc":
        return copy.sort((a, b) => {
          const emailCmp = String(a.studentEmail || "").localeCompare(String(b.studentEmail || ""));
          if (emailCmp !== 0) return emailCmp;
          return getTime(b) - getTime(a);
        });
      case "assignment_asc":
        return copy.sort((a, b) => String(a.assignmentName || "").localeCompare(String(b.assignmentName || "")));
      default:
        return copy;
    }
  }, [filteredRows, sortOption]);

  return (
    <main className="w-full bg-transparent py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Class Report</h1>
              <p className="mt-2 text-sm text-gray-500">View aggregated speaking results for all classes without opening each class.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <TextButton variant="secondary" onClick={() => router.push("/dashboard/coach/class")}>Back to Classes</TextButton>
              <TextButton variant="primary" onClick={() => setIsExportModalOpen(true)}>Export to Excel</TextButton>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="class-filter" className="text-sm font-medium text-gray-700">Filter by Class</label>
              <select
                id="class-filter"
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                className="h-11 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              >
                <option value="">All classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="sort-select" className="text-sm font-medium text-gray-700">Sort</label>
              <select
                id="sort-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="h-11 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              >
                <option value="date_desc">Date (Newest first)</option>
                <option value="date_asc">Date (Oldest first)</option>
                <option value="email_date_desc">Email (A→Z) then Date (Newest)</option>
                <option value="assignment_asc">Assignment (A→Z)</option>
              </select>
            </div>

            <div className="text-sm text-gray-600">{loading ? "Loading report..." : `${sortedRows.length} submission records found`}</div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase tracking-[0.18em] text-gray-500">
              <tr>
                <th className="px-4 py-3">Submit Date</th>
                <th className="px-4 py-3">Student Email</th>
                <th className="px-4 py-3">Assignment Name</th>
                <th className="px-4 py-3">Overall Score</th>
                <th className="px-4 py-3">FC Score<br /><span className="text-[10px] uppercase text-gray-400">Fluency &amp; Coherence</span></th>
                <th className="px-4 py-3">LR Score<br /><span className="text-[10px] uppercase text-gray-400">Lexical Resource</span></th>
                <th className="px-4 py-3">GRA Score<br /><span className="text-[10px] uppercase text-gray-400">Grammar Range &amp; Accuracy</span></th>
                <th className="px-4 py-3">PR Score<br /><span className="text-[10px] uppercase text-gray-400">Pronunciation</span></th>
                <th className="px-4 py-3 max-w-[250px]">Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">Memuat data report...</td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">No submission report data found.</td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{row.submitDate}</td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{row.studentEmail}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{row.assignmentName}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-gray-900">{row.overallScore}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{row.fluencyScore}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{row.lexicalScore}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{row.grammarScore}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{row.pronunciationScore}</td>
                    <td className="max-w-[250px] px-4 py-4 text-sm text-gray-600 min-w-0" title={row.recommendation === "-" ? "" : row.recommendation}>
                      <div className="w-full overflow-x-auto [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400">
                        <div className="inline-block pr-4 whitespace-nowrap text-sm text-gray-600">{row.recommendation === "-" ? "-" : row.recommendation}</div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {isExportModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/10">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Export Settings</h2>
                  <p className="text-sm text-gray-500">Configure export filters and sorting before downloading.</p>
                </div>
                <button
                  type="button"
                  className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                  onClick={() => setIsExportModalOpen(false)}
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">Filter by Class</label>
                <select
                  value={exportClassFilter}
                  onChange={(event) => setExportClassFilter(event.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">All classes</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">Sort by</label>
                <select
                  value={exportSortOption}
                  onChange={(event) => setExportSortOption(event.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                >
                  <option value="date_desc">Date (Newest first)</option>
                  <option value="date_asc">Date (Oldest first)</option>
                  <option value="email_date_desc">Email (A→Z) then Date (Newest)</option>
                  <option value="assignment_asc">Assignment (A→Z)</option>
                </select>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                  onClick={() => setIsExportModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark sm:w-auto"
                  onClick={handleExportExcel}
                >
                  Download Excel
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
        ) : null}
      </div>
    </main>
  );
}
