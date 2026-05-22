"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import UnitCard from "./UnitCard";

type AppRole = "user" | "guru" | "admin";

type ProfileRow = {
  id: string;
  email: string | null;
  role: AppRole | null;
  coach_id: string | null;
  created_at: string | null;
};

type StudentProgressRow = {
  student_id: string;
  latest_score: number | null;
  progress_percent: number | null;
  notes: string | null;
  last_activity_at: string | null;
};

type StudentScoreHistoryRow = {
  id: number;
  student_id: string;
  score: number;
  speaking_attempts: number;
  unit_index?: number | null;
  part_index: number | null;
  recorded_at: string;
};

type CoachRow = {
  id: string;
  email: string | null;
};

type RoleOverviewPanelProps = {
  expectedRole: Exclude<AppRole, "admin">;
  title: string;
  description: string;
  tab?: "dashboard" | "learn" | "test";
};

type JourneyChatItem = {
  prompt: string;
  reply: string;
};

type JourneyContentItem = {
  title: string;
  prompt: string;
  points: string[];
  takeaway: string;
};

type JourneyUnitCard = {
  id: string;
  unitIndex: number;
  mode: "learn" | "test";
  title: string;
  subtitle: string;
  price?: number;
  topic: string;
  description: string;
  accent: string;
  actionLabel: string;
  parts: Array<{
    id: number;
    title: string;
    hint: string;
  }>;
  journey: {
    part1: JourneyChatItem[];
    part2: JourneyContentItem;
    part3: JourneyChatItem[];
  };
};

const roleLabel = (role: AppRole | null | undefined) => {
  if (role === "admin") return "Admin";
  if (role === "guru") return "Coach";
  return "Student";
};

const formatBand = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const normalized = value > 9.5 ? value / 10 : value;
  return Math.max(0, Math.min(9, Number(normalized.toFixed(1))));
};

const getCurrentLevelLabel = (band: number | null) => {
  if (band === null) return "-";
  if (band < 3.5) return "A2 (Elementary)";
  if (band < 4.5) return "B1 (Intermediate)";
  if (band < 5.5) return "B1+ (Upper Beginner)";
  if (band < 6.5) return "B2 (Upper-Intermediate)";
  if (band < 7.5) return "C1 (Advanced)";
  return "C1+ (Advanced)";
};

const formatDelta = (delta: number) => {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}`;
};

const isSpeakingPartIndex = (partIndex: number | null | undefined) => partIndex === 1 || partIndex === 2 || partIndex === 3;

// ==========================================
// FORMAT SVG RADAR CHART YANG SUDAH DIPERBAIKI (GANTI BAGIAN INI)
// ==========================================
function SvgRadar({ 
  values, 
  size = 320
}: { 
  values: { fluency: number; lexical: number; grammar: number; pronunciation: number }; 
  size?: number 
}) {
  const half = size / 2;
  const radius = half - 48;

  const categoriesShort = ["Fluency", "Lexical", "Grammar", "Pronunciation"];
  const numbers = [values.fluency, values.lexical, values.grammar, values.pronunciation];
  const fontSize = 16;

  const polygonPoints = numbers
    .map((value, index) => {
      const angle = (Math.PI * 2 * index) / numbers.length - Math.PI / 2;
      const distance = (value / 9) * radius;
      return `${half + Math.cos(angle) * distance},${half + Math.sin(angle) * distance}`;
    })
    .join(' ');

  return (
    <div className="w-full h-64 flex items-center justify-center p-0">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size} ${size}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Skill breakdown radar chart"
        className="mx-auto block max-w-full"
      >
        <defs>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.06" />
          </filter>
        </defs>

        {Array.from({ length: 3 }).map((_, ringIndex) => {
          const ringRadius = ((ringIndex + 1) / 3) * radius;
          const ringPoints = numbers
            .map((_, index) => {
              const angle = (Math.PI * 2 * index) / numbers.length - Math.PI / 2;
              return `${half + Math.cos(angle) * ringRadius},${half + Math.sin(angle) * ringRadius}`;
            })
            .join(' ');
          return <polygon key={ringIndex} points={ringPoints} fill="none" stroke="#eef2f7" strokeWidth={1} />;
        })}

        {numbers.map((_, index) => {
          const angle = (Math.PI * 2 * index) / numbers.length - Math.PI / 2;
          const x2 = half + Math.cos(angle) * radius;
          const y2 = half + Math.sin(angle) * radius;
          return <line key={index} x1={half} y1={half} x2={x2} y2={y2} stroke="#eef2f7" strokeWidth={1} />;
        })}

        <g filter="url(#softShadow)">
          <polygon
            points={polygonPoints}
            fill="#C95B5B"
            fillOpacity={0.18}
            stroke="#C95B5B"
            strokeWidth={2}
          />
        </g>

        {numbers.map((value, index) => {
          const angle = (Math.PI * 2 * index) / numbers.length - Math.PI / 2;
          const px = half + Math.cos(angle) * ((value / 9) * radius);
          const py = half + Math.sin(angle) * ((value / 9) * radius);

          // Place short label inside the chart near the outer ring but within viewBox
          const labelRadius = radius - 12;
          const lx = half + Math.cos(angle) * labelRadius;
          const ly = half + Math.sin(angle) * labelRadius;

          const diffX = lx - half;
          const anchor: 'start' | 'middle' | 'end' = Math.abs(diffX) < 8 ? 'middle' : diffX > 0 ? 'start' : 'end';

          return (
            <g key={index}>
              <circle cx={px} cy={py} r={4.5} fill="#C95B5B" />
              <text
                x={lx}
                y={ly}
                fontSize={fontSize}
                textAnchor={anchor}
                fill="#475569"
                dominantBaseline="middle"
                className="font-medium"
              >
                {categoriesShort[index]}
                <tspan x={lx} dy={fontSize + 2} fill="#C95B5B" fontWeight={700} fontSize={fontSize - 1}>
                  ({value.toFixed(1)})
                </tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type ChatPartProps = {
  eyebrow: string;
  title: string;
  badge: string;
  accent: string;
  questions: JourneyChatItem[];
  progress: number;
  actionLabel: string;
  onOpen: () => void;
};

const ChatPart = ({
  eyebrow,
  title,
  badge,
  accent,
  questions,
  progress,
  actionLabel,
  onOpen,
}: ChatPartProps) => {
  return (
    <section className="relative pl-6 md:pl-8">
      <div className={`absolute left-[2px] top-6 h-4 w-4 rounded-full border-4 border-white bg-gradient-to-r ${accent} shadow-sm dark:border-gray-950`} />
      <div className="relative overflow-hidden rounded-[28px] border border-gray-200 bg-gradient-to-br from-white via-white to-sky-50/70 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-brand-100/60 blur-3xl" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">{eyebrow}</p>
            <h4 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white/90">{title}</h4>
          </div>
          <span className={`rounded-full bg-gradient-to-r ${accent} px-3 py-1 text-xs font-semibold text-white`}>
            {badge}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {questions.map((item, index) => {
            const isEven = index % 2 === 0;

            return (
              <div key={`${item.prompt}-${index}`} className="space-y-2">
                <div className={`flex items-start gap-3 ${isEven ? "justify-start" : "justify-end"}`}>
                  <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                    AI
                  </span>
                  <div className="max-w-[82%] rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm text-gray-700 shadow-sm dark:bg-gray-800/80 dark:text-gray-100">
                    {item.prompt}
                  </div>
                </div>
                <div className={`flex items-start gap-3 ${isEven ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-brand-500 px-4 py-3 text-sm text-white shadow-sm">
                    {item.reply}
                  </div>
                  <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300">
                    You
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm ring-1 ring-gray-200/70 dark:bg-gray-900/70 dark:ring-gray-800">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Stage progress</p>
            <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">{progress.toFixed(1)}% complete</p>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className={`rounded-full bg-gradient-to-r ${accent} px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md`}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </section>
  );
};

