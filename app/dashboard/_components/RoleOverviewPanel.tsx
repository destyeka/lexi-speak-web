"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import UnitCard from "./UnitCard";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

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
  unit_index: number | null;
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
  }, [expectedRole, router]);

  const createdLabel = useMemo(() => {
    if (!profile?.created_at) return "-";
    return new Date(profile.created_at).toLocaleDateString();
  }, [profile?.created_at]);

  const currentCoachLabel = useMemo(() => {
    if (!profile?.coach_id) return "Not connected yet";
    return coaches.find((coach) => coach.id === profile.coach_id)?.email ?? "Connected coach";
  }, [coaches, profile?.coach_id]);

  const latestBand = useMemo(() => formatBand(progress?.latest_score ?? null), [progress?.latest_score]);

  const previousBand = useMemo(() => {
    if (historyRows.length < 2) return null;
    return formatBand(historyRows[historyRows.length - 2]?.score ?? null);
  }, [historyRows]);

  const weeklyDelta = useMemo(() => {
    if (historyRows.length === 0) return 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRows = historyRows.filter((row) => new Date(row.recorded_at) >= sevenDaysAgo);
    if (recentRows.length < 2) return 0;

    const firstBand = formatBand(recentRows[0]?.score ?? null) ?? 0;
    const lastBand = formatBand(recentRows[recentRows.length - 1]?.score ?? null) ?? 0;
    return lastBand - firstBand;
  }, [historyRows]);

  const progressTrend = useMemo(() => {
    const categories = historyRows.map((row) => new Date(row.recorded_at).toLocaleDateString());
    const data = historyRows.map((row) => formatBand(row.score) ?? 0);

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
  }, [historyRows]);

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
      colors: ["#465FFF"],
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

  const practiceHistoryRows = useMemo(() => {
    return [...historyRows].slice(-8).reverse();
  }, [historyRows]);

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
      value: `${historyRows.length}`,
      meta: "Saved speaking sessions",
    },
  ];

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
          .select("id, unit_id, topic_code, part, title, prompt, is_active, topic_details(id, type, content, order_index)")
          .order("unit_id, part", { ascending: true });

        console.debug("RoleOverviewPanel: fetched session_units/topics", { sessionUnits, topics, suErr, tErr });

        if (tErr) {
          console.error("RoleOverviewPanel: topics fetch error", tErr);
          return;
        }

        if ((!sessionUnits || sessionUnits.length === 0) && (!topics || topics.length === 0)) {
          console.debug("RoleOverviewPanel: no session_units or topics found");
          return;
        }

        // If admin created topics but didn't create session_units, build units from topics grouping
        if ((!sessionUnits || sessionUnits.length === 0) && topics && topics.length > 0) {
          const groups = new Map<string, any[]>();
          topics.forEach((t: any) => {
            const key = t.unit_id || (t.topic_code ? t.topic_code.split("-")[0] : "unknown");
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
              if (t.part === 1) details.filter((d: any) => d.type === "question").forEach((d: any) => part1Items.push({ prompt: d.content, reply: "" }));
              if (t.part === 2) {
                part2Content.title = t.title || part2Content.title;
                part2Content.prompt = t.prompt || part2Content.prompt;
                const bullets = details.filter((d: any) => d.type === "bullet").sort((a: any,b:any)=> (a.order_index||0)-(b.order_index||0)).map((d:any)=>d.content);
                part2Content.points = bullets.slice(0,4);
              }
              if (t.part === 3) details.filter((d: any) => d.type === "question").forEach((d: any) => part3Items.push({ prompt: d.content, reply: "" }));
            });

            return {
              id: `topic-group-${key}`,
              unitIndex: idx + 1,
              mode: "learn",
              title: part2Content.title || group[0]?.title || `Unit ${idx + 1}`,
              subtitle: "Learn mode",
              price: 0,
              topic: part2Content.title || group[0]?.title || "",
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

        // Build cards from session_units, populated with topic data
        const safeSessionUnits = sessionUnits ?? [];
        const cards: JourneyUnitCard[] = safeSessionUnits.map((unit: any) => {
          // Find all topics for this unit. Prefer explicit unit_id, but fallback
          // to matching by session_code / seq if admin created topics without unit_id.
          const seqFormatted = String(unit.seq ?? "").padStart(4, "0");
          const modePrefix = unit.type === "test" ? "TS" : "PT";
          const unitTopics = topics.filter((t: any) => {
            if (t.unit_id && t.unit_id === unit.id) return true;
            const code = (t.topic_code || "").toString();
            if (!code) return false;
            if (unit.session_code && code.includes(unit.session_code)) return true;
            if (code.includes(`${modePrefix}%-${seqFormatted}-P`.replace("%",""))) return true;
            // also match by seq pattern fragment
            if (code.includes(`-${seqFormatted}-P`)) return true;
            return false;
          });
          
          // Build part contents from all topics for this unit
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
            topic: topicTitle,
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

    historyRows.forEach((row) => {
      const unitIndex = row.unit_index ?? 1;
      const partIndex = row.part_index ?? 1;
      if (!unitMap.has(unitIndex)) {
        unitMap.set(unitIndex, new Set<number>());
      }
      unitMap.get(unitIndex)?.add(partIndex);
    });

    return unitMap;
  }, [historyRows]);

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

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-sm text-gray-500 dark:text-gray-400">Quick Access</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/dashboard/profile"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            Open Profile
          </Link>
          <Link
            href="/dashboard/notifications"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            View Notifications
          </Link>
        </div>
      </div>

      {expectedRole === "user" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-white/90">{card.value}</p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{card.meta}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Unit modal */}
      {modalUnitIndex !== null && (() => {
        const unit = effectiveUnitCards[modalUnitIndex - 1] as any;
        const unitIndex = modalUnitIndex;
        if (!unit) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={closeUnitModal} />
            <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{unit.title}</h3>
                  <p className="text-sm text-gray-500">{unit.subtitle}</p>
                </div>
                <button onClick={closeUnitModal} className="text-sm text-gray-500">Close</button>
              </div>

              <div className="mt-4 space-y-3">
                {unit.parts.map((part: any) => {
                  const partProgress = getPartProgress(unitIndex, part.id);
                  return (
                    <div key={part.id} className="rounded-lg border border-gray-100 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{part.title}</div>
                          <div className="text-xs text-gray-500">{part.hint}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleUnitPartClick(unitIndex, part.id)} className="rounded-full bg-brand-500 px-3 py-1 text-xs text-white">Open chat session</button>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300" style={{ width: `${partProgress}%` }} />
                        </div>
                        <div className="text-xs text-gray-500">{partProgress.toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {expectedRole === "user" ? (
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">Units</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Practice speaking units — hover progress to preview parts.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Learn & Test
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {effectiveUnitCards.length === 0 ? (
                <div className="col-span-full rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                  No units configured by admin. Please contact your administrator to add units and topics.
                </div>
              ) : (
                effectiveUnitCards.map((unit, idx) => {
                  const unitIndex = idx + 1;
                  const unitProgress = getUnitProgress(unitIndex);
                  return (
                    <div key={unit.id} className="relative overflow-hidden rounded-[20px] border border-gray-100 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:border-gray-800 dark:bg-white/[0.02]">
                      <div className={`pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full blur-3xl ${unit.accent}`} />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">{unit.subtitle}</p>
                          <h4 className="mt-1 text-base font-semibold text-gray-800 dark:text-white/90">{unit.title}</h4>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r ${unit.accent}`}>3 Parts</span>
                          {unitIndex === 2 ? <span className="mt-2 text-xs font-medium text-amber-600">Core focus</span> : null}
                        </div>
                      </div>

                      <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{unit.topic}</p>

                      <div className="mt-4">
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                          <div className={`h-full rounded-full bg-gradient-to-r ${unit.accent}`} style={{ width: `${unitProgress}%` }} />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                          <span>{unitProgress.toFixed(1)}% complete</span>
                          <button onClick={() => openUnitModal(unitIndex)} className="text-xs font-medium text-brand-600">View</button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">Skill Breakdown</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Estimated IELTS skill profile.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Radar Chart
              </span>
            </div>

            <div className="mt-4">
              <ReactApexChart options={skillBreakdown.options} series={skillBreakdown.series} type="radar" height={320} />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                ["Fluency", skillBreakdown.values.fluency],
                ["Lexical", skillBreakdown.values.lexical],
                ["Grammar", skillBreakdown.values.grammar],
                ["Pronunciation", skillBreakdown.values.pronunciation],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.03]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{label}</span>
                    <span className="font-semibold text-gray-800 dark:text-white/90">{Number(value).toFixed(1)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white dark:bg-gray-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300" style={{ width: `${(Number(value) / 9) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {expectedRole === "user" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">AI Feedback Section</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Generated from your latest band and trend.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Latest Review
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {aiFeedback.map((point) => (
                <div key={point} className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:bg-white/[0.03] dark:text-gray-300">
                  {point}
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Coach Notes</p>
              <p className="mt-2">{progress?.notes ?? "No coach notes yet."}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">Practice History Table</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Recent speaking sessions and saved bands.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {practiceHistoryRows.length} Rows
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
              <div className="max-h-[320px] overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Part</th>
                      <th className="px-4 py-3">Band</th>
                      <th className="px-4 py-3">Attempts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {practiceHistoryRows.length > 0 ? (
                      practiceHistoryRows.map((row) => (
                        <tr key={row.id} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{new Date(row.recorded_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.unit_index ?? 1}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.part_index ?? 1}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white/90">{formatBand(row.score)?.toFixed(1) ?? "-"}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.speaking_attempts}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={5}>
                          No practice history yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {expectedRole === "user" ? (
        <div className="grid gap-6 lg:grid-cols-2">
                {effectiveUnitCards.map((unit, unitOffset) => {
            const unitIndex = unitOffset + 1;
            const unitProgress = getUnitProgress(unitIndex);

            return (
              <div
                key={unit.id}
                className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">{unit.subtitle}</p>
                    <h3 className="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">{unit.title}</h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{unit.description}</p>
                  </div>
                  <span className={`rounded-full bg-gradient-to-r ${unit.accent} px-3 py-1 text-xs font-semibold text-white`}>3 Parts</span>
                </div>

                {/* Progress bar + interactive segments */}
                <div
                  className="relative mt-4"
                  onMouseEnter={() => setHoveredUnit(unitIndex)}
                  onMouseLeave={() => {
                    setHoveredUnit(null);
                    setHoveredPart(null);
                  }}
                >
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Overall progress</span>
                    <span>{unitProgress.toFixed(1)}%</span>
                  </div>

                  <div className="relative mt-2 h-3 rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className={`absolute left-0 top-0 bottom-0 rounded-full bg-gradient-to-r ${unit.accent}`} style={{ width: `${unitProgress}%` }} />

                    {unit.parts.map((part, idx) => {
                      const segLeft = (idx / unit.parts.length) * 100;
                      const segWidth = 100 / unit.parts.length;
                      return (
                        <div
                          key={`seg-${unit.id}-${part.id}`}
                          onMouseEnter={() => setHoveredPart(part.id)}
                          onMouseLeave={() => setHoveredPart(null)}
                          onClick={() => handleUnitPartClick(unitIndex, part.id)}
                          className="absolute top-0 bottom-0"
                          style={{ left: `${segLeft}%`, width: `${segWidth}%`, cursor: "pointer" }}
                          aria-hidden
                        />
                      );
                    })}

                    {/* Tooltip when hovering a segment */}
                    {hoveredPart && hoveredUnit === unitIndex && (() => {
                      const idx = hoveredPart - 1;
                      const segCenter = ((idx + 0.5) / unit.parts.length) * 100;
                      const part = unit.parts[idx];
                      const preview = part.id === 2 ? unit.journey.part2.prompt : (unit.journey[`part${part.id}` as keyof typeof unit.journey] as JourneyChatItem[])[0]?.prompt ?? "Preview";
                      return (
                        <div className="absolute -top-14 z-20 w-64 -translate-x-1/2 rounded-lg bg-white px-3 py-2 text-sm text-gray-700 shadow-lg ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200" style={{ left: `${segCenter}%` }}>
                          <div className="font-semibold">{part.hint}</div>
                          <div className="mt-1 text-xs text-gray-500 line-clamp-2">{preview}</div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Reveal square preview cards only on hover of the progress area */}
                  <div className={`mt-4 grid gap-4 md:grid-cols-3 transition-all ${hoveredUnit === unitIndex ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-2'}`}>
                    {unit.parts.map((part) => {
                      const pid = part.id;
                      const partProgress = getPartProgress(unitIndex, pid);
                      const isCore = pid === 2;
                      const preview = isCore ? unit.journey.part2.prompt : (unit.journey[`part${pid}` as keyof typeof unit.journey] as JourneyChatItem[])[0]?.prompt ?? "";

                      return (
                        <button
                          key={`card-${unit.id}-${pid}`}
                          type="button"
                          onClick={() => handleUnitPartClick(unitIndex, pid)}
                          className={`w-full h-36 text-left rounded-[20px] border p-4 transition-transform ${isCore ? 'border-amber-200 bg-amber-50 shadow-lg' : 'border-gray-200 bg-white dark:bg-gray-900'}`}
                          aria-label={`Open part ${pid}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="sr-only">{`Part ${pid} ${part.title}`}</div>
                            <div className="text-sm text-gray-500">{/* minimal visual */}</div>
                            <div className={`h-8 w-8 rounded-full ${isCore ? 'bg-amber-200' : 'bg-gray-100'}`} />
                          </div>
                          <p className="mt-4 text-sm text-gray-700 dark:text-gray-300 line-clamp-3">{preview}</p>
                          <div className="mt-4 flex items-center justify-between">
                            <div className="h-2 flex-1 mr-3 overflow-hidden rounded-full bg-white dark:bg-gray-800">
                              <div className={`h-full rounded-full ${isCore ? 'bg-amber-500' : 'bg-gradient-to-r from-brand-500 to-brand-300'}`} style={{ width: `${partProgress}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{partProgress.toFixed(0)}%</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

    </section>
  );
}
