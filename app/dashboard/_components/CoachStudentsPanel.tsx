"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { ApexOptions } from "apexcharts";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { supabase } from "@/lib/supabase";
import { CalenderIcon } from "@/icons";
import ScoreHistoryRow from "../../learn/result/page";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

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

type ScoreHistoryRow = {
  student_id: string;
  score: number;
  speaking_attempts: number;
  recorded_at: string;
};

type StudentInsight = StudentRow & {
  name: string;
  latest_score: number | null;
  progress_percent: number | null;
  speaking_attempts: number;
  last_activity_at: string | null;
  updated_at: string | null;
  notes: string | null;
};

const StudentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.25a6.75 6.75 0 1 0 0-13.5 6.75 6.75 0 0 0 0 13.5ZM4.5 21a7.5 7.5 0 0 1 15 0" />
  </svg>
);

const ActiveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75a2.25 2.25 0 0 1 2.25 2.25v6a2.25 2.25 0 0 1-4.5 0V6A2.25 2.25 0 0 1 12 3.75Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 10.5a6 6 0 0 1-12 0" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5v3.75" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 20.25h7.5" />
  </svg>
);

const ScoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m7 14 3-3 3 2 4-5" />
  </svg>
);

type TrendDirection = "up" | "down" | "flat";
type PeriodPreset = "monthly" | "annually";

const TrendArrowIcon = ({ direction }: { direction: TrendDirection }) => {
  if (direction === "down") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.9">
        <path strokeLinecap="round" strokeLinejoin="round" d="m15 8-5 5-5-5" />
      </svg>
    );
  }

  if (direction === "flat") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.9">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10h10" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.9">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5-5 5 5" />
    </svg>
  );
};

