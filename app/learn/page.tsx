"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { AnalysisCard } from "@/components/ui/system/AnalysisCard";
import { supabase } from "@/lib/supabase";
import {
  getAssignmentTopics,
  getBulletsFromTopic,
  getQuestionsFromTopic,
  getTopicsByUnit,
  type Topic,
} from "@/lib/question-fetcher";

interface PageMap {
  INTRO: "intro";
  SESSION: "session";
  RESULT: "result";
  PART2_INTRO: "part2_intro";
  PART2_SESSION: "part2_session";
  PART2_RESULT: "part2_result";
  PART3_INTRO: "part3_intro";
  PART3_SESSION: "part3_session";
  PART3_RESULT: "part3_result";
}
interface ChatMessage { role: string; text: string; }

interface SessionPageProps {
  topic?: Topic | null;
  messages?: ChatMessage[];
  isListening: boolean;
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
  recError: string | null;
  setRecError: (value: string | null) => void;
  transcript: string;
  setTranscript: React.Dispatch<React.SetStateAction<string>>;
  liveTranscript: string;
  setLiveTranscript: React.Dispatch<React.SetStateAction<string>>;
  interimTranscript: string;
  setInterimTranscript: React.Dispatch<React.SetStateAction<string>>;
  onSaveQuestionTranscripts?: (arr: string[]) => void;
}

interface SessionPagePart2Props {
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
  transcript: string;
  setTranscript: React.Dispatch<React.SetStateAction<string>>;
  liveTranscript: string;
  setLiveTranscript: React.Dispatch<React.SetStateAction<string>>;
  interimTranscript: string;
  setInterimTranscript: React.Dispatch<React.SetStateAction<string>>;
  recError: string | null;
  setRecError: (value: string | null) => void;
  isListening: boolean;
  topic: Topic | null;
  bullets?: string[];
  isLoading?: boolean;
}

interface ResultPageProps {
  transcript: string;
  topic: Topic | null;
  partLabel: string;
  unitIndex: number | null;
  partIndex: number;
  mode?: "learn" | "test" | null;
}

interface MetricData {
  id: string;
  label: string;
  score: string;
  text: string;
}

interface EvaluationResult {
  overall: string;
  level: string;
  metrics: MetricData[];
  recommendation: string;
  analysis: string;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string }; }>;
}
interface SpeechRecognitionErrorEventLike { error: string; }
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

const PAGES: PageMap = {
  INTRO: "intro",
  SESSION: "session",
  RESULT: "result",
  PART2_INTRO: "part2_intro",
  PART2_SESSION: "part2_session",
  PART2_RESULT: "part2_result"
  , PART3_INTRO: "part3_intro",
  PART3_SESSION: "part3_session",
  PART3_RESULT: "part3_result"
};

type PageValue = PageMap[keyof PageMap];

const PulseRing = ({ color = "#ef4444", size = 180 }: { color?: string; size?: number }) => (
  <div style={{ position: "absolute", width: size, height: size, borderRadius: "50%", background: `radial-gradient(circle, ${color}33 0%, ${color}11 50%, transparent 75%)`, animation: "pulseGlow 2.5s ease-in-out infinite", pointerEvents: "none" }} />
);

function DetailBubbleList({
  label,
  items,
  accent,
}: {
  label: string;
  items: string[];
  accent: string;
}) {
  if (items.length === 0) return null;

  return (
    <div style={styles.detailSection}>
      <p style={styles.instructionLabel}>{label}</p>
      <div style={styles.detailWrap}>
        {items.map((item, index) => (
          <div
            key={`${label}-${index}-${item}`}
            style={{
              ...styles.detailBubble,
              borderColor: `${accent}33`,
              background: `${accent}10`,
              color: accent,
            }}
          >
            <span
              style={{
                ...styles.detailIndex,
                borderColor: accent,
                color: accent,
              }}
            >
              {index + 1}
            </span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

async function persistPracticeResult({
  transcript,
  topic,
  partLabel,
  partIndex,
  unitIndex,
}: {
  transcript: string;
  topic: Topic | null;
  partLabel: string;
  partIndex: number;
  unitIndex: number | null;
}) {
  const trimmedTranscript = transcript.trim();
  if (!trimmedTranscript) return;

  const rubricItems = (topic?.details || [])
    .map((detail) => ({
      title: detail.content.trim(),
      rubric: detail.rubric?.trim() || "",
    }))
    .filter((item) => item.rubric.length > 0);

  const response = await fetch("/api/evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transcript: trimmedTranscript,
      topicTitle: topic?.title ?? partLabel,
      topicPrompt: topic?.prompt ?? "",
      rubricItems: rubricItems.map((item) => `${item.title}${item.rubric ? `: ${item.rubric}` : ""}`),
      partLabel,
    }),
  });

  if (!response.ok) return;

  const evaluation = (await response.json()) as any;
  const latestScore = Number(evaluation.overall);
  if (!Number.isFinite(latestScore)) return;

  const progressPercent = Number(Math.max(0, Math.min(100, (latestScore / 9) * 100)).toFixed(1));
  const metricPayload = Array.isArray(evaluation.metrics)
    ? evaluation.metrics.map((metric: MetricData) => ({
      id: metric.id,
      label: metric.label,
      score: Number(metric.score),
      text: metric.text,
    }))
    : [];


  console.log(
    "PRACTICE METRICS",
    JSON.stringify(metricPayload, null, 2)
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) return;

  await fetch("/api/student-practice-progress", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      latest_score: latestScore,
      progress_percent: progressPercent,
      speaking_attempts: 1,
      last_activity_at: new Date().toISOString(),
      last_unit_index: unitIndex,
      last_part_index: partIndex,
      notes: evaluation.recommendation ?? null,
      metrics: metricPayload,
      attempt_type: "practice",
    }),
  });
}