type ContentCardPartProps = {
  eyebrow: string;
  title: string;
  badge: string;
  accent: string;
  content: JourneyContentItem;
  progress: number;
  actionLabel: string;
  onOpen: () => void;
};

const ContentCardPart = ({
  eyebrow,
  title,
  badge,
  accent,
  content,
  progress,
  actionLabel,
  onOpen,
}: ContentCardPartProps) => {
  return (
    <section className="relative pl-6 md:pl-8">
      <div className={`absolute left-[2px] top-6 h-4 w-4 rounded-full border-4 border-white bg-gradient-to-r ${accent} shadow-sm dark:border-gray-950`} />
      <div className="relative overflow-hidden rounded-[28px] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white p-5 shadow-[0_16px_40px_rgba(245,158,11,0.18)] dark:border-amber-500/30 dark:bg-amber-500/10">
        <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-amber-200/60 blur-3xl" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">{eyebrow}</p>
            <h4 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white/90">{title}</h4>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/30">
            {badge}
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200/70 bg-white/90 p-4 shadow-sm dark:border-amber-500/20 dark:bg-gray-950/40">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">Core question</p>
          <p className="mt-2 text-base font-semibold text-gray-900 dark:text-white/95">{content.prompt}</p>
        </div>

        <div className="mt-4 space-y-3">
          {content.points.map((point) => (
            <div key={point} className="flex items-start gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm ring-1 ring-gray-200/70 dark:bg-gray-900/55 dark:ring-gray-800">
              <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-r ${accent} text-xs font-semibold text-white`}>
                •
              </span>
              <p className="text-sm text-gray-700 dark:text-gray-300">{point}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/85 px-4 py-3 shadow-sm ring-1 ring-amber-200/70 dark:bg-gray-950/40 dark:ring-amber-500/20">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Focus</p>
            <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">{content.takeaway}</p>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className={`rounded-full bg-gradient-to-r ${accent} px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md`}
          >
            {actionLabel}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Connection to the same topic</span>
          <span>{progress.toFixed(1)}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-gray-900/70">
          <div className={`h-full rounded-full bg-gradient-to-r ${accent}`} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
};

export default function RoleOverviewPanel({
  expectedRole,
  title,
  description,
  tab = "dashboard",
}: RoleOverviewPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [userEmail, setUserEmail] = useState<string>("-");
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<string>("");
  const [connectingCoach, setConnectingCoach] = useState(false);
  const [progress, setProgress] = useState<StudentProgressRow | null>(null);
  const [historyRows, setHistoryRows] = useState<StudentScoreHistoryRow[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [historyDetailModal, setHistoryDetailModal] = useState<{
    open: boolean;
    unit_index: number | null;
    part_index: number | null;
  }>({ open: false, unit_index: null, part_index: null });

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

      setUserEmail(user.email ?? "-");

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, role, coach_id, created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setNotice(error.message);
      }

      const resolved = (data as ProfileRow | null) ?? null;
      setProfile(resolved);
      setSelectedCoachId(resolved?.coach_id ?? "");

      const { data: progressData } = await supabase
        .from("student_progress")
        .select("student_id, latest_score, progress_percent, notes, last_activity_at")
        .eq("student_id", user.id)
        .maybeSingle();

      setProgress((progressData as StudentProgressRow | null) ?? null);

      const { data: historyData } = await supabase
        .from("student_score_history")
        .select("id, student_id, score, speaking_attempts, unit_index, part_index, recorded_at")
        .eq("student_id", user.id)
        .order("recorded_at", { ascending: true });

      setHistoryRows((historyData as StudentScoreHistoryRow[] | null) ?? []);

      if (expectedRole === "user") {
        const { data: coachData } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("role", "guru")
          .order("email", { ascending: true });

        setCoaches((coachData as CoachRow[] | null) ?? []);
      }

      if (resolved?.role && resolved.role !== expectedRole && resolved.role !== "admin") {
        setNotice(`Your account role is ${roleLabel(resolved.role)}. This page is optimized for ${roleLabel(expectedRole)}.`);
      }

      setLoading(false);
    };

    void load();
  }, [expectedRole, refreshToken, router]);

  useEffect(() => {
    const refreshDashboard = () => {
      setRefreshToken((current) => current + 1);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "lexa:practice-progress-updated") {
        refreshDashboard();
      }
    };

    window.addEventListener("lexa:practice-progress-updated", refreshDashboard);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("lexa:practice-progress-updated", refreshDashboard);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (historyDetailModal.open) {
      setActiveTab(historyDetailModal.part_index || 1);
    }
  }, [historyDetailModal.open, historyDetailModal.part_index]);

  const createdLabel = useMemo(() => {
    if (!profile?.created_at) return "-";
    return new Date(profile.created_at).toLocaleDateString();
  }, [profile?.created_at]);

  const currentCoachLabel = useMemo(() => {
    if (!profile?.coach_id) return "Not connected yet";
    return coaches.find((coach) => coach.id === profile.coach_id)?.email ?? "Connected coach";
  }, [coaches, profile?.coach_id]);

  const latestBand = useMemo(() => formatBand(progress?.latest_score ?? null), [progress?.latest_score]);

  const scoredHistoryRows = useMemo(
    () => historyRows.filter((row) => isSpeakingPartIndex(row.part_index)),
    [historyRows]
  );

  const previousBand = useMemo(() => {
    if (scoredHistoryRows.length < 2) return null;
    return formatBand(scoredHistoryRows[scoredHistoryRows.length - 2]?.score ?? null);
  }, [scoredHistoryRows]);

  const weeklyDelta = useMemo(() => {
    if (historyRows.length === 0) return 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRows = scoredHistoryRows.filter((row) => new Date(row.recorded_at) >= sevenDaysAgo);
    if (recentRows.length < 2) return 0;

    const firstBand = formatBand(recentRows[0]?.score ?? null) ?? 0;
    const lastBand = formatBand(recentRows[recentRows.length - 1]?.score ?? null) ?? 0;
    return lastBand - firstBand;
  }, [scoredHistoryRows]);

  const progressTrend = useMemo(() => {
    const categories = scoredHistoryRows.map((row) => new Date(row.recorded_at).toLocaleDateString());
    const data = scoredHistoryRows.map((row) => formatBand(row.score) ?? 0);

    const options: ApexOptions = {
      chart: {
        type: "line",
        height: 320,
        toolbar: { show: false },
        fontFamily: "Outfit, sans-serif",
      },
      colors: ["#465FFF"],
      stroke: { curve: "smooth", width: 3 },
      markers: { size: 4 },
      dataLabels: { enabled: false },
      xaxis: {
        categories,
        title: { text: "Time" },
      },
      yaxis: {
        min: 0,
        max: 9,
        tickAmount: 9,
        title: { text: "Band score" },
      },
      grid: {
        yaxis: { lines: { show: true } },
      },
      tooltip: {
        y: {
          formatter: (value: number) => value.toFixed(1),
        },
      },
    };

    return {
      options,
      series: [{ name: "Band score", data }],
      hasData: data.length > 0,
    };
  }, [scoredHistoryRows]);

  const skillBreakdown = useMemo(() => {
    const base = latestBand ?? 0;
    const progressBonus = Math.min(0.4, (progress?.progress_percent ?? 0) / 250);
    const values = {
      fluency: Math.max(0, Math.min(9, Number((base + progressBonus).toFixed(1)))),
      lexical: Math.max(0, Math.min(9, Number((base - 0.1 + progressBonus).toFixed(1)))),
      grammar: Math.max(0, Math.min(9, Number((base - 0.2 + progressBonus).toFixed(1)))),
      pronunciation: Math.max(0, Math.min(9, Number((base - 0.3 + progressBonus).toFixed(1)))),
    };

    const options: ApexOptions = {
      chart: {
        type: "radar",
        height: 320,
        toolbar: { show: false },
        fontFamily: "Outfit, sans-serif",
      },
      colors: ["#C95B5B"],
      stroke: { width: 2 },
      fill: {
        opacity: 0.18,
      },
      dataLabels: { enabled: true },
      xaxis: {
        categories: [
          "Fluency",
          "Lexical",
          "Grammar",
          "Pronunciation",
        ],
      },
      yaxis: {
        min: 0,
        max: 9,
        tickAmount: 3,
      },
    };

    return {
      options,
      series: [
        {
          name: "Estimated skill band",
          data: [values.fluency, values.lexical, values.grammar, values.pronunciation],
        },
      ],
      values,
    };
  }, [latestBand, progress?.progress_percent]);

  const aiFeedback = useMemo(() => {
    if (latestBand === null) {
      return [
        "No practice score yet. Start a test to generate AI feedback.",
        "When the first test is saved, this section will summarize your strongest and weakest areas.",
      ];
    }

    const points = [
      `Latest estimated IELTS band is ${latestBand.toFixed(1)}.`,
      weeklyDelta !== 0 ? `Your band changed ${formatDelta(weeklyDelta)} this week.` : "You need more than one result to show a weekly trend.",
      latestBand < 5.5
        ? "Focus on longer answers, clearer linking, and reducing hesitation."
        : latestBand < 6.5
          ? "Push for more precise vocabulary and more controlled grammar."
          : "Maintain fluency and add more sophisticated examples in each answer.",
    ];

    return points;
  }, [latestBand, weeklyDelta]);

  const summaryCards = [
    {
      label: "Current Level",
      value: getCurrentLevelLabel(latestBand),
      meta: latestBand !== null ? `Derived from latest band ${latestBand.toFixed(1)}` : "No band yet",
    },
    {
      label: "Estimated IELTS Band",
      value: latestBand !== null ? latestBand.toFixed(1) : "-",
      meta: latestBand !== null ? "Latest overall speaking estimate" : "Start a test first",
    },
    {
      label: "Progress",
      value: `${weeklyDelta >= 0 ? "+" : ""}${weeklyDelta.toFixed(1)}`,
      meta: "Band change this week",
    },
    {
      label: "Practice Count",
      value: `${scoredHistoryRows.length}`,
      meta: "Saved speaking sessions",
    },
  ];

  const partAverages = useMemo(() => {
    if (scoredHistoryRows.length === 0) {
      return { part1: 0, part2: 0, part3: 0, overall: 0 };
    }

    const part1Scores = scoredHistoryRows.filter((row) => row.part_index === 1).map((row) => formatBand(row.score) || 0);
    const part2Scores = scoredHistoryRows.filter((row) => row.part_index === 2).map((row) => formatBand(row.score) || 0);
    const part3Scores = scoredHistoryRows.filter((row) => row.part_index === 3).map((row) => formatBand(row.score) || 0);

    const calcAvg = (scores: number[]) => scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    const part1 = calcAvg(part1Scores);
    const part2 = calcAvg(part2Scores);
    const part3 = calcAvg(part3Scores);
    const overall = calcAvg([...part1Scores, ...part2Scores, ...part3Scores]);

    return { part1, part2, part3, overall };
  }, [scoredHistoryRows]);

  const historyBySession = useMemo(() => {
    const sessionMap = new Map<string, StudentScoreHistoryRow[]>();
    
    scoredHistoryRows.forEach((row) => {
      const dateKey = new Date(row.recorded_at).toLocaleDateString();
      const sessions = sessionMap.get(dateKey) || [];
      sessions.push(row);
      sessionMap.set(dateKey, sessions);
    });

    const sessions: Array<{
      date: string;
      entries: StudentScoreHistoryRow[];
      avgScore: number;
      parts: Set<number>;
    }> = [];

    sessionMap.forEach((entries, date) => {
      const scores = entries.map((e) => formatBand(e.score) || 0);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const parts = new Set(entries.map((e) => e.part_index).filter((p): p is number => p !== null));
      sessions.push({ date, entries, avgScore, parts });
    });

    return sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [scoredHistoryRows]);

  const latestFinalScoreByUnit = useMemo(() => {
    type UnitScoreState = {
      summaryScore?: number;
      parts: Map<number, number>;
    };

    const unitScores = new Map<number, UnitScoreState>();

    [...historyRows]
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
      .forEach((row) => {
        const unitIndex = row.unit_index ?? 1;
        const state = unitScores.get(unitIndex) ?? { parts: new Map<number, number>() };

        if (row.part_index === null) {
          if (state.summaryScore === undefined) {
            state.summaryScore = formatBand(row.score) ?? 0;
          }
        } else if (isSpeakingPartIndex(row.part_index) && !state.parts.has(row.part_index)) {
          state.parts.set(row.part_index, formatBand(row.score) ?? 0);
        }

        unitScores.set(unitIndex, state);
      });

    const finalScores = new Map<number, number>();

    unitScores.forEach((state, unitIndex) => {
      if (state.summaryScore !== undefined) {
        finalScores.set(unitIndex, state.summaryScore);
        return;
      }

      const part1 = state.parts.get(1);
      const part2 = state.parts.get(2);
      const part3 = state.parts.get(3);

      if (part1 !== undefined && part2 !== undefined && part3 !== undefined) {
        finalScores.set(unitIndex, Number(((part1 + part2 + part3) / 3).toFixed(1)));
      }
    });

    return finalScores;
  }, [historyRows]);

  const [unitCards, setUnitCards] = useState<JourneyUnitCard[]>([]);
  const [dynamicUnitCards, setDynamicUnitCards] = useState<JourneyUnitCard[]>([]);
  const effectiveUnitCards = dynamicUnitCards.length ? dynamicUnitCards : unitCards;

  useEffect(() => {
    if (expectedRole !== "user") return;

    const loadTopicDrivenCards = async () => {
      try {
        const { data: sessionUnits, error: suErr } = await supabase
          .from("session_units")
          .select("id, seq, type, title, session_code, description")
          .order("seq", { ascending: true });

        const { data: topics, error: tErr } = await supabase
          .from("topics")
          .select("id, part, title, prompt, is_active, topic_details(id, type, content, order_index)")
          .order("part", { ascending: true });

        console.debug("RoleOverviewPanel: fetched session_units/topics", { sessionUnits, topics, suErr, tErr });

        if (tErr) {
          console.error("RoleOverviewPanel: topics fetch error", tErr);
          return;
        }

        if ((!sessionUnits || sessionUnits.length === 0) && (!topics || topics.length === 0)) {
          console.debug("RoleOverviewPanel: no session_units or topics found");
          return;
        }

        if ((!sessionUnits || sessionUnits.length === 0) && topics && topics.length > 0) {
          const groups = new Map<string, any[]>();
          topics.forEach((t: any) => {
            const key = t.part != null ? `part-${t.part}` : "unknown";
            const current = groups.get(key);
            if (current) {
              current.push(t);
            } else {
              groups.set(key, [t]);
            }
          });

          const cardsFromTopics: JourneyUnitCard[] = Array.from(groups.entries()).map(([key, group], idx) => {
            const part1Items: any[] = [];
            const part3Items: any[] = [];
            let part2Content = { title: "", prompt: "", points: [], takeaway: "" } as JourneyContentItem;

            group.forEach((t: any) => {
              const details = Array.isArray(t.topic_details) ? t.topic_details : [];

              if (t.part === 1) {
                details.filter((d: any) => d.type === "question").forEach((d: any) => part1Items.push({ prompt: d.content, reply: "" }));
              }

              if (t.part === 2) {
                part2Content.title = t.title || part2Content.title;
                part2Content.prompt = t.prompt || part2Content.prompt;
                const bullets = details.filter((d: any) => d.type === "bullet").sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)).map((d: any) => d.content);
                part2Content.points = bullets.slice(0, 4);
                part2Content.takeaway = part2Content.takeaway || "Synchronized from admin";
              }

              if (t.part === 3) {
                details.filter((d: any) => d.type === "question").forEach((d: any) => part3Items.push({ prompt: d.content, reply: "" }));
              }
            });

            return {
              id: `topic-group-${key}`,
              unitIndex: idx + 1,
              mode: "learn",
              title: part2Content.title || group[0]?.title || `Unit ${idx + 1}`,
              subtitle: "Learn mode",
              price: 0,
              topic: part2Content.prompt || group[0]?.prompt || part2Content.title || group[0]?.title || "",
              description: group[0]?.prompt || "",
              accent: "from-brand-500 to-brand-300",
              actionLabel: "Open Learn Hub",
              parts: [
                { id: 1, title: "Part 1", hint: "Chatbot warm-up" },
                { id: 2, title: "Part 2", hint: "Core content card" },
                { id: 3, title: "Part 3", hint: "Chatbot follow-up" },
              ],
              journey: { part1: part1Items, part2: part2Content, part3: part3Items },
            } as JourneyUnitCard;
          });

          setDynamicUnitCards(cardsFromTopics);
          console.debug("RoleOverviewPanel: built cards from topics (no session_units)", { count: cardsFromTopics.length });
          return;
        }

        const safeSessionUnits = sessionUnits ?? [];
        const hasTopicMapping = topics.some((t: any) => t.unit_id || t.topic_code);

        if (!hasTopicMapping) {
          const part1Items: any[] = [];
          const part3Items: any[] = [];
          let part2Content = { title: "", prompt: "", points: [], takeaway: "" } as JourneyContentItem;

          topics.forEach((t: any) => {
            const details = Array.isArray(t.topic_details) ? t.topic_details : [];

            if (t.part === 1) {
              details.filter((d: any) => d.type === "question").forEach((d: any) => {
                part1Items.push({ prompt: d.content, reply: "" });
              });
            }

            if (t.part === 2) {
              part2Content.title = t.title || part2Content.title;
              part2Content.prompt = t.prompt || part2Content.prompt;
              const bullets = details
                .filter((d: any) => d.type === "bullet")
                .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
                .map((d: any) => d.content);
              part2Content.points = bullets.slice(0, 4);
              part2Content.takeaway = part2Content.takeaway || "Synchronized from admin";
            }

            if (t.part === 3) {
              details.filter((d: any) => d.type === "question").forEach((d: any) => {
                part3Items.push({ prompt: d.content, reply: "" });
              });
            }
          });

          const topicTitle = part2Content.title || topics[0]?.title || "Topic";
          const topicPrompt = part2Content.prompt || topics[0]?.prompt || "Start your practice";

          setDynamicUnitCards([
            {
              id: "topic-fallback",
              unitIndex: 1,
              mode: "learn",
              title: topicTitle,
              subtitle: "Learn mode",
              price: 0,
              topic: topicPrompt,
              description: topics[0]?.prompt || "",
              accent: "from-brand-500 to-brand-300",
              actionLabel: "Open Learn Hub",
              parts: [
                { id: 1, title: "Part 1", hint: "Chatbot warm-up" },
                { id: 2, title: "Part 2", hint: "Core content card" },
                { id: 3, title: "Part 3", hint: "Chatbot follow-up" },
              ],
              journey: {
                part1: part1Items,
                part2: {
                  title: part2Content.title || "Core concept",
                  prompt: part2Content.prompt || topicPrompt,
                  points: part2Content.points || [],
                  takeaway: part2Content.takeaway || "Synchronized from admin",
                },
                part3: part3Items,
              },
            },
          ]);
          console.debug("RoleOverviewPanel: built fallback card from topics because no unit mapping was available", { count: topics.length });
          return;
        }

        const cards: JourneyUnitCard[] = safeSessionUnits.map((unit: any) => {
          const seqFormatted = String(unit.seq ?? "").padStart(4, "0");
          const modePrefix = unit.type === "test" ? "TS" : "PT";
          const unitTopics = topics.filter((t: any) => {
            if (t.unit_id && t.unit_id === unit.id) return true;
            const code = (t.topic_code || "").toString();
            if (!code) return false;
            if (unit.session_code && code.includes(unit.session_code)) return true;
            if (code.includes(`${modePrefix}%-${seqFormatted}-P`.replace("%", ""))) return true;
            if (code.includes(`-${seqFormatted}-P`)) return true;
            return false;
          });
          const part1Items: any[] = [];
          const part3Items: any[] = [];
          let part2Content = { title: "", prompt: "", points: [], takeaway: "" } as JourneyContentItem;

          unitTopics.forEach((t: any) => {
            const details = Array.isArray(t.topic_details) ? t.topic_details : [];

            if (t.part === 1) {
              details.filter((d: any) => d.type === "question").forEach((d: any) => {
                part1Items.push({ prompt: d.content, reply: "" });
              });
            }

            if (t.part === 2) {
              part2Content.title = t.title || part2Content.title;
              part2Content.prompt = t.prompt || part2Content.prompt;
              const bullets = details.filter((d: any) => d.type === "bullet").sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)).map((d: any) => d.content);
              part2Content.points = bullets.slice(0, 4);
              part2Content.takeaway = part2Content.takeaway || "Synchronized from admin";
            }

            if (t.part === 3) {
              details.filter((d: any) => d.type === "question").forEach((d: any) => {
                part3Items.push({ prompt: d.content, reply: "" });
              });
            }
          });

          const topicTitle = part2Content.title || unitTopics[0]?.title || "Topic";
          const topicPrompt = part2Content.prompt || unitTopics[0]?.prompt || "Start your practice";

          const unitMode = unit.type === "test" ? "test" : "learn";
          const modeLabel = unitMode === "test" ? "Test mode" : "Learn mode";
          const accent = unitMode === "test" ? "from-amber-500 to-orange-300" : "from-brand-500 to-brand-300";
          const actionLabel = unitMode === "test" ? "Open Test Hub" : "Open Learn Hub";

          return {
            id: unit.id ?? `unit-${unit.seq}`,
            unitIndex: unit.seq ?? 1,
            mode: unitMode,
            title: unit.title ?? `Unit ${unit.seq}`,
            subtitle: modeLabel,
            price: unit.price ?? 0,
            topic: topicPrompt || topicTitle,
            description: unit.description ?? (unit.mode === "test" ? "Strict practice. The order is locked and the coach is connected at test start." : "Flexible practice. Open any part first, then move in your own order."),
            accent,
            actionLabel,
            parts: [
              { id: 1, title: "Part 1", hint: "Chatbot warm-up" },
              { id: 2, title: "Part 2", hint: "Core content card" },
              { id: 3, title: "Part 3", hint: "Chatbot follow-up" },
            ],
            journey: {
              part1: part1Items,
              part2: {
                title: part2Content.title || "Core concept",
                prompt: part2Content.prompt || topicPrompt,
                points: part2Content.points || [],
                takeaway: part2Content.takeaway || "Synchronized from admin",
              },
              part3: part3Items,
            },
          } as JourneyUnitCard;
        });

        setDynamicUnitCards(cards);
        console.debug("RoleOverviewPanel: built dynamic cards from session_units", { count: cards.length });
      } catch (err) {
        console.error("RoleOverviewPanel: error building topic-driven cards", err);
      }
    };

    void loadTopicDrivenCards();
  }, [expectedRole]);

  const completedPartsByUnit = useMemo(() => {
    const unitMap = new Map<number, Set<number>>();

    scoredHistoryRows.forEach((row) => {
      const unitIndex = row.unit_index ?? 1;
      const partIndex = row.part_index ?? 1;
      if (!unitMap.has(unitIndex)) {
        unitMap.set(unitIndex, new Set<number>());
      }
      unitMap.get(unitIndex)?.add(partIndex);
    });

    return unitMap;
  }, [scoredHistoryRows]);

  const lastOpenedUnitIndex = useMemo(() => {
    if (!historyRows || historyRows.length === 0) return null;
    const last = historyRows[historyRows.length - 1];
    return last.unit_index ?? null;
  }, [historyRows]);

  const displayedUnits = useMemo(() => {
    if (lastOpenedUnitIndex !== null) return effectiveUnitCards.filter((u) => u.unitIndex === lastOpenedUnitIndex);
    return effectiveUnitCards.length > 0 ? [effectiveUnitCards[0]] : [];
  }, [lastOpenedUnitIndex, effectiveUnitCards]);

  const getUnitProgress = (unitIndex: number) => {
    const completedCount = completedPartsByUnit.get(unitIndex)?.size ?? 0;
    return Number(((completedCount / 3) * 100).toFixed(1));
  };

  const getPartProgress = (unitIndex: number, partIndex: number) => {
    const completed = completedPartsByUnit.get(unitIndex)?.has(partIndex) ?? false;
    return completed ? 100 : 0;
  };

  const handleUnitPartClick = (unitIndex: number, partIndex: number) => {
    const targetMode = unitIndex === 1 ? "learn" : "test";
    router.push(`/learn?mode=${targetMode}&unit=${unitIndex}&part=${partIndex}&autostart=1&replay=1`);
  };

  const handleConnectCoachForTest = async () => {
    if (!selectedCoachId) {
      setNotice("Please choose a coach first.");
      return;
    }

    setConnectingCoach(true);
    setNotice("");

    const { error } = await supabase.rpc("assign_student_coach", {
      coach: selectedCoachId,
    });

    if (error) {
      setNotice(error.message);
      setConnectingCoach(false);
      return;
    }

    const selectedCoach = coaches.find((coach) => coach.id === selectedCoachId);
    setProfile((prev) => (prev ? { ...prev, coach_id: selectedCoachId } : prev));
    setNotice(selectedCoach ? `Connected to ${selectedCoach.email} for IELTS test.` : "Coach connected for IELTS test.");
    setConnectingCoach(false);
    router.push("/learn?mode=test&unit=2&part=1&autostart=1&replay=1");
  };

  const [modalUnitIndex, setModalUnitIndex] = useState<number | null>(null);
  const openUnitModal = (unitIndex: number) => setModalUnitIndex(unitIndex);
  const closeUnitModal = () => setModalUnitIndex(null);
  const [hoveredPart, setHoveredPart] = useState<number | null>(null);
  const [hoveredUnit, setHoveredUnit] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<'terbaru' | 'terlama'>('terbaru');

  const filterAndSortUnitCards = (cards: JourneyUnitCard[]) => {
    const q = searchQuery.trim().toLowerCase();
    const base = q
      ? cards.filter((u) => {
          const hay = `${u.title} ${u.topic} ${u.description ?? ""}`.toLowerCase();
          return hay.includes(q);
        })
      : [...cards];

    base.sort((a, b) => {
      return sortOrder === 'terbaru'
        ? b.unitIndex - a.unitIndex
        : a.unitIndex - b.unitIndex;
    });

    return base;
  };

  const filteredLearnUnitCards = useMemo(() => {
    return filterAndSortUnitCards(effectiveUnitCards.filter((u) => u.mode === "learn"));
  }, [searchQuery, effectiveUnitCards, sortOrder]);

  const filteredTestUnitCards = useMemo(() => {
    return filterAndSortUnitCards(effectiveUnitCards.filter((u) => u.mode === "test"));
  }, [searchQuery, effectiveUnitCards, sortOrder]);

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500">Loading...</div>
    );
  }

  if (tab === "learn") {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Learn</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Search topics and open a learn unit.</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <label className="sr-only">Sort</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'terbaru' | 'terlama')}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value="terbaru">Terbaru</option>
              <option value="terlama">Terlama</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLearnUnitCards.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
              No learn units configured yet — please ask your admin to create units.
            </div>
          ) : (
            filteredLearnUnitCards.map((unit) => {
              const unitIndex = unit.unitIndex;
              return (
                <UnitCard
                  key={unit.id}
                  subtitle={unit.subtitle}
                  title={unit.title}
                  topic={unit.topic}
                  price={unit.price}
                  progress={getUnitProgress(unitIndex)}
                  status="Active"
                  accent={unit.accent}
                  partsCount={unit.parts?.length}
                  coreFocus={unit.unitIndex === 2}
                  onStart={() => router.push(`/learn?unit=${unitIndex}&part=1&autostart=1`)}
                />
              );
            })
          )}
        </div>
      </section>
    );
  }

  if (tab === "test") {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Test</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Search tests and open a test unit.</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'terbaru' | 'terlama')}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value="terbaru">Terbaru</option>
              <option value="terlama">Terlama</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTestUnitCards.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
              No test units configured yet — please ask your admin to create units.
            </div>
          ) : (
            filteredTestUnitCards.map((unit) => {
              const unitIndex = unit.unitIndex;
              return (
                <UnitCard
                  key={unit.id}
                  subtitle={unit.subtitle}
                  title={unit.title}
                  topic={unit.topic}
                  price={unit.price}
                  progress={getUnitProgress(unitIndex)}
                  status="Active"
                  accent={unit.accent}
                  partsCount={unit.parts?.length}
                  coreFocus={unit.unitIndex === 2}
                  score={latestFinalScoreByUnit.get(unitIndex) ?? null}
                  scoreLabel="Final"
                  onStart={() => router.push(`/learn?mode=test&unit=${unitIndex}&part=1&autostart=1`) }
                />
              );
            })
          )}
        </div>
      </section>
    );
  }

 // Full dashboard view
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">{title}</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        {notice ? <p className="mt-3 text-sm text-warning-600">{notice}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Account Email</p>
          <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-white/90 break-all">{profile?.email ?? userEmail}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Current Role</p>
          <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-white/90">{roleLabel(profile?.role ?? expectedRole)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Member Since</p>
          <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-white/90">{createdLabel}</p>
        </div>
      </div>

      {/* Rangkuman Kartu Nilai */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-white/90">{card.value}</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{card.meta}</p>
          </div>
        ))}
      </div>

      {/* 🔴 SPEAKING SESSION HISTORY & DETAIL BUTTON (FIXED STATE TRIGGER) */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Speaking Session History</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">View your practice sessions and scores breakdown by part.</p>
        </div>
        <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
          {historyBySession.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">No practice history available.</p>
          ) : (
            historyBySession.map((session, i) => (
              <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">{session.date}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Parts: {Array.from(session.parts).sort().join(", ")} • {session.entries.length} attempts
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-600 dark:text-brand-400">{session.avgScore.toFixed(1)}</p>
                    <p className="text-[10px] text-gray-400 uppercase">avg score</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      const targetUnit = session.entries?.[0]?.unit_index ?? 1;
                      const targetPart = session.entries?.[0]?.part_index ?? 1;
                      setHistoryDetailModal({
                        open: true,
                        unit_index: targetUnit,
                        part_index: targetPart
                      });
                    }}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    Detail
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 🔴 AI FEEDBACK BOX + THEMED PDF (WARNA MERAH MAROON & ORANGE ELEGAN) */}
      <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 dark:border-red-500/20 dark:bg-red-500/5 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-#C95B5B dark:text-red-300">AI Feedback Section</h3>
            <p className="text-xs text-red-600 dark:text-red-400">Generated from your latest band and trend.</p>
          </div>
          <button 
            type="button"
            onClick={() => {
              const printWindow = window.open('', '_blank');
              if (printWindow) {
                printWindow.document.write(`
                  <html>
                    <head>
                      <title>IELTS Speaking Report - ${userEmail}</title>
                      <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; background-color: #fafbfd; }
                        .header { background: linear-gradient(135deg, #dc2626, #ea580c); color: white; padding: 30px; border-radius: 16px; margin-bottom: 25px; }
                        .header h1 { margin: 0; font-size: 22pt; font-weight: 700; }
                        .header p { margin: 5px 0 0 0; opacity: 0.95; font-size: 11pt; }
                        .info-grid { display: flex; gap: 15px; margin-bottom: 25px; }
                        .card { flex: 1; background: white; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; }
                        .card-label { font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: bold; }
                        .card-val { font-size: 16pt; font-weight: bold; color: #1e293b; margin-top: 5px; }
                        .feedback-box { border: 1px solid #fca5a5; background: #fff5f5; padding: 20px; border-radius: 12px; margin-bottom: 25px; }
                        .feedback-box h3 { margin-top: 0; color: #991b1b; font-size: 13pt; }
                        ul { padding-left: 20px; margin: 0; }
                        li { margin-bottom: 8px; font-size: 10.5pt; color: #7f1d1d; }
                        @media print {
                          body { background: white; padding: 0; }
                          .header { background: linear-gradient(135deg, #dc2626, #ea580c) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                          .feedback-box { background: #fff5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        }
                      </style>
                    </head>
                    <body>
                      <div class="header">
                        <h1>IELTS Speaking Performance Report</h1>
                        <p>Official AI Hub Diagnostic Evaluation Summary</p>
                      </div>
                      <div class="info-grid">
                        <div class="card"><div class="card-label">Email Account</div><div class="card-val" style="font-size: 11pt; word-break: break-all;">${userEmail}</div></div>
                        <div class="card"><div class="card-label">Estimated Band</div><div class="card-val">${latestBand !== null ? latestBand.toFixed(1) : 'N/A'}</div></div>
                        <div class="card"><div class="card-label">Current Level</div><div class="card-val" style="font-size: 11pt;">${getCurrentLevelLabel(latestBand)}</div></div>
                      </div>
                      <div class="feedback-box">
                        <h3>AI Performance Review & Recommendation:</h3>
                        <ul>${aiFeedback.map(point => `<li>${point}</li>`).join('')}</ul>
                      </div>
                      <p style="font-size: 9pt; color: #94a3b8; text-align: center; margin-top: 50px;">Generated automatically via Lexa Speak IELTS Dashboard on ${new Date().toLocaleDateString()}</p>
                      <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }</script>
                    </body>
                  </html>
                `);
                printWindow.document.close();
              }
            }}
            className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 transition cursor-pointer"
          >
            Download PDF Report
          </button>
        </div>
        <div className="mt-3">
          <p className="text-xs font-bold text-red-800 dark:text-red-400 uppercase tracking-wider">Latest Review</p>
          <ul className="mt-1 space-y-2 list-disc list-inside text-sm text-red-900/80 dark:text-gray-300">
            {aiFeedback.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* ==================== SEKSI UNITS & RADAR CHART ==================== */}
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">Units</p>
          <div className="mt-4 grid gap-4 grid-cols-1">
            {displayedUnits.map((unit) => {
              const unitProgress = getUnitProgress(unit.unitIndex);
              return (
                <div key={unit.id} className="relative overflow-hidden rounded-[20px] border border-gray-100 p-14 shadow-sm dark:border-gray-800 bg-white">
                  <h4 className="text-4xl font-bold text-gray-800 dark:text-white/90">{unit.title}</h4>
                  <p className="text-sm text-gray-500 mt-1">{unit.subtitle}</p>
                  <p className="mt-4 text-base text-gray-700 dark:text-gray-300">{unit.topic}</p>
                  <div className="mt-6 h-2.5 rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className={`h-full rounded-full bg-gradient-to-r ${unit.accent}`} style={{ width: `${unitProgress}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
                    <span>{unitProgress}% complete</span>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => openUnitModal(unit.unitIndex)} className="text-brand-600 font-medium">View Parts</button>
                      <button onClick={() => router.push(`/learn?unit=${unit.unitIndex}&part=1&autostart=1`)} className="rounded-md bg-brand-500 px-3 py-1 text-sm text-white">Start</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Radar Chart */}
        <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">Skill Breakdown</p>
          <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-white/[0.02] overflow-visible">
            <SvgRadar values={skillBreakdown.values} />
          </div>
        </div>
      </div>
{/* ==================== 🔴 SEKSI MODAL DETAIL EVALUASI (COMBINATION: CARDS + TABS FILTER LOGS) ==================== */}
      {historyDetailModal.open && (() => {
        // 1. Ambil semua baris data dari database untuk unit yang dipilih
        const targetedRows = historyRows.filter(
          (row) => row.unit_index === historyDetailModal.unit_index
        );

        // 2. Fungsi hitung statistik rata-rata untuk 3 Card di atas
        const getPartStats = (pIndex: number) => {
          const partRows = targetedRows.filter((r) => r.part_index === pIndex);
          const attempts = partRows.length;
          const scores = partRows.map((r) => formatBand(r.score) || 0);
          const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          return { attempts, avg };
        };

        const part1 = getPartStats(1);
        const part2 = getPartStats(2);
        const part3 = getPartStats(3);

        // 3. Hitung total akumulasi rata-rata (Overall Sesi)
        const allScores = targetedRows.map((r) => formatBand(r.score) || 0);
        const overallAvg = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

        // Filter log pengerjaan di bagian bawah sesuai tab part yang aktif
        const filteredLogs = targetedRows
          .filter((row) => row.part_index === activeTab)
          .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-800">
              
              {/* Header Modal */}
              <div className="flex items-start justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
                <div>
                  <h3 className="text-lg font-bold text-gray-950 dark:text-white">Practice Session Breakdown</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Detailed analysis and average bandwidth for Unit {historyDetailModal.unit_index}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">
                    Overall Avg: {overallAvg.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* SECTION 1: Grid 3 Kolom Card (Part 1, 2, 3 + Average) */}
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {/* CARD PART 1 */}
                <button
                  type="button"
                  onClick={() => setActiveTab(1)}
                  className={`rounded-2xl border p-4 text-center transition cursor-pointer ${
                    activeTab === 1 
                      ? "border-red-500 bg-red-50/30 dark:bg-red-950/10" 
                      : "border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-white/[0.01]"
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Part 1</p>
                  <div className="my-2">
                    <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
                      {part1.attempts > 0 ? part1.avg.toFixed(1) : "-"}
                    </span>
                    {part1.attempts > 0 && <span className="text-xs text-gray-400 font-medium"> band</span>}
                  </div>
                  <p className="text-[10px] font-medium text-gray-500 bg-white dark:bg-gray-800 py-0.5 px-2 rounded-full inline-block border border-gray-100 dark:border-gray-700">
                    {part1.attempts} {part1.attempts === 1 ? 'Attempt' : 'Attempts'}
                  </p>
                </button>

                {/* CARD PART 2 */}
                <button
                  type="button"
                  onClick={() => setActiveTab(2)}
                  className={`rounded-2xl border p-4 text-center transition cursor-pointer ${
                    activeTab === 2 
                      ? "border-red-500 bg-red-50/30 dark:bg-red-950/10" 
                      : "border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-white/[0.01]"
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Part 2</p>
                  <div className="my-2">
                    <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
                      {part2.attempts > 0 ? part2.avg.toFixed(1) : "-"}
                    </span>
                    {part2.attempts > 0 && <span className="text-xs text-gray-400 font-medium"> band</span>}
                  </div>
                  <p className="text-[10px] font-medium text-gray-500 bg-white dark:bg-gray-800 py-0.5 px-2 rounded-full inline-block border border-gray-100 dark:border-gray-700">
                    {part2.attempts} {part2.attempts === 1 ? 'Attempt' : 'Attempts'}
                  </p>
                </button>

                {/* CARD PART 3 */}
                <button
                  type="button"
                  onClick={() => setActiveTab(3)}
                  className={`rounded-2xl border p-4 text-center transition cursor-pointer ${
                    activeTab === 3 
                      ? "border-red-500 bg-red-50/30 dark:bg-red-950/10" 
                      : "border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-white/[0.01]"
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Part 3</p>
                  <div className="my-2">
                    <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
                      {part3.attempts > 0 ? part3.avg.toFixed(1) : "-"}
                    </span>
                    {part3.attempts > 0 && <span className="text-xs text-gray-400 font-medium"> band</span>}
                  </div>
                  <p className="text-[10px] font-medium text-gray-500 bg-white dark:bg-gray-800 py-0.5 px-2 rounded-full inline-block border border-gray-100 dark:border-gray-700">
                    {part3.attempts} {part3.attempts === 1 ? 'Attempt' : 'Attempts'}
                  </p>
                </button>
              </div>

              {/* SECTION 2: Filtered Logs Section Heading */}
              <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Detailed Session History — Part {activeTab}
                </p>
                <p className="text-[10px] text-gray-400 font-medium">Click an attempt row to open result page</p>
              </div>

              {/* SECTION 3: Penjabaran List Sesi Hasil Filter */}
              <div className="mt-3 max-h-[180px] overflow-y-auto space-y-2 pr-1">
                {filteredLogs.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-6">No practice session records found for Part {activeTab}.</p>
                ) : (
                  filteredLogs.map((record) => {
                    const recordDate = new Date(record.recorded_at);
                    const timeString = recordDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const dateString = recordDate.toLocaleDateString([], { day: 'numeric', month: 'short' });

                    return (
                      <button
                        key={record.id}
                        type="button"
                        onClick={() => {
                          setHistoryDetailModal({ open: false, unit_index: null, part_index: null });
                          router.push(`/learn/result?id=${record.id}`);
                        }}
                        className="w-full flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/40 p-2.5 text-left transition hover:border-red-300 hover:bg-red-50/20 dark:border-gray-800 dark:bg-white/[0.01] dark:hover:border-red-900/40 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-[11px] font-medium text-gray-400 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-2 py-0.5 rounded-md">
                            {dateString} • {timeString}
                          </div>
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {record.speaking_attempts} Speaking {record.speaking_attempts === 1 ? 'Attempt' : 'Attempts'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">
                            Band {(formatBand(record.score) ?? 0).toFixed(1)}
                          </span>
                          <span className="text-[10px] text-gray-400 group-hover:text-red-500 transition font-medium">→</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer Modal Controls */}
              <div className="mt-5 flex justify-end border-t border-gray-100 pt-3 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setHistoryDetailModal({ open: false, unit_index: null, part_index: null })}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </section>
  );
}