const getPercentChange = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const getTrendDirection = (value: number): TrendDirection => {
  if (value > 0.001) return "up";
  if (value < -0.001) return "down";
  return "flat";
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

export default function CoachStudentsPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [students, setStudents] = useState<StudentInsight[]>([]);
  const [historyRows, setHistoryRows] = useState<ScoreHistoryRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState<5 | 10>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailStudent, setDetailStudent] = useState<StudentInsight | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>("monthly");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const datePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!datePickerRef.current) return;

    const fp = flatpickr(datePickerRef.current, {
      mode: "range",
      static: false,
      monthSelectorType: "static",
      dateFormat: "d M y",
      clickOpens: true,
      appendTo: document.body,
      positionElement: datePickerRef.current,
      position: "auto right",
      onChange: (selectedDates) => {
        if (selectedDates.length === 0) {
          setStartDate("");
          setEndDate("");
          return;
        }

        const firstDate = selectedDates[0];
        const lastDate = selectedDates[selectedDates.length - 1];
        setStartDate(firstDate.toISOString().slice(0, 10));
        setEndDate(lastDate.toISOString().slice(0, 10));
      },
    });

    return () => {
      fp.destroy();
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setNotice("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

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

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, role, created_at")
        .eq("role", "user")
        .eq("coach_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setNotice(`${error.message}. If coach_id is not created yet, run supabase/profiles_setup.sql.`);
      }

      const studentRows = (data as StudentRow[] | null) ?? [];
      if (studentRows.length === 0) {
        setStudents([]);
        setHistoryRows([]);
        setLoading(false);
        return;
      }

      const studentIds = studentRows.map((row) => row.id);

      const { data: progressRows, error: progressError } = await supabase
        .from("student_progress")
        .select("student_id, latest_score, progress_percent, speaking_attempts, last_activity_at, updated_at, notes")
        .in("student_id", studentIds);

      if (progressError) {
        setNotice(
          `${progressError.message}. Jika table student_progress belum dibuat, jalankan ulang supabase/profiles_setup.sql.`
        );
      }

      const { data: scoreHistoryRows, error: scoreHistoryError } = await supabase
        .from("student_score_history")
        .select("student_id, score, speaking_attempts, recorded_at")
        .in("student_id", studentIds)
        .order("recorded_at", { ascending: true });

      if (scoreHistoryError) {
        setNotice(
          `${scoreHistoryError.message}. Jika table student_score_history belum dibuat, jalankan ulang supabase/profiles_setup.sql.`
        );
      }

      setHistoryRows((scoreHistoryRows as ScoreHistoryRow[] | null) ?? []);

      const progressMap = new Map(
        ((progressRows as StudentProgressRow[] | null) ?? []).map((row) => [row.student_id, row])
      );

      const mergedRows: StudentInsight[] = studentRows.map((row) => {
        const progress = progressMap.get(row.id);
        return {
          ...row,
          name: getStudentNameFromEmail(row.email),
          latest_score: progress?.latest_score ?? null,
          progress_percent: progress?.progress_percent ?? null,
          speaking_attempts: progress?.speaking_attempts ?? 0,
          last_activity_at: progress?.last_activity_at ?? null,
          updated_at: progress?.updated_at ?? null,
          notes: progress?.notes ?? null,
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
      if (!query) return true;
      return row.email.toLowerCase().includes(query) || row.name.toLowerCase().includes(query);
    });
  }, [searchTerm, students]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

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

  const progressChart = useMemo(() => {
    const now = new Date();
    const presetStart = new Date(now);

    if (selectedPeriod === "annually") {
      presetStart.setDate(now.getDate() - 364);
    } else {
      presetStart.setDate(now.getDate() - 29);
    }

    const resolvedStart = startDate ? new Date(`${startDate}T00:00:00`) : presetStart;
    const resolvedEnd = endDate ? new Date(`${endDate}T23:59:59`) : now;

    const filteredRows = historyRows.filter((row) => {
      const date = new Date(row.recorded_at);
      if (Number.isNaN(date.getTime())) return false;

      return date >= resolvedStart && date <= resolvedEnd;
    });

    const grouped = new Map<string, { total: number; count: number }>();

    filteredRows.forEach((row) => {
      const key = new Date(row.recorded_at).toLocaleDateString();
      const previous = grouped.get(key) ?? { total: 0, count: 0 };
      grouped.set(key, {
        total: previous.total + row.score,
        count: previous.count + 1,
      });
    });

    const categories = Array.from(grouped.keys());
    const data = categories.map((key) => {
      const item = grouped.get(key)!;
      return Number((item.total / item.count).toFixed(2));
    });

    const options: ApexOptions = {
      chart: {
        type: "line",
        height: 300,
        toolbar: { show: false },
        fontFamily: "Outfit, sans-serif",
      },
      colors: ["#c95b5b"],
      stroke: { curve: "smooth", width: 3 },
      dataLabels: { enabled: false },
      xaxis: {
        categories,
        title: { text: "Waktu" },
      },
      yaxis: {
        min: 0,
        max: 100,
        title: { text: "Score IELTS" },
      },
      grid: {
        yaxis: { lines: { show: true } },
      },
    };

    return {
      options,
      series: [{ name: "Avg Score", data }],
      hasData: data.length > 0,
      filteredRows,
    };
  }, [endDate, historyRows, selectedPeriod, startDate]);

  const activityChart = useMemo(() => {
    const studentNameMap = new Map(students.map((row) => [row.id, row.name]));

    const attemptByStudent = new Map<string, number>();
    progressChart.filteredRows.forEach((row) => {
      attemptByStudent.set(
        row.student_id,
        (attemptByStudent.get(row.student_id) ?? 0) + row.speaking_attempts
      );
    });

    const aggregated = Array.from(attemptByStudent.entries())
      .map(([studentId, attempts]) => ({
        name: studentNameMap.get(studentId) ?? "Unknown Student",
        attempts,
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 8);

    const categories = aggregated.map((row) => row.name);
    const data = aggregated.map((row) => row.attempts);

    const options: ApexOptions = {
      chart: {
        type: "bar",
        height: 300,
        toolbar: { show: false },
        fontFamily: "Outfit, sans-serif",
      },
      colors: ["#c95b5b"],
      plotOptions: {
        bar: {
          borderRadius: 6,
          columnWidth: "45%",
        },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories,
      },
      yaxis: {
        title: { text: "Speaking Attempts" },
      },
      grid: {
        yaxis: { lines: { show: true } },
      },
    };

    return {
      options,
      series: [{ name: "Attempts", data }],
      hasData: data.length > 0,
    };
  }, [progressChart.filteredRows, students]);

  const kpiCards = useMemo(() => {
    const now = new Date();
    const msInDay = 24 * 60 * 60 * 1000;
    const startCurrent7Days = new Date(now.getTime() - 7 * msInDay);
    const startPrev7Days = new Date(now.getTime() - 14 * msInDay);

    const current7DaysRows = historyRows.filter((row) => {
      const recordedAt = new Date(row.recorded_at);
      return recordedAt >= startCurrent7Days;
    });
    const prev7DaysRows = historyRows.filter((row) => {
      const recordedAt = new Date(row.recorded_at);
      return recordedAt >= startPrev7Days && recordedAt < startCurrent7Days;
    });

    const studentsCreatedToday = students.filter((row) => {
      if (!row.created_at) return false;
      return new Date(row.created_at).toDateString() === now.toDateString();
    }).length;

    const activeTodayCount = students.filter((row) => isActiveToday(row.last_activity_at)).length;
    const inactiveCount = Math.max(students.length - activeTodayCount, 0);
    const totalAttempts = students.reduce((sum, row) => sum + row.speaking_attempts, 0);
    const validScores = students
      .map((row) => row.latest_score)
      .filter((value): value is number => value !== null);
    const avgScore = validScores.length
      ? validScores.reduce((sum, value) => sum + value, 0) / validScores.length
      : 0;

    const currentAttempts = current7DaysRows.reduce((sum, row) => sum + row.speaking_attempts, 0);
    const prevAttempts = prev7DaysRows.reduce((sum, row) => sum + row.speaking_attempts, 0);

    const currentAvgScore =
      current7DaysRows.length > 0
        ? current7DaysRows.reduce((sum, row) => sum + row.score, 0) / current7DaysRows.length
        : avgScore;
    const prevAvgScore =
      prev7DaysRows.length > 0
        ? prev7DaysRows.reduce((sum, row) => sum + row.score, 0) / prev7DaysRows.length
        : currentAvgScore;

    const trendStudents = getPercentChange(studentsCreatedToday, Math.max(students.length - studentsCreatedToday, 0));
    const trendActive = getPercentChange(activeTodayCount, inactiveCount);
    const trendAttempts = getPercentChange(currentAttempts, prevAttempts);
    const trendAvgScore = getPercentChange(currentAvgScore, prevAvgScore);

    const toBadge = (trendValue: number) => {
      const direction = getTrendDirection(trendValue);
      const badgeClass =
        direction === "up"
          ? "border border-[#D1FADF] bg-[#ECFDF3] text-[#027A48] dark:border-[#0F5132] dark:bg-[#052E1B] dark:text-[#6CE9A6]"
          : direction === "down"
            ? "border border-[#FEE4E2] bg-[#FEF3F2] text-[#D92D20] dark:border-[#7A271A] dark:bg-[#3B0D0C] dark:text-[#FDA29B]"
            : "border border-[#EAECF0] bg-[#F9FAFB] text-[#475467] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";

      return {
        direction,
        badgeClass,
        text:
          direction === "flat"
            ? "Stabil"
            : `${Math.abs(trendValue).toFixed(2)}% ${direction === "up" ? "naik" : "turun"}`,
      };
    };

    return [
      {
        key: "total-students",
        title: "Total Students",
        value: String(students.length),
        icon: <StudentIcon />,
        trend: toBadge(trendStudents),
      },
      {
        key: "active-today",
        title: "Active Today",
        value: String(activeTodayCount),
        icon: <ActiveIcon />,
        trend: toBadge(trendActive),
      },
      {
        key: "total-attempts",
        title: "Total Speaking Attempts",
        value: String(totalAttempts),
        icon: <MicIcon />,
        trend: toBadge(trendAttempts),
      },
      {
        key: "avg-score",
        title: "Avg IELTS Score",
        value: avgScore.toFixed(1),
        icon: <ScoreIcon />,
        trend: toBadge(trendAvgScore),
      },
    ];
  }, [historyRows, students]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Coach Panel</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Students Insight untuk monitoring hasil dan perkembangan speaking siswa.
        </p>
        {notice ? <p className="mt-3 text-sm text-error-600">{notice}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <div key={card.key} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-brand-600 dark:bg-gray-800 dark:text-brand-300">
              {card.icon}
            </div>

            <p className="mt-5 text-sm text-gray-500 dark:text-gray-400">{card.title}</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-3xl font-bold text-gray-800 dark:text-white/90">{card.value}</p>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold leading-none ${card.trend.badgeClass}`}>
                <TrendArrowIcon direction={card.trend.direction} />
                {card.trend.text}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="flex h-full flex-col overflow-visible rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Progress Score</h2>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800">
                {([
                  { label: "Monthly", value: "monthly" },
                  { label: "Yearly", value: "annually" },
                ] as const).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSelectedPeriod(item.value)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      selectedPeriod === item.value
                        ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="relative inline-flex items-center">
                <CalenderIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                <input
                  ref={datePickerRef}
                  className="h-10 w-52 cursor-pointer rounded-xl border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm font-medium text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  placeholder="Select date range"
                />
              </div>
            </div>
          </div>
        
          <div className="mt-4 flex-1">
            {progressChart.hasData ? (
              <ReactApexChart options={progressChart.options} series={progressChart.series} type="line" height={300} />
            ) : (
              <p className="py-10 text-sm text-gray-500 dark:text-gray-400">Belum ada data history score.</p>
            )}
          </div>

          <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
              <p className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-light-500" />
                X: Waktu
              </p>
              <p className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-500" />
                Y: Score IELTS
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Activity Chart</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Speaking attempts per student</p>
          <div className="mt-4">
            {activityChart.hasData ? (
              <ReactApexChart options={activityChart.options} series={activityChart.series} type="bar" height={300} />
            ) : (
              <p className="py-10 text-sm text-gray-500 dark:text-gray-400">Belum ada data speaking attempts.</p>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Students Monitoring</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Core monitoring table for your assigned students.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search nama/email..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 sm:w-64 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            />
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
                  <td className="px-5 py-4 text-sm text-gray-500" colSpan={6}>Loading students...</td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td className="px-5 py-4 text-sm text-gray-500" colSpan={6}>No assigned students found.</td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const active = isActiveToday(row.last_activity_at);
                  return (
                    <tr key={row.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                      <td className="px-5 py-4 text-sm font-medium text-gray-800 dark:text-white/90">{row.name}</td>
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
          </div>
        </div>
      ) : null}
    </section>
  );
}