export default function LexaPracticeSession() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState<PageValue>(PAGES.INTRO);
  const [time, setTime] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [sessionTopics, setSessionTopics] = useState<Topic[]>([]);
  const [isTopicsLoading, setIsTopicsLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const assignmentAutoStartedRef = useRef(false);

  // PART 3 state (mirip Part 1)
  const [transcriptPart3, setTranscriptPart3] = useState("");

  // PERBAIKAN 1: Pisah state transkrip agar Part 1 tidak terhapus oleh Part 2
  const [transcriptPart1, setTranscriptPart1] = useState("");
  const [transcriptPart2, setTranscriptPart2] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [assignmentActionStatus, setAssignmentActionStatus] = useState<"idle" | "saving" | "saved" | "error" | "submitted">("idle");
  const [assignmentActionError, setAssignmentActionError] = useState<string | null>(null);

  const assignmentId = searchParams.get("assignmentId");
  const assignmentPartParam = Number.parseInt(searchParams.get("part") ?? "", 10);
  const shouldAutoStart = searchParams.get("autostart") === "1";
  const unitId = searchParams.get("unit");
  const mode = searchParams.get("mode") as "learn" | "test" | null;
  const unitIndex = Number.parseInt(unitId ?? "", 10);
  const resolvedUnitIndex = Number.isFinite(unitIndex) ? unitIndex : null;

  useEffect(() => {
    let cancelled = false;

    const loadTopics = async () => {
      setAssignmentError(null);
      setIsTopicsLoading(true);

      if (assignmentId) {
        const topics = await getAssignmentTopics(assignmentId);
        if (!cancelled) {
          setSessionTopics(topics);
          setIsTopicsLoading(false);
          if (!topics.length) {
            setAssignmentError("Assignment not found or assignment content is unavailable.");
          }
        }
        return;
      }

      if (!unitId) {
        if (!cancelled) {
          setSessionTopics([]);
          setIsTopicsLoading(false);
        }
        return;
      }

      const topics = await getTopicsByUnit(unitId, mode);

      if (!cancelled) {
        setSessionTopics(topics);
        setIsTopicsLoading(false);
      }
    };

    loadTopics();

    return () => {
      cancelled = true;
    };
  }, [assignmentId, unitId, mode]);

  useEffect(() => {
    if (!assignmentId) return;
    let cancelled = false;

    const checkAssignmentSubmission = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user || cancelled) return;

      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("status")
        .eq("assignment_id", assignmentId)
        .eq("student_id", user.id)
        .maybeSingle();

      if (!cancelled && !error && (data?.status === "submitted" || data?.status === "complete")) {
        setAssignmentActionStatus("submitted");
      }
    };

    void checkAssignmentSubmission();

    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  useEffect(() => {
    if (!assignmentId || !sessionTopics.length) return;
    if (assignmentAutoStartedRef.current) return;
    if (assignmentActionStatus === "submitted") return;

    const part = sessionTopics[0]?.part ?? assignmentPartParam;
    if (shouldAutoStart) {
      assignmentAutoStartedRef.current = true;
      if (part === 2) {
        startPart2Session();
      } else if (part === 3) {
        startPart3Session();
      } else {
        startSession();
      }
      return;
    }

    if (part === 2 && page === PAGES.INTRO) {
      setPage(PAGES.PART2_INTRO);
    } else if (part === 3 && page === PAGES.INTRO) {
      setPage(PAGES.PART3_INTRO);
    }
  }, [assignmentId, assignmentPartParam, page, sessionTopics, shouldAutoStart]);

  const part1Topic = sessionTopics.find((topic) => topic.part === 1) ?? null;
  const part2Topic = sessionTopics.find((topic) => topic.part === 2) ?? null;
  const part3Topic = sessionTopics.find((topic) => topic.part === 3) ?? null;

  const isAssignment = Boolean(assignmentId);
  const currentAssignmentPart = page === PAGES.PART2_INTRO || page === PAGES.PART2_SESSION || page === PAGES.PART2_RESULT
    ? 2
    : page === PAGES.PART3_INTRO || page === PAGES.PART3_SESSION || page === PAGES.PART3_RESULT
      ? 3
      : 1;

  const part1Questions = part1Topic ? getQuestionsFromTopic(part1Topic) : [];
  const part2BulletsRaw = part2Topic ? getBulletsFromTopic(part2Topic) : [];
  const part2QuestionsRaw = part2Topic ? getQuestionsFromTopic(part2Topic) : [];
  const part2Bullets = part2BulletsRaw.length ? part2BulletsRaw : part2QuestionsRaw;
  const part3Questions = part3Topic ? getQuestionsFromTopic(part3Topic) : [];
  const part3Bullets = part3Topic ? getBulletsFromTopic(part3Topic) : [];

  const part3Messages = part3Topic
    ? [
      {
        role: "lexa",
        text: `We’ve moved on to Part 3. Let’s discuss ${part3Topic.title}.`,
      },
      {
        role: "lexa",
        text: part3Topic.prompt
          ? part3Topic.prompt
          : "I’ll ask more abstract questions related to this topic.",
      },
    ]
    : [
      {
        role: "lexa",
        text: "We’ve moved on to Part 3. I’ll ask more abstract follow-up questions.",
      },
    ];

  const startSession = () => {
    if (isAssignmentLocked) return;
    setTime(5 * 60);
    setIsListening(true);
    setIsRecording(false);
    setRecError(null);
    setInterimTranscript("");
    setTranscriptPart1("");
    setLiveTranscript("");
    setPage(PAGES.SESSION);
  };

  const startPart2Session = () => {
    if (isAssignmentLocked) return;
    setTime(2 * 60);
    setIsListening(true);
    setIsRecording(false);
    setRecError(null);
    setInterimTranscript("");
    setTranscriptPart2("");
    setLiveTranscript("");
    setPage(PAGES.PART2_SESSION);
  };

  const startPart3Session = () => {
    if (isAssignmentLocked) return;
    // Part 3 UI should mirror Part 1 (longer turn)
    setTime(5 * 60);
    setIsListening(true);
    setIsRecording(false);
    setRecError(null);
    setInterimTranscript("");
    setTranscriptPart3("");
    setLiveTranscript("");
    setPage(PAGES.PART3_SESSION);
  };

  // PERBAIKAN 2: Tangkap sisa teks interim sebelum berpindah ke halaman result
  const finishSession = () => {
    setIsListening(false);
    setIsRecording(false);

    const remainingText = liveTranscript.trim() || interimTranscript.trim();

    if (page === PAGES.PART3_SESSION) {
      const finalTranscript = (transcriptPart3 + (remainingText ? ` ${remainingText}` : "")).trim();
      if (remainingText && !transcriptPart3.includes(remainingText)) {
        setTranscriptPart3(finalTranscript);
      }
      setPage(PAGES.PART3_RESULT);
    } else if (page === PAGES.PART2_SESSION) {
      const finalTranscript = (transcriptPart2 + (remainingText ? ` ${remainingText}` : "")).trim();
      if (remainingText && !transcriptPart2.includes(remainingText)) {
        setTranscriptPart2(finalTranscript);
      }
      if (mode === "test") {
        void persistPracticeResult({
          transcript: finalTranscript,
          topic: part2Topic,
          partLabel: "Part 2",
          partIndex: 2,
          unitIndex: resolvedUnitIndex,
        });
        setPage(PAGES.PART3_INTRO);
      } else {
        setPage(PAGES.PART2_RESULT);
      }
    } else {
      const finalTranscript = (transcriptPart1 + (remainingText ? ` ${remainingText}` : "")).trim();
      if (remainingText && !transcriptPart1.includes(remainingText)) {
        setTranscriptPart1(finalTranscript);
      }
      if (mode === "test") {
        void persistPracticeResult({
          transcript: finalTranscript,
          topic: part1Topic,
          partLabel: "Part 1",
          partIndex: 1,
          unitIndex: resolvedUnitIndex,
        });
        setPage(PAGES.PART2_INTRO);
      } else {
        setPage(PAGES.RESULT);
      }
    }
    setLiveTranscript("");
    setInterimTranscript("");
  };

  const restartSession = () => {
    setTime(0);
    setIsListening(false);
    setIsRecording(false);
    setRecError(null);
    setInterimTranscript("");
    setTranscriptPart1("");
    setTranscriptPart2("");
    setTranscriptPart3("");
    setLiveTranscript("");
    setPage(PAGES.INTRO);
  };

  const finishAllSession = () => {
    restartSession();
    router.push("/dashboard");
  };

  useEffect(() => {
    if (page === PAGES.SESSION || page === PAGES.PART2_SESSION || page === PAGES.PART3_SESSION) {
      intervalRef.current = setInterval(() => {
        setTime((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
    }
    return () => {
      if (intervalRef.current !== null) { clearInterval(intervalRef.current); }
    };
  }, [page]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  };

  const timerGreen = page === PAGES.SESSION || page === PAGES.PART2_SESSION || page === PAGES.PART3_SESSION;
  const headerModeLabel = isAssignment ? "Assignment" : "Learn";
  const headerTitle = isAssignment
    ? `Assignment – Part ${currentAssignmentPart}${currentAssignmentPart === 1 ? part1Topic?.title ? ` (${part1Topic.title})` : "" : currentAssignmentPart === 2 ? part2Topic?.title ? ` (${part2Topic.title})` : "" : part3Topic?.title ? ` (${part3Topic.title})` : ""}`
    : page.startsWith("part2")
      ? `Practice Unit 1 – Part 2${part2Topic?.title ? ` (${part2Topic.title})` : " (Cue Card)"}`
      : page.startsWith("part3")
        ? `Practice Unit 1 – Part 3${part3Topic?.title ? ` (${part3Topic.title})` : " (Introduction)"}`
        : `Practice Unit 1 – Part 1${part1Topic?.title ? ` (${part1Topic.title})` : " (Introduction)"}`;

  const currentTranscript = page.startsWith("part2") ? transcriptPart2 : page.startsWith("part3") ? transcriptPart3 : transcriptPart1;
  const hasSpoken = Boolean(currentTranscript.trim() || liveTranscript.trim() || interimTranscript.trim());

  const isAssignmentResultPage = isAssignment && [PAGES.RESULT, PAGES.PART2_RESULT, PAGES.PART3_RESULT].includes(page);
  const isAssignmentLocked = isAssignment && assignmentActionStatus === "submitted";

  const getCurrentAssignmentTopic = () => {
    if (currentAssignmentPart === 2) return part2Topic;
    if (currentAssignmentPart === 3) return part3Topic;
    return part1Topic;
  };

  const saveAssignmentProgress = async () => {
    setAssignmentActionStatus("saving");
    setAssignmentActionError(null);
    try {
      const topic = getCurrentAssignmentTopic();
      const transcript = currentAssignmentPart === 2 ? transcriptPart2 : currentAssignmentPart === 3 ? transcriptPart3 : transcriptPart1;
      await persistPracticeResult({
        transcript,
        topic,
        partLabel: `Part ${currentAssignmentPart}`,
        partIndex: currentAssignmentPart,
        unitIndex: resolvedUnitIndex,
      });
      setAssignmentActionStatus("saved");
    } catch (error) {
      console.error(error);
      setAssignmentActionStatus("error");
      setAssignmentActionError("Gagal menyimpan progress assignment. Coba lagi.");
      throw error;
    }
  };

  const submitAssignment = async () => {
    setAssignmentActionStatus("saving");
    setAssignmentActionError(null);
    try {
      await saveAssignmentProgress();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Silakan login ulang untuk submit assignment.");
      }
      const now = new Date().toISOString();
      const { error: submissionError } = await supabase
        .from("assignment_submissions")
        .upsert(
          {
            assignment_id: assignmentId,
            student_id: user.id,
            status: "submitted",
            submitted_at: now,
            updated_at: now,
          },
          { onConflict: ["assignment_id", "student_id"] }
        );
      if (submissionError) {
        throw submissionError;
      }
      setAssignmentActionStatus("submitted");

      const { data: assignmentRecord, error: assignmentError } = await supabase
        .from("assignments")
        .select("class_id")
        .eq("id", assignmentId)
        .maybeSingle();

      if (!assignmentError && assignmentRecord?.class_id) {
        router.push(`/dashboard/user/class/${assignmentRecord.class_id}`);
      } else {
        router.push("/dashboard/user/class");
      }
    } catch (error: any) {
      console.error(error);
      setAssignmentActionStatus("error");
      setAssignmentActionError(error?.message ?? "Gagal submit assignment.");
    }
  };

  return (
    <div style={styles.root}>
      <style>{css}</style>
      {/* Header */}
      <header style={styles.header}>
        <button style={styles.backBtn} onClick={() => {
          if (page === PAGES.SESSION) setPage(PAGES.INTRO);
          if (page === PAGES.PART2_SESSION) setPage(PAGES.PART2_INTRO);
          if (page === PAGES.PART3_SESSION) setPage(PAGES.PART3_INTRO);
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        {isAssignment ? (
          <span style={styles.headerMode}>{headerModeLabel}</span>
        ) : null}
        <span style={styles.headerTitle}>{headerTitle}</span>
        <div style={styles.headerRight}>
          {(page === PAGES.RESULT || page === PAGES.PART2_RESULT || page === PAGES.PART3_RESULT) && !isAssignmentLocked && (
            <button onClick={page === PAGES.PART3_RESULT && mode === "test" ? startSession : page === PAGES.PART3_RESULT ? startPart3Session : page === PAGES.PART2_RESULT ? startPart2Session : startSession} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex", alignItems: "center", padding: 4, marginRight: 8 }} title="Restart Session">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
          )}
          <div style={{ ...styles.timerBadge, background: timerGreen ? "#22c55e" : "#fbeec1", color: timerGreen ? "#fff" : "#C95B5B", fontSize: "14px", fontWeight: "bold" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            {!timerGreen ? "00:00:00" : formatTime(time)}
          </div>
        </div>
      </header>

      {assignmentError ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
          <div style={{ ...styles.warningCard, maxWidth: 760 }}>
            <strong>Assignment issue:</strong> {assignmentError}
          </div>
        </div>
      ) : null}

      {/* Body */}
      <main style={styles.main}>
        {page === PAGES.INTRO && <IntroPage topic={part1Topic} />}
        {page === PAGES.SESSION && (
          <SessionPage topic={part1Topic} questions={part1Questions} isListening={isListening} isRecording={isRecording} setIsRecording={setIsRecording} recError={recError} setRecError={setRecError} transcript={transcriptPart1} setTranscript={setTranscriptPart1} liveTranscript={liveTranscript} setLiveTranscript={setLiveTranscript} interimTranscript={interimTranscript} setInterimTranscript={setInterimTranscript} onSaveQuestionTranscripts={(arr) => {
            const joined = (arr || []).filter(Boolean).join(" ").trim();
            setTranscriptPart1((prev) => prev === joined ? prev : joined);
          }} />
        )}
        {page === PAGES.RESULT && <ResultPage transcript={transcriptPart1} topic={part1Topic} partLabel="Part 1" unitIndex={resolvedUnitIndex} partIndex={1} mode={mode} />}
        {page === PAGES.PART2_INTRO && <IntroPagePart2 topic={part2Topic} bullets={part2Bullets} />}
        {page === PAGES.PART2_SESSION && (
          <SessionPagePart2 isRecording={isRecording} setIsRecording={setIsRecording} transcript={transcriptPart2} setTranscript={setTranscriptPart2} liveTranscript={liveTranscript} setLiveTranscript={setLiveTranscript} interimTranscript={interimTranscript} setInterimTranscript={setInterimTranscript} recError={recError} setRecError={setRecError} isListening={isListening} topic={part2Topic} bullets={part2Bullets} isLoading={isTopicsLoading} />
        )}
        {page === PAGES.PART2_RESULT && <ResultPage transcript={transcriptPart2} topic={part2Topic} partLabel="Part 2" unitIndex={resolvedUnitIndex} partIndex={2} mode={mode} />}
        {page === PAGES.PART3_INTRO && (
          <IntroPagePart3
            topic={part3Topic}
            bullets={part3Bullets}
            isLoading={isTopicsLoading}
          />
        )}
        {page === PAGES.PART3_SESSION && (
          <SessionPage messages={part3Messages} questions={part3Questions} isListening={isListening} isRecording={isRecording} setIsRecording={setIsRecording} recError={recError} setRecError={setRecError} transcript={transcriptPart3} setTranscript={setTranscriptPart3} liveTranscript={liveTranscript} setLiveTranscript={setLiveTranscript} interimTranscript={interimTranscript} setInterimTranscript={setInterimTranscript} onSaveQuestionTranscripts={(arr) => {
            const joined = (arr || []).filter(Boolean).join(" ").trim();
            setTranscriptPart3((prev) => prev === joined ? prev : joined);
          }} />
        )}
        {page === PAGES.PART3_RESULT && <ResultPage transcript={transcriptPart3} topic={part3Topic} partLabel="Part 3" unitIndex={resolvedUnitIndex} partIndex={3} mode={mode} />}
      </main>

      {/* Footer Utama */}
      <footer style={styles.footer}>
        {isAssignmentResultPage ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              {assignmentActionStatus === 'submitted' ? (
                <span style={{ color: '#166534', fontSize: 13, fontWeight: 600 }}>Assignment submitted successfully.</span>
              ) : assignmentActionStatus === 'error' ? (
                <span style={{ color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>{assignmentActionError}</span>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                style={{ ...styles.startBtn, background: assignmentActionStatus === 'submitted' ? '#10b981' : 'linear-gradient(135deg, #f87171, #ef4444)' }}
                onClick={submitAssignment}
                disabled={assignmentActionStatus === 'saving' || assignmentActionStatus === 'submitted'}
              >
                {assignmentActionStatus === 'submitted' ? 'Submitted' : 'Submit Assignment'}
              </button>
            </div>
          </>
        ) : page === PAGES.RESULT ? (
          <>
            <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#C95B5B", fontWeight: 600, padding: "10px 0" }} onClick={restartSession}>
              Save Progress
            </button>
            <button style={{ ...styles.startBtn, background: "linear-gradient(135deg, #f87171, #ef4444)" }} onClick={() => {
              setPage(PAGES.PART2_INTRO);
              setLiveTranscript("");
              setInterimTranscript("");
            }}>
              Save &amp; Go to Part 2
            </button>
          </>
        ) : page === PAGES.PART2_RESULT ? (
          <>
            <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#C95B5B", fontWeight: 600, padding: "10px 0" }} onClick={restartSession}>
              Save Progress
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...styles.startBtn, background: "linear-gradient(135deg, #f87171, #ef4444)" }} onClick={() => { setPage(PAGES.PART3_INTRO); setLiveTranscript(""); setInterimTranscript(""); }}>
                Save &amp; Go to Part 3
              </button>
            </div>
          </>
        ) : page === PAGES.PART3_RESULT ? (
          <>
            <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#C95B5B", fontWeight: 600, padding: "10px 0" }} onClick={restartSession}>
              Save Progress
            </button>
            <button style={{ ...styles.startBtn, background: "linear-gradient(135deg, #f87171, #ef4444)" }} onClick={finishAllSession}>
              Save &amp; Finish All
            </button>
          </>
        ) : (
          <>
            <button style={styles.cancelBtn} onClick={() => setPage(PAGES.INTRO)}> Cancel </button>
            {assignmentActionStatus === 'submitted' ? (
              <button
                style={{ ...styles.disabledStartBtn }}
                disabled
              >
                Start Session
              </button>
            ) : page === PAGES.INTRO ? (
              <button style={styles.startBtn} onClick={startSession}>Start Session</button>
            ) : page === PAGES.PART2_INTRO ? (
              <button style={styles.startBtn} onClick={startPart2Session}>Start Session</button>
            ) : page === PAGES.PART3_INTRO ? (
              <button style={styles.startBtn} onClick={startPart3Session}>Start Session</button>
            ) : (
              <button style={hasSpoken ? styles.startBtn : { ...styles.startBtn, background: "#d1d5db", color: "#9ca3af", boxShadow: "none", cursor: "not-allowed" }} onClick={hasSpoken ? finishSession : undefined} disabled={!hasSpoken} >
                Finish Session
              </button>
            )}
          </>
        )}
      </footer>
    </div>
  );
}

function IntroPage({ topic }: { topic: Topic | null }) {
  const topicTitle = topic?.title ?? "Speaking Topic";
  const topicPrompt = topic?.prompt ?? "Let's talk about this topic.";
  const bullets = topic ? getBulletsFromTopic(topic) : [];

  return (
    <div style={styles.chat}>
      <div style={styles.lexaBubbleWrap}>
        <LexaAvatar />
        <div>
          <div style={styles.lexaName}>Lexa – AI Coach</div>
          <div style={styles.lexaBubble}> Hello! Let&apos;s start with <strong>{topicTitle}</strong>. Before we begin, let me explain the system. </div>
        </div>
      </div>
      <div style={styles.contentAlign}>
        <p style={styles.instructionLabel}>Topic Overview</p>
        <div style={styles.infoCard}><span style={styles.infoIcon}>i</span> <span><strong>{topicTitle}</strong></span></div>
        {topic?.description ? (
          <div style={styles.warningCard}><span style={styles.infoIcon}>i</span> <span>{topic.description}</span></div>
        ) : null}
        <div style={styles.warningCard}><span style={styles.infoIcon}>i</span> <span>{topicPrompt}</span></div>
        <div style={styles.tipCard}><span style={styles.infoIcon}>i</span> <span>Tips: Keep your answers reasonable while treating it like a casual conversation.</span></div>
        <DetailBubbleList label="Bullet bubbles" items={bullets} accent="#166534" />
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 0 }}><PulseRing color="#ef4444" size={220} /></div>
      </div>
    </div>
  );
}

function IntroPagePart2({ topic }: { topic: Topic | null; bullets?: string[] }) {
  const topicTitle = topic?.title ?? "Cue Card Topic";

  return (
    <div style={styles.chat}>
      <div style={styles.lexaBubbleWrap}>
        <LexaAvatar />
        <div>
          <div style={styles.lexaName}>Lexa – AI Coach</div>
          <div style={styles.lexaBubble}> Now for <strong>Part 2</strong> — let's talk about: <strong>{topicTitle}</strong> </div>
        </div>
      </div>
      <div style={styles.contentAlign}>
        <p style={styles.instructionLabel}>Please carefully read the instructions below before proceed the practice session</p>
        <div style={styles.infoCard}><span style={styles.infoIcon}>i</span> <span>Topic: <strong>{topicTitle}</strong></span></div>
        {topic?.description ? (
          <div style={styles.warningCard}><span style={styles.infoIcon}>i</span> <span>{topic.description}</span></div>
        ) : null}
        <div style={styles.warningCard}><span style={styles.infoIcon}>i</span> <span>The cue card will opens and you get 1 minute to think about what you’re going to say. You can make some notes to help you if you wish.</span></div>
        <div style={styles.warningCard}><span style={styles.infoIcon}>i</span> <span>The cue card will closes and you will got the chance to speak for up to 2 minutes.</span></div>
        <div style={styles.tipCard}><span style={styles.infoIcon}>i</span> <span>Tips: Focus on covering all bullet points clearly and finish with a short summary.</span></div>
      </div>
    </div>
  );
}

function IntroPagePart3({
  topic,
  bullets,
  isLoading,
}: {
  topic: Topic | null;
  bullets?: string[];
  isLoading?: boolean;
}) {
  const topicTitle = topic?.title ?? "Part 3 Discussion";
  const topicPrompt = topic?.prompt ?? "I will ask you some follow-up questions related to this topic.";
  const bulletItems = bullets ?? (topic ? getBulletsFromTopic(topic) : []);

  return (
    <div style={styles.chat}>
      <div style={styles.lexaBubbleWrap}>
        <LexaAvatar />
        <div>
          <div style={styles.lexaName}>Lexa – AI Coach</div>
          <div style={styles.lexaBubble}> Hello! This is Part 3 — let&apos;s discuss <strong>{topicTitle}</strong> first! </div>
        </div>
      </div>
      <div style={styles.contentAlign}>
        <p style={styles.instructionLabel}>Please carefully read the instructions below before proceed the practice session</p>
        {topic?.description ? (
          <div style={styles.warningCard}><span style={styles.infoIcon}>i</span> <span>{topic.description}</span></div>
        ) : null}
        <div style={styles.infoCard}><span style={styles.infoIcon}>i</span> <span>{topicPrompt}</span></div>
        <div style={styles.warningCard}><span style={styles.infoIcon}>i</span> <span>You will have to speak for the total of <strong>4–5 minutes</strong> for this part.</span></div>
        <div style={styles.tipCard}><span style={styles.infoIcon}>i</span> <span>Tips: Be natural and keep answers concise but informative.</span></div>
        {isLoading && (
          <div style={styles.infoCard}>
            <span style={styles.infoIcon}>i</span>
            <span>Loading Part 3 content from the admin unit...</span>
          </div>
        )}
        <DetailBubbleList label="Bullet bubbles" items={bulletItems} accent="#166534" />
      </div>
    </div>
  );
}

function SessionPage({ topic, questions = [], messages: msgProp, isRecording, setIsRecording, recError, setRecError, transcript, setTranscript, liveTranscript, setLiveTranscript, interimTranscript, setInterimTranscript, onSaveQuestionTranscripts }: SessionPageProps & { questions?: string[] }) {
  // Generate messages from topic if available, otherwise use provided messages or default
  const messages = msgProp || (topic ? [
    { role: "lexa", text: `Let's talk about ${topic.title}. ${topic.prompt || "Please share your thoughts."}` }
  ] : [
    { role: "lexa", text: "Good morning, my name is Lexa. What's your name?" }
  ]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isStoppingRef = useRef(false);
  const stoppingIntentionalRef = useRef(false);
  const transcriptRef = useRef<string>("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const questionIndexRef = useRef<number>(0);
  const [questionTranscripts, setQuestionTranscripts] = useState<string[]>([]);
  const perQuestionAccumRef = useRef<string[]>([]);

  // When questionTranscripts updates, notify parent outside render phase
  useEffect(() => {
    try {
      if (onSaveQuestionTranscripts) onSaveQuestionTranscripts(questionTranscripts);
    } catch (e) {
      console.debug("[Lexa] onSaveQuestionTranscripts error:", e);
    }
  }, [questionTranscripts, onSaveQuestionTranscripts]);

  useEffect(() => {
    setQuestionIndex(0);
    questionIndexRef.current = 0;
    // initialize per-question transcripts to match incoming questions
    const init = Array(questions.length).fill("");
    setQuestionTranscripts(init);
    perQuestionAccumRef.current = init.slice();
  }, [questions.join("|")]);

  const activeQuestion = questions[questionIndex] ?? null;
  const hasMoreQuestions = questionIndex < questions.length - 1;

  // Build per-question display for the live transcript card.
  const currentSavedAnswer = (questionTranscripts[questionIndex] || "").trim();
  const displayTranscript = recError
    ? recError
    : (liveTranscript && liveTranscript.trim())
      ? liveTranscript
      : (interimTranscript && interimTranscript.trim())
        ? interimTranscript
        : isRecording
          ? (transcriptRef.current || "")
          : (currentSavedAnswer || "Start speaking...");

  // Build a conversation flow combining initial messages, questions and per-question user transcripts
  const conversationMessages: ChatMessage[] = [];
  // start with system/intro messages
  conversationMessages.push(...messages);

  // for each question up to current index, append question and its user reply (if any)
  const upto = Math.min(questionIndex, questions.length - 1);
  for (let i = 0; i <= upto; i++) {
    const q = questions[i];
    if (q) conversationMessages.push({ role: "lexa", text: q });
    const userAns = questionTranscripts[i];
    if (userAns && userAns.trim()) conversationMessages.push({ role: "user", text: userAns.trim() });
  }

  // include the active question if it's the current one (so it shows even before user answers)
  if (activeQuestion && (questionIndex <= questions.length - 1)) {
    // Only append if an identical Lexa question isn't already present
    const alreadyHas = conversationMessages.some((m) => m.role === "lexa" && m.text === activeQuestion);
    if (!alreadyHas) conversationMessages.push({ role: "lexa", text: activeQuestion });
  }

  const advanceQuestion = () => {
    if (!hasMoreQuestions) return;

    setRecError(null);
    setIsRecording(false);
    setLiveTranscript("");
    setInterimTranscript("");
    if (recognitionRef.current) {
      try {
        // prefer stop() so final result can be delivered before advancing
        isStoppingRef.current = true;
        try { recognitionRef.current.stop(); } catch { recognitionRef.current.abort(); }
      } catch { }
      // leave onend to clear recognitionRef and isStoppingRef
    }
    setQuestionIndex((prev) => {
      const next = prev + 1;
      questionIndexRef.current = next;
      // ensure accumulator for the next question starts empty
      perQuestionAccumRef.current[next] = perQuestionAccumRef.current[next] || "";
      return next;
    });
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    // Only auto-advance if the CURRENT question already has a saved answer.
    // This avoids skipping the next question when the global transcript contains previous answers.
    const currentAnswered = Boolean((questionTranscripts[questionIndexRef.current] || "").trim());
    if (currentAnswered && hasMoreQuestions) {
      advanceQuestion();
      setTimeout(() => startRecording(), 120);
      return;
    }

    startRecording();
  };

  const startRecording = async () => {
    setRecError(null);
    console.debug("[Lexa] startRecording called", { questionIndex: questionIndexRef.current });
    // PERBAIKAN 3: Jangan hapus permanen transcript disini agar tidak ter-wipe di tengah jalan
    setLiveTranscript("");
    setInterimTranscript("");
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) throw new Error("Browser tidak mendukung Live Transcription.");

    // Jika ada instance sebelumnya, hentikan/abort dulu untuk menghindari konflik
    if (recognitionRef.current) {
      try {
        isStoppingRef.current = true;
        recognitionRef.current.abort();
      } catch { }
      recognitionRef.current = null;
      isStoppingRef.current = false;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    // base live transcript on current question's saved answer so new question starts empty
    transcriptRef.current = (questionTranscripts[questionIndexRef.current] || "").trim();
    // ensure accumulator exists for this question
    perQuestionAccumRef.current[questionIndexRef.current] = perQuestionAccumRef.current[questionIndexRef.current] || "";

    recognition.onresult = (event: any) => {
      console.debug("[Lexa] onresult fired", { questionIndex: questionIndexRef.current });
      let accumulatedFinal = "";
      let interimResult = "";

      // 🔥 PERBAIKAN 1: Loop selalu dari 0 agar tidak terjadi double accumulation dari resultIndex
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          accumulatedFinal += event.results[i][0].transcript + " ";
        } else {
          interimResult += event.results[i][0].transcript;
        }
      }

      // 🔥 PERBAIKAN 2: Gunakan landasan teks awal saat mic dinyalakan,
      // lalu gabungkan dengan hasil baru (bukan pakai += yang bikin teks numpuk)
      const baseSpeech = (questionTranscripts[questionIndexRef.current] || "").trim();
      const totalFinalText = (baseSpeech ? baseSpeech + " " : "") + accumulatedFinal;

      transcriptRef.current = totalFinalText.trim();

      // Sinkronkan ke live transcription card
      setLiveTranscript(totalFinalText + interimResult);
      setInterimTranscript(interimResult);

      // 🔥 PERBAIKAN 3: Simpan langsung ke state tanpa perQuestionAccumRef yang bikin konflik
      const idxForSave = questionIndexRef.current;
      setTranscript(totalFinalText.trim());

      setQuestionTranscripts((prevArr) => {
        const copy = prevArr && prevArr.length ? [...prevArr] : Array(questions.length).fill("");
        copy[idxForSave] = totalFinalText.trim();
        return copy;
      });
    };

    recognition.onerror = (e: SpeechRecognitionErrorEventLike) => {
      console.debug("[Lexa] onerror", e, { questionIndex: questionIndexRef.current });
      if (e.error === "aborted") return;
      // if browser reports no-speech, just restart listening (don't abort session)
      if (e.error === "no-speech") {
        setInterimTranscript("");
        setLiveTranscript(transcriptRef.current || "");
        try { if (recognitionRef.current && !isStoppingRef.current) recognitionRef.current.start(); } catch { }
        return;
      }
      setRecError(`Error: ${e.error}`);
      // finalize interim + transcriptRef as the final answer for current question
      const finalText = ((transcriptRef.current || "") + (interimTranscript || "")).trim();
      if (finalText) {
        const idxForSave = questionIndexRef.current;
        // ensure per-question accum has the final text
        perQuestionAccumRef.current[idxForSave] = (perQuestionAccumRef.current[idxForSave] || "") + finalText;
        setTimeout(() => {
          setQuestionTranscripts((prevArr) => {
            const copy = prevArr && prevArr.length ? [...prevArr] : Array(questions.length).fill("");
            copy[idxForSave] = perQuestionAccumRef.current[idxForSave] || "";
            return copy;
          });
          console.debug("[Lexa] onerror persisted perQuestionAccumRef for idx", idxForSave, perQuestionAccumRef.current[idxForSave]);
        }, 0);
      }
      try { if (recognitionRef.current) { isStoppingRef.current = true; recognitionRef.current.abort(); } } catch { }
      recognitionRef.current = null;
      setIsRecording(false);
    };

    recognition.onend = () => {
      // If onend triggered because we intentionally stopped, finalize current question
      if (stoppingIntentionalRef.current) {
        stoppingIntentionalRef.current = false;
        const finalText = ((transcriptRef.current || "") + (interimTranscript || "")).trim();
        if (finalText) {
          const idxForSave = questionIndexRef.current;
          // accumulate and persist
          perQuestionAccumRef.current[idxForSave] = (perQuestionAccumRef.current[idxForSave] || "") + finalText;
          setTimeout(() => {
            setQuestionTranscripts((prevArr) => {
              const copy = prevArr && prevArr.length ? [...prevArr] : Array(questions.length).fill("");
              copy[idxForSave] = perQuestionAccumRef.current[idxForSave] || "";
              return copy;
            });
            console.debug("[Lexa] onend persisted perQuestionAccumRef for idx", idxForSave, perQuestionAccumRef.current[idxForSave]);
            // advance after short delay so UI updates show saved answer first
            setTimeout(() => { try { if (hasMoreQuestions) advanceQuestion(); } catch { } }, 120);
          }, 0);
        }
        try { recognitionRef.current = null; } catch { }
        setIsRecording(false);
        return;
      }

      // Jika tidak sedang berhenti sengaja, coba restart agar continuous listening tetap bekerja.
      if (recognitionRef.current && !isStoppingRef.current) {
        try { recognition.start(); } catch { }
      } else {
        setIsRecording(false);
      }
    };

    recognition.start();
    setIsRecording(true);
  };

  // Ensure transcriptRef starts with current saved transcript when beginning to record
  // so liveTranscript builds correctly and old saved transcript doesn't appear as "live".

  const stopRecording = () => {
    setIsRecording(false);
    console.debug("[Lexa] stopRecording called", { questionIndex: questionIndexRef.current });
    if (recognitionRef.current) {
      stoppingIntentionalRef.current = true;
      try {
        // prefer stop() so final results are delivered
        try { recognitionRef.current.stop(); }
        catch (e) { recognitionRef.current.abort(); }
      } catch (err) { console.log(err); }
      // do not finalize here — onend will handle finalization
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { isStoppingRef.current = true; recognitionRef.current.abort(); } catch { }
        recognitionRef.current = null;
        isStoppingRef.current = false;
        setIsRecording(false);
      }
    };
  }, [setIsRecording]);

  const questionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (questionRef.current) {
      try { questionRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch { }
    }
  }, [questionIndex]);

  return (
    <div style={styles.chat}>
      {conversationMessages.map((m, i) => (
        m.role === "lexa" ? (
          <div key={"l-" + i} style={styles.lexaBubbleWrap}>
            <LexaAvatar />
            <div>
              <div style={styles.lexaName}>Lexa – AI Coach</div>
              <div style={styles.lexaBubble}>{m.text}</div>
            </div>
          </div>
        ) : (
          <div key={"u-" + i} style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <div style={{ maxWidth: "642px", marginLeft: 40, marginRight: 10 }}>
              <div style={{ ...styles.userBubble }}>{m.text}</div>
            </div>
            <div style={styles.userAvatar}>D</div>
          </div>
        )
      ))}
      {/* activeQuestion moved below the listening card to appear as next chat bubble */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: "100%", marginTop: 24, paddingRight: 20, boxSizing: "border-box", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={styles.userAvatar}>D</div>
          <span style={{ fontSize: 16, color: "#6b7280", fontWeight: 500 }}>davinzata</span>
        </div>
        <div style={{ ...styles.listeningCard, width: "100%", maxWidth: "450px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <button onClick={toggleRecording} style={{ ...styles.recordBtn, background: isRecording ? "#fff" : "rgba(255,255,255,0.2)", color: isRecording ? "#ef4444" : "#fff" }}> ● </button>
            <span style={{ fontSize: 14, color: "#fff", fontWeight: 500 }}>{isRecording ? "Listening..." : "Click microphone to talk"}</span>
          </div>
          <div style={styles.transcriptBox}>
            <span style={{ fontSize: 12, color: "#C95B5B", fontWeight: 600 }}>Live Audio Transcription</span>
            <p style={{ fontSize: 15, color: "#374151", margin: "6px 0 0 0" }}>{displayTranscript}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionPagePart2({ isRecording, setIsRecording, transcript, setTranscript, liveTranscript, setLiveTranscript, interimTranscript, setInterimTranscript, recError, setRecError, topic, bullets, isLoading }: SessionPagePart2Props) {
  const recognitionRef = useRef<any>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const topicTitle = topic?.title ?? "Cue Card Topic";
  const topicPrompt = topic?.prompt ?? "Describe the topic naturally and cover all bullet points.";
  const bulletItems = bullets ?? (topic ? getBulletsFromTopic(topic) : []);

  // 1. TAMBAHKAN USEEFFECT CLEANUP (SANGAT PENTING!)
  // Menjamin jika user pindah halaman atau sesi selesai, mikrofon diputus paksa
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort(); // Putus paksa koneksi mic
        } catch (e) {
          console.error(e);
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    setRecError(null);
    setTranscript(""); setLiveTranscript(""); setInterimTranscript("");

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Pastikan jika ada instance lama yang masih menggantung, kita matikan dulu
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { }
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalResult = ""; let interimResult = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalResult += event.results[i][0].transcript + " ";
        else interimResult += event.results[i][0].transcript;
      }
      if (finalResult) setTranscript((prev) => prev + finalResult);
      setInterimTranscript(interimResult);
      setLiveTranscript(transcript + finalResult + interimResult);
    };

    // Tambahkan handler onend untuk mengamankan state jika mic mati otomatis oleh sistem
    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    setIsRecording(true);
  };

  // 2. PERBARUI FUNGSI STOP RECORDING
  const stopRecording = () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      try {
        // Menggunakan abort() alih-alih stop() agar mikrofon langsung mati seketika
        recognitionRef.current.abort();
      } catch (e) {
        console.error("Gagal menghentikan perekaman:", e);
      }
      recognitionRef.current = null;
    }
  };



  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>

      {/* 1. Sisi Lexa (Kiri) - Bubble Pembuka / Feedback Instan */}
      <div style={styles.lexaBubbleWrap}>
        <LexaAvatar />
        <div>
          <div style={styles.lexaName}>Lexa – AI Coach</div>
          {!isFlipped ? (
            <div style={styles.lexaBubble}>The session will start soon, good luck!</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ ...styles.tipCard, background: "#fff7ed", border: "1px solid #fed7aa", color: "#c2410c", borderRadius: "12px", padding: "10px 14px", margin: 0, display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "500" }}>
                <span>⚠️ You can definitely say more about this!</span>
              </div>
              <div style={styles.lexaBubble}>Would it be easy to replace it?</div>
            </div>
          )}
        </div>
      </div>

      {/* 2. CONTAINER UTAMA UNTUK INTERAKTIF FLIP 3D */}
      <div
        onClick={() => setIsFlipped(!isFlipped)} // Klik di mana saja pada area kartu untuk membalikkan posisi
        style={{
          perspective: "1000px",
          width: "calc(100% - 50px)",
          marginLeft: "50px",
          cursor: "pointer",
          userSelect: "none"
        }}
      >
        <div style={{
          position: "relative",
          width: "100%",
          minHeight: "380px",
          transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)"
        }}>

          {/* ==================== SISI DEPAN: CUE CARD OPEN ==================== */}
          <div style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            backfaceVisibility: "hidden",
            background: "#ffffff",
            border: "1px solid #f3f4f6",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.02)",
            boxSizing: "border-box"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#f87171" }}>{topicTitle}</span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#b91c1c" }}>Cue Card Open</span>
            </div>

            <h2 style={{ fontSize: "28px", fontWeight: 500, color: "#000000", margin: "0 0 24px 0", lineHeight: 1.3 }}>
              {topicPrompt}
            </h2>

            <span style={{ fontSize: "12px", fontWeight: 700, color: "#C95B5B", display: "block", marginBottom: "16px", letterSpacing: "0.05em" }}>
              YOU SHOULD SAY:
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-start" }}>
              {(bulletItems.length ? bulletItems : ["No admin bullets found for this topic yet."]).map((text, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "20px", padding: "7px 16px", color: "#b91c1c", fontSize: "14px", fontWeight: "600" }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #b91c1c", borderRadius: "50%", width: "18px", height: "18px", fontSize: "11px", fontWeight: "700" }}>
                    {idx + 1}
                  </span>
                  {text}
                </div>
              ))}
            </div>
            {isLoading && (
              <div style={{ marginTop: "12px", fontSize: "12px", color: "#6b7280" }}>
                Loading cue card from admin unit...
              </div>
            )}
            <div style={{ position: "absolute", bottom: "16px", right: "20px", fontSize: "12px", color: "#9ca3af" }}>
              💡 Click to flip and start speaking
            </div>
          </div>

          {/* ==================== SISI BELAKANG: CUE CARD CLOSED (RECORDING) ==================== */}
          <div style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)", // Sisi belakang dibalik secara default agar terlihat pas saat diputar
            background: "#ffffff",
            border: "1px solid #fecaca",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 4px 24px rgba(201, 91, 91, 0.05)",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}>
            {/* Header Status Closed */}
            <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#991b1b" }}>Cue Card Closed</span>
            </div>

            {/* Bulatan Mikrofon Tengah Menyerupai Gelombang Ring Merah */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, position: "relative" }}>
              <div
                onClick={(e) => {
                  e.stopPropagation(); // Mencegah kartu tidak sengaja terbalik kembali saat menekan mikrofon
                  isRecording ? stopRecording() : startRecording();
                }}
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  background: isRecording ? "#fecaca" : "#f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.3s ease",
                  boxShadow: isRecording ? "0 0 20px rgba(239, 68, 68, 0.2)" : "none"
                }}
              >
                {/* Ikon mic sederhana */}
                <svg width="40" height="40" viewBox="0 0 24 24" fill={isRecording ? "#ef4444" : "#9ca3af"}>
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                </svg>
              </div>
            </div>

            {/* Box Audio Transcription Internal di Sisi Bawah Kartu */}
            <div
              onClick={(e) => e.stopPropagation()} // Supaya saat blok teks diseleksi, kartu tidak berputar kembali
              style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", minHeight: "120px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", color: "#6b7280", fontSize: "14px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                <span style={{ fontWeight: "600" }}>Audio Transcription</span>
              </div>
              <p style={{ fontSize: "15px", color: "#111827", margin: 0, lineHeight: 1.5 }}>
                {recError || liveTranscript || interimTranscript || transcript || "Start speaking..."}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* 3. Label Profil User Tetap Berada Di Bawah Kanan Luar Kartu */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: "100%", paddingRight: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -8 }}>
          <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>davinzata</span>
          <div style={styles.userAvatar}>D</div>
        </div>
      </div>

    </div>
  );
}

function ResultPage({ transcript, topic, partLabel, unitIndex, partIndex, mode }: ResultPageProps) {
  const [evaluation, setEvaluation] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [finalTestSummary, setFinalTestSummary] = useState<{
    overall: number;
    part1: number;
    part2: number;
    part3: number;
  } | null>(null);
  const [finalTestPartDetails, setFinalTestPartDetails] = useState<Array<{
    label: string;
    score: number;
    description: string;
    evaluation: string;
    components: Array<{ label: string; score: string; description: string }>;
  }> | null>(null);
  const [finalTestLoading, setFinalTestLoading] = useState(false);
  const [finalTestError, setFinalTestError] = useState<string | null>(null);
  const hasSavedRef = useRef(false);
  const hasSavedFinalSummaryRef = useRef(false);

  const rubricItems = useMemo(() => {
    return (topic?.details || [])
      .map((detail) => ({
        title: detail.content.trim(),
        rubric: detail.rubric?.trim() || "",
      }))
      .filter((item) => item.rubric.length > 0);
  }, [topic]);

  useEffect(() => {
    let cancelled = false;

    const runAnalysis = async () => {
      setAnalysisLoading(true);
      try {
        const response = await fetch("/api/evaluate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transcript: transcript.trim(),
            topicTitle: topic?.title ?? partLabel,
            topicPrompt: topic?.prompt ?? "",
            rubricItems: rubricItems.map((item) => `${item.title}${item.rubric ? `: ${item.rubric}` : ""}`),
            partLabel,
          }),
        });

        const data = (await response.json()) as any;
        if (!cancelled) {
          setEvaluation(data);
        }
      } catch (error) {
        console.error("Failed to evaluate speaking result:", error);
        if (!cancelled) {
          setEvaluation(null);
        }
      } finally {
        if (!cancelled) {
          setAnalysisLoading(false);
        }
      }
    };

    void runAnalysis();

    hasSavedRef.current = false;
    setSaveStatus("idle");
    setSaveError(null);

    return () => {
      cancelled = true;
    };
  }, [partLabel, rubricItems, topic?.prompt, topic?.title, transcript]);

  useEffect(() => {
    let cancelled = false;

    const loadTestSummary = async () => {
      if (mode !== "test" || partIndex !== 3 || !unitIndex || !evaluation || analysisLoading || !transcript.trim()) {
        return;
      }

      const latestPart3Score = Number(evaluation.overall);
      if (!Number.isFinite(latestPart3Score)) {
        return;
      }

      setFinalTestLoading(true);
      setFinalTestError(null);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (cancelled) return;

        if (userError || !userData.user) {
          setFinalTestError("Silakan login ulang agar skor akhir test bisa diproses.");
          return;
        }

        const { data: historyRows, error: historyError } = await supabase
          .from("student_score_history")
          .select("score, part_index, unit_index, recorded_at, metrics")
          .eq("student_id", userData.user.id)
          .eq("unit_index", unitIndex)
          .order("recorded_at", { ascending: false });

        if (cancelled) return;

        if (historyError) {
          setFinalTestError(historyError.message);
          return;
        }

        type HistoryMetric = {
          label?: string;
          score?: number | string;
          text?: string;
        };

        type HistoryRow = {
          score: number;
          part_index: number | null;
          metrics?: HistoryMetric[] | null;
        };

        const latestPartScores = new Map<number, number>([[3, latestPart3Score]]);
        const partDetails: Array<{
          label: string;
          score: number;
          description: string;
          evaluation: string;
          components: Array<{ label: string; score: string; description: string }>;
        }> = [];

        (historyRows as HistoryRow[] | null ?? []).forEach((row) => {
          const rowPartIndex = row.part_index;
          if ((rowPartIndex === 1 || rowPartIndex === 2) && !latestPartScores.has(rowPartIndex)) {
            latestPartScores.set(rowPartIndex, Number(row.score));
          }

          if (rowPartIndex === 1 || rowPartIndex === 2 || rowPartIndex === 3) {
            const partLabel = `Part ${rowPartIndex}`;
            const partScore = Number(row.score);
            const componentMetrics = Array.isArray(row.metrics)
              ? row.metrics
                .map((metric) => ({
                  label: metric.label ?? "Component",
                  score: metric.score !== undefined && metric.score !== null ? String(metric.score) : "-",
                  description: metric.text ?? "",
                }))
                .filter((metric) => metric.label !== "Component" || metric.score !== "-")
              : [];

            if (!partDetails.some((item) => item.label === partLabel)) {
              partDetails.push({
                label: partLabel,
                score: Number.isFinite(partScore) ? Number(partScore.toFixed(1)) : 0,
                description: rowPartIndex === 1
                  ? "Short-answer warm-up section."
                  : rowPartIndex === 2
                    ? "Cue card / long turn section."
                    : "Follow-up discussion section.",
                evaluation: componentMetrics.length > 0
                  ? `${partLabel} evaluation is based on the saved component scores below.`
                  : `${partLabel} evaluation is based on the part score only.`,
                components: componentMetrics,
              });
            }
          }
        });

        const part1 = latestPartScores.get(1);
        const part2 = latestPartScores.get(2);
        const part3 = latestPartScores.get(3);

        if (part1 === undefined || part2 === undefined || part3 === undefined) {
          setFinalTestError("Skor final belum lengkap karena salah satu part belum tersimpan.");
          return;
        }

        const overall = Number(((part1 + part2 + part3) / 3).toFixed(1));

        if (!cancelled) {
          setFinalTestSummary({ overall, part1, part2, part3 });
          setFinalTestPartDetails(
            partDetails.sort((a, b) => Number(a.label.replace(/[^0-9]/g, "")) - Number(b.label.replace(/[^0-9]/g, "")))
          );
        }

        if (!hasSavedFinalSummaryRef.current) {
          const { error: insertError } = await supabase.from("student_score_history").insert({
            student_id: userData.user.id,
            score: overall,
            metrics: [
              { id: "part1", label: "Part 1 Score", score: part1, text: "Final test summary" },
              { id: "part2", label: "Part 2 Score", score: part2, text: "Final test summary" },
              { id: "part3", label: "Part 3 Score", score: part3, text: "Final test summary" },
            ],
            speaking_attempts: 0,
            unit_index: unitIndex,
            part_index: null,
            recorded_at: new Date().toISOString(),
            recorded_by: userData.user.id,
            attempt_type: "test",
          });

          if (insertError) {
            setFinalTestError(insertError.message);
            return;
          }

          hasSavedFinalSummaryRef.current = true;
        }
      } finally {
        if (!cancelled) {
          setFinalTestLoading(false);
        }
      }
    };

    void loadTestSummary();

    return () => {
      cancelled = true;
    };
  }, [analysisLoading, evaluation, mode, partIndex, transcript, unitIndex]);

  useEffect(() => {
    const persistResult = async () => {
      if (analysisLoading || !evaluation || !transcript.trim() || hasSavedRef.current) {
        return;
      }

      const latestScore = Number(evaluation.overall);
      if (!Number.isFinite(latestScore)) {
        setSaveStatus("error");
        setSaveError("Skor hasil belum siap untuk disimpan.");
        return;
      }

      hasSavedRef.current = true;
      setSaveStatus("saving");
      setSaveError(null);

      const progressPercent = Number(Math.max(0, Math.min(100, (latestScore / 9) * 100)).toFixed(1));
      const metricPayload = evaluation.metrics.map((metric: MetricData) => ({
        id: metric.id,
        label: metric.label,
        score: Number(metric.score),
        text: metric.text,
      }));

      console.log(
        "RESULT PAGE METRICS",
        JSON.stringify(metricPayload, null, 2)
      );

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setSaveStatus("error");
        setSaveError("Silakan login ulang agar hasil bisa disimpan.");
        hasSavedRef.current = false;
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (sessionError || !accessToken) {
        setSaveStatus("error");
        setSaveError("Silakan login ulang agar hasil bisa disimpan.");
        hasSavedRef.current = false;
        return;
      }

      const response = await fetch("/api/student-practice-progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          latest_score: latestScore,
          progress_percent: progressPercent,
          speaking_attempts: 1,
          last_activity_at: new Date().toISOString(),
          last_unit_index: unitIndex,
          last_part_index: partIndex,
          notes: evaluation.recommendation ?? null,
          metrics: metricPayload,
          attempt_type: "test",
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setSaveStatus("error");
        setSaveError(result.error ?? "Gagal menyimpan hasil latihan.");
        hasSavedRef.current = false;
        return;
      }

      const refreshKey = "lexa:practice-progress-updated";
      try {
        localStorage.setItem(refreshKey, String(Date.now()));
      } catch {
        // Ignore storage failures and still notify this tab.
      }
      window.dispatchEvent(new Event(refreshKey));

      setSaveStatus("saved");
    };

    void persistResult();
  }, [analysisLoading, evaluation, partIndex, transcript, unitIndex]);

  const scoreData: EvaluationResult = evaluation ?? {
    overall: "-",
    level: "Waiting",
    metrics: [],
    recommendation: "Analyzing transcript...",
    analysis: "AI analysis will appear after the transcript is processed.",
  };

  const isFinalTestResult = Boolean(finalTestSummary && mode === "test" && partIndex === 3);
  let testScoreData: EvaluationResult | null = null;
  if (isFinalTestResult && finalTestSummary) {
    testScoreData = {
      overall: finalTestSummary.overall.toFixed(1),
      level: `Final Test Band ${finalTestSummary.overall.toFixed(1)}`,
      metrics: [
        { id: "part1", label: "Part 1", score: finalTestSummary.part1.toFixed(1), text: "Included in the final average." },
        { id: "part2", label: "Part 2", score: finalTestSummary.part2.toFixed(1), text: "Included in the final average." },
        { id: "part3", label: "Part 3", score: finalTestSummary.part3.toFixed(1), text: "Included in the final average." },
      ],
      recommendation: "Ulangi test untuk membandingkan skor akhir terbaru.",
      analysis: "Skor akhir test dihitung dari rata-rata Part 1, Part 2, dan Part 3.",
    };
  }
  const displayScoreData = testScoreData ?? scoreData;
  const testPartBreakdown = mode === "test" && partIndex === 3 && finalTestSummary && finalTestPartDetails
    ? finalTestPartDetails.map((part) => ({
      label: part.label,
      score: part.score.toFixed(1),
      description: part.description,
      evaluation: part.evaluation,
      components: part.components,
    }))
    : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", paddingBottom: "20px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>davinzata</span>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#fecaca", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold" }}>D</div>
        </div>
        <div style={{ background: "#C95B5B", color: "#fff", borderRadius: "12px 12px 0px 12px", padding: "12px 18px", fontSize: "14px", maxWidth: "600px", lineHeight: 1.5 }}>
          {transcript.trim() ? transcript.trim() : "No audio transcription captured for this session."}
        </div>
      </div>

      <div style={styles.lexaBubbleWrap}>
        <LexaAvatar />
        <div>
          <div style={styles.lexaName}>Lexa – AI Coach</div>
          <div style={styles.lexaBubble}><strong>Time is up!</strong> Here’s my feedback of our practice session this time.</div>
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #f3f4f6", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 24px rgba(0,0,0,0.02)", position: "relative", width: "calc(100% - 44px)", marginLeft: "44px", boxSizing: "border-box" }}>
        <div style={{ position: "absolute", top: "24px", right: "24px", color: "#C95B5B", border: "1.5px solid #C95B5B", borderRadius: "50%", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold" }}>i</div>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#C95B5B", margin: "0 0 16px 0" }}>AI Coach Analysis</h3>

        {(saveStatus === "saving" || saveStatus === "saved" || saveStatus === "error") && (
          <div style={{ marginBottom: "12px", fontSize: "13px", color: saveStatus === "error" ? "#b91c1c" : saveStatus === "saved" ? "#166534" : "#6b7280" }}>
            {saveStatus === "saving"
              ? "Saving result to dashboard history..."
              : saveStatus === "saved"
                ? "Result saved. Dashboard will refresh automatically."
                : saveError}
          </div>
        )}

        {analysisLoading ? (
          <p style={{ fontSize: "14px", color: "#6b7280" }}>Analyzing transcript and admin rubric...</p>
        ) : (
          <>
            <div style={{ marginBottom: "20px" }}>
              {finalTestLoading ? (
                <p style={{ fontSize: "14px", color: "#6b7280" }}>Menyusun skor akhir test...</p>
              ) : (
                <AnalysisCard
                  title={isFinalTestResult ? "Overall Test Result" : "Speaking Result"}
                  overallScore={displayScoreData.overall}
                  level={displayScoreData.level}
                  metrics={displayScoreData.metrics.map((metric) => ({
                    label: metric.label,
                    score: metric.score,
                    description: metric.text,
                  }))}
                  partBreakdown={testPartBreakdown}
                  recommendation={displayScoreData.recommendation}
                />
              )}
            </div>

            <div style={{ display: "grid", gap: "12px", marginBottom: "20px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#C95B5B", margin: 0 }}>AI Summary</h4>
              <p style={{ fontSize: "14px", color: "#111827", margin: 0, lineHeight: 1.6 }}>{displayScoreData.analysis}</p>
            </div>

            {finalTestError ? (
              <div style={{ marginBottom: "20px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "12px", padding: "12px 14px", color: "#9a3412", fontSize: "13px" }}>
                {finalTestError}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: "12px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#C95B5B", margin: 0 }}>Admin Rubric {partLabel}</h4>
              {rubricItems.length > 0 ? (
                rubricItems.map((item, index) => (
                  <div key={`${item.title}-${index}`} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827", marginBottom: "6px" }}>
                      {item.title || `Rubric ${index + 1}`}
                    </div>
                    <p style={{ fontSize: "13px", color: "#374151", margin: 0, lineHeight: 1.5 }}>{item.rubric}</p>
                  </div>
                ))
              ) : (
                <div style={{ background: "#f9fafb", border: "1px dashed #d1d5db", borderRadius: "12px", padding: "14px", color: "#6b7280", fontSize: "13px" }}>
                  No admin rubric has been set for this part yet.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LexaAvatar() {
  return (
    <div style={styles.lexaAvatar}>
      <img src="/logo.png" alt="Lexa logo" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", display: "block" }} />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: { fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", width: "100vw", height: "100vh", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #f3f4f6", gap: 12 },
  backBtn: { background: "none", border: "none", cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: 600, color: "#111827" },
  headerMode: { marginLeft: 12, fontSize: 12, fontWeight: 700, color: "#fff", background: "#ef4444", padding: "4px 10px", borderRadius: 9999, textTransform: "uppercase", letterSpacing: "0.08em" },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  timerBadge: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 20 },
  main: { flex: 1, padding: "24px 28px", overflowY: "auto", position: "relative" },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px", borderTop: "1px solid #f3f4f6" },
  cancelBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6b7280", fontWeight: 500 },
  startBtn: { background: "linear-gradient(135deg, #f87171, #ef4444)", color: "#fff", border: "none", borderRadius: 24, padding: "10px 28px", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 14px rgba(239,68,68,0.35)" },
  disabledStartBtn: { background: "#f3f4f6", color: "#111827", border: "none", borderRadius: 24, padding: "10px 28px", fontSize: 13, fontWeight: 600, cursor: "not-allowed", opacity: 0.9 },
  secondaryBtn: { background: "transparent", border: "1px solid #f87171", borderRadius: 24, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  chat: { display: "flex", flexDirection: "column", gap: 12, width: "100%" },
  lexaBubbleWrap: { display: "flex", alignItems: "flex-start", gap: 10 },
  lexaAvatar: { width: 40, height: 40, borderRadius: "100%", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1.5px solid #f5f5f5" },
  lexaName: { fontSize: 16, fontWeight: 700, color: "#C95B5B", marginBottom: 4 },
  lexaBubble: { background: "#ffffff", border: "1px solid #f3f4f6", borderRadius: "0 12px 12px 12px", padding: "10px 14px", fontSize: "16px", fontWeight: "500", color: "#000000", lineHeight: 1.6, maxWidth: "642px" },
  userBubble: { background: "#fff", border: "1px solid #f3f4f6", borderRadius: "12px 12px 12px 0", padding: "10px 14px", fontSize: "16px", fontWeight: "500", color: "#374151", lineHeight: 1.6 },
  contentAlign: { marginLeft: 50, maxWidth: "642px", position: "relative" },
  instructionLabel: { fontSize: 14, color: "#6b7280", margin: "8px 0 12px 0" },
  infoCard: { display: "flex", alignItems: "flex-start", gap: 10, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#374151", marginBottom: "12px" },
  warningCard: { display: "flex", alignItems: "flex-start", gap: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#92400e", marginBottom: "12px" },
  tipCard: { display: "flex", alignItems: "flex-start", gap: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#166534", marginBottom: "12px" },
  detailSection: { marginLeft: 50, maxWidth: "642px", position: "relative" },
  detailWrap: { display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  detailBubble: { display: "flex", alignItems: "center", gap: 8, border: "1px solid transparent", borderRadius: 20, padding: "8px 14px", fontSize: 14, fontWeight: 500, lineHeight: 1.5 },
  detailIndex: { display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", border: "1px solid currentColor", fontSize: 11, fontWeight: 700, flexShrink: 0 },
  userAvatar: { width: 40, height: 40, borderRadius: "50%", background: "#fecaca", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold" },
  listeningCard: { background: "#C95B5B", borderRadius: "24px 0 24px 24px", padding: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" },
  recordBtn: { border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  transcriptBox: { marginTop: 10, background: "#fff", borderRadius: "12px", padding: "12px" },
};

const css = `
  @keyframes pulseGlow {
    0% { transform: scale(0.9); opacity: 0.6; }
    50% { transform: scale(1.1); opacity: 0.9; }
    100% { transform: scale(0.9); opacity: 0.6; }
  }
`;