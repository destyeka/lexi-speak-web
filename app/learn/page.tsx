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
  FINAL_RESULT: "FINAL_RESULT",
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
  setAudioUrl?: React.Dispatch<React.SetStateAction<string[]>>;
  testSessionId?: string | null;

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
  setAudioUrl?: React.Dispatch<React.SetStateAction<string[]>>;
  testSessionId?: string | null;

}

interface ResultPageProps {
  transcript: string;
  topic: Topic | null;
  partLabel: string;
  unitIndex: number | null;
  partIndex: number | null;
  mode?: "learn" | "test" | null;
  assignmentId?: string | null;
  audioUrl?: string[] | null;
  testSessionId?: string | null;
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
  PART2_RESULT: "part2_result",
  PART3_INTRO: "part3_intro",
  PART3_SESSION: "part3_session",
  PART3_RESULT: "part3_result",
  FINAL_RESULT: "FINAL_RESULT"
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
  assignmentId,
  audioUrl,
  mode,
  testSessionId
}: {
  transcript: string;
  topic: Topic | null;
  partLabel: string;
  partIndex: number;
  unitIndex: number | null;
  assignmentId?: string | null;
   audioUrl?: string[] | null;
  mode?: "learn" | "test" | null;
  testSessionId?: string | null;
}) {
  const trimmedTranscript = transcript.trim();
  if (!trimmedTranscript) return;

  const rubricItems = (topic?.details || [])
    .map((detail) => ({
      title: detail.content.trim(),
      rubric: detail.rubric?.trim() || "",
    }))
    .filter((item) => item.rubric.length > 0);
    console.log("SAVE AUDIO URL =", audioUrl);
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
  console.log("==========");
console.log("PART =", partIndex);
console.log("TRANSCRIPT =", trimmedTranscript);
console.log("EVALUATION =", evaluation);
console.log("OVERALL =", evaluation?.overall);
console.log("==========");
 
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
  const analysisPayload = {
    title: partLabel,
    overallScore: evaluation.overall,
    level: evaluation.level,
    metrics: metricPayload,
    recommendation: evaluation.recommendation ?? null,
    analysis: evaluation.analysis ?? null,
  };

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
      assignment_id: assignmentId ?? null,
      analysis: analysisPayload,
      attempt_type: mode === "test" ? "test" : "practice",
      audio_url: audioUrl ?? null,
      test_session_id: testSessionId
    }),
  });

  if (assignmentId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      let submittedAt = new Date().toISOString();
      try {
        const { data: latestScoreRow, error: scoreError } = await supabase
          .from("student_score_history")
          .select("score, recorded_at")
          .eq("student_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!scoreError && latestScoreRow?.recorded_at) {
          submittedAt = latestScoreRow.recorded_at;
        }
      } catch (e) {
        // ignore
      }

      try {
        const { error: submissionError } = await supabase
          .from("assignment_submissions")
          .upsert([
            {
              assignment_id: assignmentId,
              student_id: user.id,
              status: "submitted",
              submitted_at: submittedAt,
              updated_at: submittedAt,
              score: latestScore,
              metrics: metricPayload,
              analysis: analysisPayload,
              audio_url: audioUrl ?? null,
            },
          ], { onConflict: "assignment_id,student_id" });
        if (submissionError) throw submissionError;
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes("column \"score\" does not exist") || msg.includes("column \"analysis\" does not exist") || msg.includes("42703")) {
          await supabase
            .from("assignment_submissions")
            .upsert([
              {
                assignment_id: assignmentId,
                student_id: user.id,
                status: "submitted",
                submitted_at: submittedAt,
                updated_at: submittedAt,
                audio_url: audioUrl ?? null,
              },
            ], { onConflict: "assignment_id,student_id" });
        } else {
          console.error(err);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
}

export default function LexaPracticeSession() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState<PageValue>(PAGES.INTRO);
  const [time, setTime] = useState(0);

 const [part1AudioUrl, setPart1AudioUrl] = useState<string[]>([]);
  useEffect(() => {
    console.log(
      "PART1 AUDIO STATE =",
      part1AudioUrl
    );
  }, [part1AudioUrl]);
  const [part2AudioUrl, setPart2AudioUrl] = useState<string[]>([]);
  const [part3AudioUrl, setPart3AudioUrl] = useState<string[]>([]);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);


  const [recError, setRecError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [sessionTopics, setSessionTopics] = useState<Topic[]>([]);
  const [isTopicsLoading, setIsTopicsLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const assignmentAutoStartedRef = useRef(false);

  const [transcriptPart3, setTranscriptPart3] = useState("");
  const [transcriptPart1, setTranscriptPart1] = useState("");
  const [transcriptPart2, setTranscriptPart2] = useState("");

  const [testSessionId, setTestSessionId] = useState<string | null>(null);
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

  if (mode === "test") {
    setTestSessionId(crypto.randomUUID());
  }

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
    setTime(5 * 60);
    setIsListening(true);
    setIsRecording(false);
    setRecError(null);
    setInterimTranscript("");
    setTranscriptPart3("");
    setLiveTranscript("");
    setPage(PAGES.PART3_SESSION);
  };

  


   const finishSession = async () => {
  if (isUploadingAudio) {
    alert("Mohon tunggu, audio masih diupload...");
    return;
  }

  setIsListening(false);
  setIsRecording(false);


    const remainingText = liveTranscript.trim() || interimTranscript.trim();

    const appendIfMissing = (current: string, setter: (v: string) => void, extra: string) => {
      const final = (current + (extra ? ` ${extra}` : "")).trim();
      if (extra && !current.includes(extra)) setter(final);
      return final;
    };

    if (page === PAGES.PART3_SESSION) {
  const finalTranscript = appendIfMissing(
    transcriptPart3,
    setTranscriptPart3,
    remainingText
  );

  console.log("PART1 AUDIO BEFORE SAVE =", part1AudioUrl);
console.log("PART2 AUDIO BEFORE SAVE =", part2AudioUrl);
console.log("PART3 AUDIO BEFORE SAVE =", part3AudioUrl);

  if (mode === "test") {
    await persistPracticeResult({
      transcript: finalTranscript,
  topic: part3Topic,
  partLabel: "Part 3",
  partIndex: 3,
  unitIndex: resolvedUnitIndex,
  assignmentId,
  audioUrl: part3AudioUrl,
  mode,
  testSessionId,
});
  } else if (isAssignment) {
    void saveAssignmentProgress();
  }

    if (mode === "test") {
    setPage(PAGES.FINAL_RESULT);
  } else {
    setPage(PAGES.PART3_RESULT);
  }


} else if (page === PAGES.PART2_SESSION) {
      const finalTranscript = appendIfMissing(transcriptPart2, setTranscriptPart2, remainingText);
      if (mode === "test") {
      await persistPracticeResult({
        transcript: finalTranscript,
        topic: part2Topic,
        partLabel: "Part 2",
        partIndex: 2,
        unitIndex: resolvedUnitIndex,
        assignmentId,
        audioUrl: part2AudioUrl,
        mode,
        testSessionId,
      });

      setPage(PAGES.PART3_INTRO);
    } else if (isAssignment) {
        void saveAssignmentProgress();
        if (part3Topic) setPage(PAGES.PART3_INTRO);
        else setPage(PAGES.PART2_RESULT);
      } else {
        setPage(PAGES.PART2_RESULT);
      }
    } else {
      const finalTranscript = appendIfMissing(transcriptPart1, setTranscriptPart1, remainingText);
      if (mode === "test") {
          await persistPracticeResult({
            transcript: finalTranscript,
            topic: part1Topic,
            partLabel: "Part 1",
            partIndex: 1,
            unitIndex: resolvedUnitIndex,
            assignmentId,
            audioUrl: part1AudioUrl,
            mode,
            testSessionId,
          });

          

          setPage(PAGES.PART2_INTRO);
        } else if (isAssignment) {
        void saveAssignmentProgress();
        if (part2Topic) setPage(PAGES.PART2_INTRO);
        else setPage(PAGES.RESULT);
      } else {
        setPage(PAGES.RESULT);
      }
      console.log("PART1 AUDIO:", part1AudioUrl);
console.log("PART2 AUDIO:", part2AudioUrl);
console.log("PART3 AUDIO:", part3AudioUrl);
    }

    console.log(
  "SAVE PART1 AUDIO =",
  JSON.stringify(part1AudioUrl)
);

console.log(
  "SAVE PART2 AUDIO =",
  JSON.stringify(part2AudioUrl)
);

console.log(
  "SAVE PART3 AUDIO =",
  JSON.stringify(part3AudioUrl)
);

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

 const finishAllSession = async () => {
  const allTranscript = [
    transcriptPart1,
    transcriptPart2,
    transcriptPart3,
  ]
    .filter(Boolean)
    .join("\n\n");

  const allAudio = [
    ...part1AudioUrl,
    ...part2AudioUrl,
    ...part3AudioUrl,
  ];

  await persistPracticeResult({
    transcript: allTranscript,
    topic: null,
    partLabel: "Full Test",
    partIndex: 0,
    unitIndex: resolvedUnitIndex,
    assignmentId,
    audioUrl: allAudio,
    mode,
    testSessionId
  });

  setPage(PAGES.FINAL_RESULT);
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

  const isAssignmentResultPage = isAssignment && ([PAGES.RESULT, PAGES.PART2_RESULT, PAGES.PART3_RESULT] as PageValue[]).includes(page);
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
     const transcript =
      currentAssignmentPart === 2
        ? transcriptPart2
        : currentAssignmentPart === 3
          ? transcriptPart3
          : transcriptPart1;

   const currentAudioUrl =
  currentAssignmentPart === 1
    ? part1AudioUrl
    : currentAssignmentPart === 2
    ? part2AudioUrl
    : part3AudioUrl;

      await persistPracticeResult({
      transcript,
      topic,
      partLabel: `Part ${currentAssignmentPart}`,
      partIndex: currentAssignmentPart,
      unitIndex: resolvedUnitIndex,
      assignmentId,
      audioUrl: currentAudioUrl,
      mode,
      testSessionId
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
      const currentAudioUrl =
  currentAssignmentPart === 1
    ? part1AudioUrl
    : currentAssignmentPart === 2
      ? part2AudioUrl
      : part3AudioUrl;
      
      let submittedAt = new Date().toISOString();
      let submissionScore = null;
      let submissionMetrics = null;

      try {
        const { data: latestScoreRow, error: scoreError } = await supabase
          .from("student_score_history")
          .select("score, recorded_at, metrics")
          .eq("student_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!scoreError && latestScoreRow) {
          if (latestScoreRow.recorded_at) {
            submittedAt = latestScoreRow.recorded_at;
          }
          submissionScore = latestScoreRow.score ?? null;
          submissionMetrics = latestScoreRow.metrics ?? null;
        }
      } catch (e) {
        console.error("Gagal membaca score history, menggunakan fallback timestamp default.", e);
      }

      try {
        const { error: submissionError } = await supabase
          .from("assignment_submissions")
          .upsert([
            {
              assignment_id: assignmentId,
              student_id: user.id,
              status: "submitted",
              submitted_at: submittedAt,
              updated_at: submittedAt,
              score: submissionScore,
              metrics: submissionMetrics,
              audio_url: currentAudioUrl,
            },
          ], { onConflict: "assignment_id,student_id" });

        if (submissionError) throw submissionError;
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes("column \"score\" does not exist") || msg.includes("42703")) {
          const { error: submissionError2 } = await supabase
            .from("assignment_submissions")
            .upsert([
              {
                assignment_id: assignmentId,
                student_id: user.id,
                status: "submitted",
                submitted_at: submittedAt,
                updated_at: submittedAt,
                audio_url: currentAudioUrl,
              },
            ], { onConflict: "assignment_id,student_id" });

          if (submissionError2) throw submissionError2;
        } else {
          throw err;
        }
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
      <header style={styles.header}>
        <button style={styles.backBtn} onClick={() => {
          if (page === PAGES.SESSION) setPage(PAGES.INTRO);
          console.log("PART1 TRANSCRIPT LENGTH", transcriptPart1.length);
console.log("PART1 TRANSCRIPT", transcriptPart1);
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

      <main style={styles.main}>
        {page === PAGES.INTRO && <IntroPage topic={part1Topic} />}
        
       
        {page === PAGES.SESSION && (
          <SessionPage 
            topic={part1Topic} 
            questions={part1Questions} 
            isListening={isListening} 
            isRecording={isRecording} 
            setIsRecording={setIsRecording} 
            recError={recError} 
            setRecError={setRecError} 
            transcript={transcriptPart1} 
            setTranscript={setTranscriptPart1} 
            liveTranscript={liveTranscript} 
            setLiveTranscript={setLiveTranscript} 
            interimTranscript={interimTranscript} 
            setInterimTranscript={setInterimTranscript} 
            setAudioUrl={setPart1AudioUrl} 
            onSaveQuestionTranscripts={(arr) => {
              const joined = (arr || []).filter(Boolean).join(" ").trim();
              setTranscriptPart1((prev) => prev === joined ? prev : joined);
            }} 
            // 💡 Biarkan SessionPage mengontrol recording-nya sendiri cok!
          />
        )}
        
        {page === PAGES.RESULT && (
  <ResultPage
    transcript={transcriptPart1}
    topic={part1Topic}
    partLabel="Part 1"
    unitIndex={resolvedUnitIndex}
    partIndex={1}
    mode={mode}
    assignmentId={assignmentId}
    audioUrl={part1AudioUrl}
    testSessionId={testSessionId}
  />
)}
        {page === PAGES.PART2_INTRO && <IntroPagePart2 topic={part2Topic} bullets={part2Bullets} />}
        
 {page === PAGES.PART2_SESSION && (
  <>
    <SessionPagePart2
      isRecording={isRecording}
      setIsRecording={setIsRecording}
      transcript={transcriptPart2}
      setTranscript={setTranscriptPart2}
      liveTranscript={liveTranscript}
      setLiveTranscript={setLiveTranscript}
      interimTranscript={interimTranscript}
      setInterimTranscript={setInterimTranscript}
      recError={recError}
      setRecError={setRecError}
      isListening={isListening}
      topic={part2Topic}
      bullets={part2Bullets}
      isLoading={isTopicsLoading}
      setAudioUrl={setPart2AudioUrl}
      
    />


  </>
)}
        
        {page === PAGES.PART2_RESULT && (
  <ResultPage
    transcript={transcriptPart2}
    topic={part2Topic}
    partLabel="Part 2"
    unitIndex={resolvedUnitIndex}
    partIndex={2}
    mode={mode}
    assignmentId={assignmentId}
    audioUrl={part2AudioUrl}
    testSessionId={testSessionId}
  />
)}
        {page === PAGES.PART3_INTRO && (
          <IntroPagePart3
            topic={part3Topic}
            bullets={part3Bullets}
            isLoading={isTopicsLoading}
          />
        )}
        
 {page === PAGES.PART3_SESSION && (
  <>
    <SessionPage
      messages={part3Messages}
      questions={part3Questions}
      isListening={isListening}
      isRecording={isRecording}
      setIsRecording={setIsRecording}
      recError={recError}
      setRecError={setRecError}
      transcript={transcriptPart3}
      setTranscript={setTranscriptPart3}
      liveTranscript={liveTranscript}
      setLiveTranscript={setLiveTranscript}
      interimTranscript={interimTranscript}
      setInterimTranscript={setInterimTranscript}
      setAudioUrl={setPart3AudioUrl}
      onSaveQuestionTranscripts={(arr) => {
        const joined = (arr || [])
          .filter(Boolean)
          .join(" ")
          .trim();

        setTranscriptPart3((prev) =>
          prev === joined ? prev : joined
        );
      }}
    />


  </>
)}
        
        {page === PAGES.PART3_RESULT && (
  <ResultPage
    transcript={transcriptPart3}
    topic={part3Topic}
    partLabel="Part 3"
    unitIndex={resolvedUnitIndex}
    partIndex={3}
    mode={mode}
    assignmentId={assignmentId}
    audioUrl={part3AudioUrl}
    testSessionId={testSessionId}
  />
)}
        {page === PAGES.FINAL_RESULT && (
  <ResultPage
    transcript={[
      transcriptPart1,
      transcriptPart2,
      transcriptPart3,
    ]
      .filter(Boolean)
      .join("\n\n")}
    topic={null}
    partLabel="Full Test"
    unitIndex={resolvedUnitIndex}
    partIndex={0}
    mode={mode}
    assignmentId={assignmentId}
    audioUrl={[
      ...part1AudioUrl,
      ...part2AudioUrl,
      ...part3AudioUrl,
    ]}
    testSessionId={testSessionId}
  />
)}
      </main>

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
          ) : page === PAGES.FINAL_RESULT ? (
  <>
    <button
      style={{ background: "none", border: "none", cursor: "pointer" }}
      onClick={restartSession}
    >
      Save Progress
    </button>

    <button
      style={{
        ...styles.startBtn,
        background: "linear-gradient(135deg, #f87171, #ef4444)"
      }}
      onClick={finishAllSession}
    >
      Save & Finish All
    </button>
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
              <button 
                style={hasSpoken ? styles.startBtn : { ...styles.startBtn, background: "#d1d5db", color: "#9ca3af", boxShadow: "none", cursor: "not-allowed" }} 
                onClick={hasSpoken ? finishSession : undefined} 
                disabled={!hasSpoken || isUploadingAudio}
              > 
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

function SessionPage({
  topic,
  questions = [],
  messages: msgProp,
  isRecording,
  setIsRecording,
  recError,
  setRecError,
  transcript,
  setTranscript,
  liveTranscript,
  setLiveTranscript,
  interimTranscript,
  setInterimTranscript,
  onSaveQuestionTranscripts,
  setAudioUrl,
}: SessionPageProps & {
  questions?: string[];
}) {
  const messages = msgProp || (topic ? [
    { role: "lexa", text: `Let's talk about ${topic.title}. ${topic.prompt || "Please share your thoughts."}` }
  ] : [
    { role: "lexa", text: "Good morning, my name is Lexa. What's your name?" }
  ]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isStoppingRef = useRef(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const stoppingIntentionalRef = useRef(false);
  const transcriptRef = useRef<string>("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const questionIndexRef = useRef<number>(0);
  const [questionTranscripts, setQuestionTranscripts] = useState<string[]>([]);
  const [testSessionId, setTestSessionId] = useState<string | null>(null);
  const perQuestionAccumRef = useRef<string[]>([]);

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
    const init = Array(questions.length).fill("");
    setQuestionTranscripts(init);
    perQuestionAccumRef.current = init.slice();
  }, [questions.join("|")]);

  const activeQuestion = questions[questionIndex] ?? null;
  const hasMoreQuestions = questionIndex < questions.length - 1;

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

  const conversationMessages: ChatMessage[] = [];
  conversationMessages.push(...messages);

  const upto = Math.min(questionIndex, questions.length - 1);
  for (let i = 0; i <= upto; i++) {
    const q = questions[i];
    if (q) conversationMessages.push({ role: "lexa", text: q });
    const userAns = questionTranscripts[i];
    if (userAns && userAns.trim()) conversationMessages.push({ role: "user", text: userAns.trim() });
  }

  if (activeQuestion && (questionIndex <= questions.length - 1)) {
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
      isStoppingRef.current = true;
      try {
        recognitionRef.current.stop();
      } catch {
        recognitionRef.current.abort();
      }
    } catch {}
  }

  setQuestionIndex((prev) => {
    const next = prev + 1;
    questionIndexRef.current = next;
    perQuestionAccumRef.current[next] =
      perQuestionAccumRef.current[next] || "";
    return next;
  });
};

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    const currentAnswered = Boolean((questionTranscripts[questionIndexRef.current] || "").trim());
    if (currentAnswered && hasMoreQuestions) {
      advanceQuestion();
      setTimeout(() => startRecording(), 120);
      return;
    }

    startRecording();
  };

  const startRecording = async () => {
    audioChunksRef.current = [];
    setRecError(null);
    setLiveTranscript("");
    setInterimTranscript("");
    const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
});

mediaStreamRef.current = stream;
audioChunksRef.current = [];

const mediaRecorder = new MediaRecorder(stream);
console.log("RECORDER MIME:", mediaRecorder.mimeType);

mediaRecorder.ondataavailable = (event) => {
  if (event.data.size > 0) {
    audioChunksRef.current.push(event.data);
  }
};


mediaRecorder.onstop = async () => {
  console.log("ONSTOP DIPANGGIL");

  setIsUploadingAudio(true);

  console.log(
    "Chunks:",
    audioChunksRef.current.length
  );

  console.log(
    "Size:",
    audioChunksRef.current.reduce(
      (acc, chunk) => acc + chunk.size,
      0
    )
  );

  try {
    const audioBlob = new Blob( audioChunksRef.current,
  {
    type: mediaRecorder.mimeType,
  }
);
    console.log("BLOB SIZE =", audioBlob.size);
    console.log("BLOB TYPE =", audioBlob.type);

    const testUrl = URL.createObjectURL(audioBlob);
    console.log("LOCAL TEST =", testUrl);


    const fileName = `audio_${Date.now()}.webm`;

    const { error } = await supabase.storage
      .from("SPEAKING-AUDIOS")
      .upload(fileName, audioBlob, {
      contentType: mediaRecorder.mimeType,
    });

    if (error) {
      console.error(error);
      return;
    }

    const { data } = supabase.storage
      .from("SPEAKING-AUDIOS")
      .getPublicUrl(fileName);

    console.log("UPLOAD SUCCESS:", data.publicUrl);

  setAudioUrl?.((prev) => {
    console.log("UPLOAD AUDIO:", prev, data.publicUrl);
    return [...prev, data.publicUrl];
  });

    console.log(
      "SET AUDIO URL:",
      data.publicUrl
    );
  } catch (err) {
    console.error(err);
  } finally {
    setIsUploadingAudio(false);

    mediaStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());
  }
};

mediaRecorder.start(1000);
console.log(
  "REKAMAN DIMULAI",
  Date.now()
);
mediaRecorderRef.current = mediaRecorder;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) throw new Error("Browser tidak mendukung Live Transcription.");

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
    transcriptRef.current = (questionTranscripts[questionIndexRef.current] || "").trim();
    perQuestionAccumRef.current[questionIndexRef.current] = perQuestionAccumRef.current[questionIndexRef.current] || "";

    recognition.onresult = (event: any) => {
      let accumulatedFinal = "";
      let interimResult = "";

      for (
          let i = event.resultIndex;
          i < event.results.length;
          ++i
        ) {
        if (event.results[i].isFinal) {
          accumulatedFinal += event.results[i][0].transcript + " ";
        } else {
          interimResult += event.results[i][0].transcript;
        }
      }

      const baseSpeech = (questionTranscripts[questionIndexRef.current] || "").trim();
      const totalFinalText = (baseSpeech ? baseSpeech + " " : "") + accumulatedFinal;

      transcriptRef.current = totalFinalText.trim();
      setLiveTranscript(totalFinalText + interimResult);
      setInterimTranscript(interimResult);

      const idxForSave = questionIndexRef.current;
      console.log(
  "PART3 FINAL TEXT =",
  totalFinalText.trim()
);
      setTranscript(totalFinalText.trim());

      setQuestionTranscripts((prevArr) => {
        const copy = prevArr && prevArr.length ? [...prevArr] : Array(questions.length).fill("");
        copy[idxForSave] = totalFinalText.trim();
        return copy;
      });
    };

    recognition.onerror = (e: SpeechRecognitionErrorEventLike) => {
      if (e.error === "aborted") return;
      if (e.error === "no-speech") {
        setInterimTranscript("");
        setLiveTranscript(transcriptRef.current || "");
        try { if (recognitionRef.current && !isStoppingRef.current) recognitionRef.current.start(); } catch { }
        return;
      }
      setRecError(`Error: ${e.error}`);
      const finalText = ((transcriptRef.current || "") + (interimTranscript || "")).trim();
      if (finalText) {
        const idxForSave = questionIndexRef.current;
        perQuestionAccumRef.current[idxForSave] = (perQuestionAccumRef.current[idxForSave] || "") + finalText;
        setTimeout(() => {
          setQuestionTranscripts((prevArr) => {
            const copy = prevArr && prevArr.length ? [...prevArr] : Array(questions.length).fill("");
            copy[idxForSave] = perQuestionAccumRef.current[idxForSave] || "";
            return copy;
          });
        }, 0);
      }
      try { if (recognitionRef.current) { isStoppingRef.current = true; recognitionRef.current.abort(); } } catch { }
      recognitionRef.current = null;
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (stoppingIntentionalRef.current) {
        stoppingIntentionalRef.current = false;
        const finalText = ((transcriptRef.current || "") + (interimTranscript || "")).trim();
        if (finalText) {
          const idxForSave = questionIndexRef.current;
          perQuestionAccumRef.current[idxForSave] = (perQuestionAccumRef.current[idxForSave] || "") + finalText;
          setTimeout(() => {
            setQuestionTranscripts((prevArr) => {
              const copy = prevArr && prevArr.length ? [...prevArr] : Array(questions.length).fill("");
              copy[idxForSave] = perQuestionAccumRef.current[idxForSave] || "";
              return copy;
            });
            setTimeout(() => { try { if (hasMoreQuestions) advanceQuestion(); } catch { } }, 120);
          }, 0);
        }
        try { recognitionRef.current = null; } catch { }
        setIsRecording(false);
        return;
      }

      if (recognitionRef.current && !isStoppingRef.current) {
        try { recognition.start(); } catch { }
      } else {
        setIsRecording(false);
      }
    };

    recognition.start();
    setIsRecording(true);
  };

const stopRecording = () => {
  console.log(
  "REKAMAN DIHENTIKAN",
  Date.now()
);
  setIsRecording(false);

  const recorder = mediaRecorderRef.current;

  if (
  recorder &&
  recorder.state === "recording"
) {
  recorder.requestData();
  recorder.stop();
}

  if (recognitionRef.current) {
    stoppingIntentionalRef.current = true;

    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.log(err);
    }
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

function SessionPagePart2({ isRecording, setIsRecording, transcript, setTranscript, liveTranscript, setLiveTranscript, interimTranscript, setInterimTranscript, recError, setRecError, topic, bullets, isLoading,setAudioUrl }: SessionPagePart2Props) {
  const recognitionRef = useRef<any>(null);
 
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  

  const topicTitle = topic?.title ?? "Cue Card Topic";
  const topicPrompt = topic?.prompt ?? "Describe the topic naturally and cover all bullet points.";
  const bulletItems = bullets ?? (topic ? getBulletsFromTopic(topic) : []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
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

      const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  mediaStreamRef.current = stream;
  audioChunksRef.current = [];

  const mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunksRef.current.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    try {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });

      const fileName = `audio_${Date.now()}.webm`;

      const { error } = await supabase.storage
        .from("SPEAKING-AUDIOS")
        .upload(fileName, audioBlob, {
          contentType: "audio/webm",
        });

      if (error) {
        console.error(error);
        return;
      }

      const { data } = supabase.storage
        .from("SPEAKING-AUDIOS")
        .getPublicUrl(fileName);

      console.log("PART2 AUDIO:", data.publicUrl);

      setAudioUrl?.((prev) => [
        ...prev,
        data.publicUrl,
      ]);
      console.log("PART2 URL MASUK:", data.publicUrl);
    } catch (err) {
      console.error(err);
    } finally {
      mediaStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());
    }
  };

  mediaRecorder.start();

  mediaRecorderRef.current = mediaRecorder;
   

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

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

   recognition.onend = () => {
  if (recognitionRef.current) {
    try {
      recognition.start();
    } catch {}
  }
};

    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
  setIsRecording(false);

  if (mediaRecorderRef.current) {
    mediaRecorderRef.current.stop();
  }

  if (recognitionRef.current) {
      try {
        recognitionRef.current.stop(); // Fix: Menggunakan stop() agar data kata-kata terakhir terproses penuh
      } catch (e) {
        console.error("Gagal menghentikan perekaman:", e);
      }
      recognitionRef.current = null;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
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

      <div
        onClick={() => setIsFlipped(!isFlipped)}
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

          <div style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
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
            <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#991b1b" }}>Cue Card Closed</span>
            </div>

            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, position: "relative" }}>
              <div
                onClick={(e) => {
                  e.stopPropagation();
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
                <svg width="40" height="40" viewBox="0 0 24 24" fill={isRecording ? "#ef4444" : "#9ca3af"}>
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                </svg>
              </div>
            </div>

            <div
              onClick={(e) => e.stopPropagation()}
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

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: "100%", paddingRight: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -8 }}>
          <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>davinzata</span>
          <div style={styles.userAvatar}>D</div>
        </div>
      </div>
    </div>
  );
}



function ResultPage({ transcript, topic, partLabel, unitIndex, partIndex, mode, assignmentId, audioUrl, testSessionId }: ResultPageProps) {
  const [evaluation, setEvaluation] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
const [recError, setRecError] = useState(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  // const [testSessionId, setTestSessionId] = useState<string | null>(null);
  const [finalTestSummary, setFinalTestSummary] = useState<{
  overall: number;
  part1: number;
  part2: number;
  part3: number;

  fluency: number;
  lexical: number;
  grammar: number;
  pronunciation: number;
} | null>(null);
  const [finalTestPartDetails, setFinalTestPartDetails] = useState<Array<{
    label: string;
    score: number;
    description: string;
    evaluation: string;
    components: Array<{ label: string; score: string; description: string }>;
  }> | null>(null);
  const [finalTestLoading, setFinalTestLoading] = useState(false);
 
  useState(false);
  
  
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
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.id) {
        console.log("❌ Gagal mendapatkan ID user dari auth Supabase");
        return;
      }
      const currentUserId = authData.user.id;

      if (analysisLoading || !evaluation || !evaluation.analysis) {
        console.log("⏳ Menunggu AI selesai menyusun ulasan teks panjang...");
        return;
      }

      if (hasSavedFinalSummaryRef.current) return;
      hasSavedFinalSummaryRef.current = true;

      setFinalTestLoading(true);
      setFinalTestError(null);

      let finalPart1 = 0;
      let finalPart2 = 0;
      let finalPart3 = 0;
      let finalOverall = 0;

      try {
        console.log("📊 MEMBACA HISTORI NILAI PART SEBELUMNYA...");
        const { data: historyRows, error: historyError } =
        await supabase
          .from("student_score_history")
          .select("score, part_index, metrics, test_session_id")
          .eq("student_id", currentUserId)
          .eq("unit_index", unitIndex)
          .eq("attempt_type", "test")
          .eq("test_session_id", testSessionId)
          .in("part_index", [1,2,3])
          .order("recorded_at", { ascending: false })
          .limit(3);

      if (historyError) throw historyError;

console.log("=== HISTORY ROWS ===");
historyRows?.forEach((row) => {
  console.log(
    "PART:",
    row.part_index,
    "SCORE:",
    row.score
  );
});
console.log("CURRENT TEST SESSION =", testSessionId);
console.log("ROW COUNT =", historyRows?.length);
console.log(
  historyRows?.map((r) => ({
    score: r.score,
    part: r.part_index,
    session: r.test_session_id,
  }))
);

const partRows = (historyRows ?? []).filter(
  (row) => row.part_index !== null
);

const part1Row = partRows.find(
  (r) => r.part_index === 1
);

const part2Row = partRows.find(
  (r) => r.part_index === 2
);

const part3Row = partRows.find(
  (r) => r.part_index === 3
);

finalPart1 = Number(part1Row?.score ?? 0);
finalPart2 = Number(part2Row?.score ?? 0);
finalPart3 = Number(part3Row?.score ?? evaluation.overall);

console.log("P1 ROW =", part1Row);
console.log("P2 ROW =", part2Row);
console.log("P3 ROW =", part3Row);
        
        const validScores = [finalPart1, finalPart2, finalPart3].filter((s) => s > 0);
        finalOverall = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0;
         console.log("FINAL P1 =", finalPart1);
        console.log("FINAL P2 =", finalPart2);
        console.log("FINAL P3 =", finalPart3);
        console.log("FINAL OVERALL =", finalOverall);

        const fluencyScores: number[] = [];
const lexicalScores: number[] = [];
const grammarScores: number[] = [];
const pronunciationScores: number[] = [];

partRows.forEach((row) => {
  const metrics = Array.isArray(row.metrics)
    ? row.metrics
    : [];

  metrics.forEach((m: any) => {
    const score = Number(m.score ?? 0);

    if (m.id === "fluency")
      fluencyScores.push(score);

    if (
      m.id === "vocabulary" ||
      m.id === "lexical"
    )
      lexicalScores.push(score);

    if (m.id === "grammar")
      grammarScores.push(score);

    if (m.id === "pronunciation")
      pronunciationScores.push(score);
  });
});
const avgFluency =
  fluencyScores.length
    ? fluencyScores.reduce((a,b)=>a+b,0) /
      fluencyScores.length
    : 0;

const avgLexical =
  lexicalScores.length
    ? lexicalScores.reduce((a,b)=>a+b,0) /
      lexicalScores.length
    : 0;

const avgGrammar =
  grammarScores.length
    ? grammarScores.reduce((a,b)=>a+b,0) /
      grammarScores.length
    : 0;

const avgPronunciation =
  pronunciationScores.length
    ? pronunciationScores.reduce((a,b)=>a+b,0) /
      pronunciationScores.length
    : 0;


        if (!cancelled) {
          setFinalTestSummary({
  overall: finalOverall,
  part1: finalPart1,
  part2: finalPart2,
  part3: finalPart3,

  fluency: avgFluency,
  lexical: avgLexical,
  grammar: avgGrammar,
  pronunciation: avgPronunciation,
});
        }

        const currentPart3Metrics = Array.isArray(evaluation?.metrics) ? evaluation.metrics : [];
        const mappedPart3Metrics = currentPart3Metrics.map((m: any) => ({
          id: `part3_${m.id || "metric"}`,
          label: `Part 3 - ${m.label || "Criteria"}`,
          score: m.score,
          text: m.text || ""
        }));

        const safeMetricsPayload = JSON.parse(
          JSON.stringify([
            { id: "part1", label: "Part 1 Score", score: finalPart1, text: "Final test summary" },
            { id: "part2", label: "Part 2 Score", score: finalPart2, text: "Final test summary" },
            { id: "part3", label: "Part 3 Score", score: finalPart3, text: "Final test summary" },
            ...(Array.isArray(mappedPart3Metrics) ? mappedPart3Metrics : [])
          ])
        );

        console.log("🚀 EKSEKUSI INSERT DATA KE SUPABASE...");
        const { error: insertError } = await supabase.from("student_score_history").insert({
          student_id: currentUserId,
          score: finalOverall,
          metrics: safeMetricsPayload,
          analysis: JSON.parse(JSON.stringify({ text: evaluation.analysis })),
          notes: evaluation.recommendation || "Final test summary processed.",
          speaking_attempts: 0,
          unit_index: unitIndex,
          part_index: null, 
          recorded_at: new Date().toISOString(),
          recorded_by: currentUserId,
          attempt_type: "test",
          assignment_id: assignmentId ?? null,
           test_session_id: testSessionId ?? null,
        });

        if (insertError) throw insertError;

      } catch (err: any) {
        console.error("❌ ERROR DI LOAD TEST SUMMARY:", err);
        if (!cancelled) {
          setFinalTestError(err.message || "Gagal memproses skor akhir.");
        }
        hasSavedFinalSummaryRef.current = false;
      } finally {
        if (!cancelled) {
          setFinalTestLoading(false);
        }
      }
    };

    const isFinalTestResult =
    mode === "test" &&
    partIndex === 0;

if (isFinalTestResult) {
  void loadTestSummary();
  
  console.log("PART INDEX =", partIndex);
  
console.log("IS FINAL =", isFinalTestResult);
}

    return () => {
      cancelled = true;
    };
  }, [
  analysisLoading,
  evaluation,
  mode,
  partIndex,
  transcript,
  unitIndex,
  testSessionId,
  assignmentId,
]);

  useEffect(() => {
   const persistResult = async () => {

    
    console.log("PROP AUDIO URL =", audioUrl);
    console.log("AUDIO URL YANG MAU DISIMPAN:", audioUrl);

  if (partIndex === 0) {
    console.log("SKIP FINAL RESULT SAVE");
    return;
  }

  if (
    analysisLoading ||
    !evaluation ||
    !transcript.trim() ||
    hasSavedRef.current
  ) {
    return;
  }
console.log("EVALUATION OVERALL =", evaluation?.overall);
console.log("FINAL SUMMARY =", finalTestSummary?.overall);
console.log("PART INDEX =", partIndex);
      const latestScore =
  partIndex === 0 && finalTestSummary
    ? finalTestSummary.overall
    : Number(evaluation.overall);
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
     
      // Fix: Jika mode adalah "learn", data disimpan otomatis di block ini.
            console.log("===== SAVE PAYLOAD =====");
      console.log("PART =", partIndex);
      console.log("TRANSCRIPT LENGTH =", transcript.length);
      console.log("TRANSCRIPT =", transcript);
      console.log("SCORE =", latestScore);
      console.log("========================");
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
          analysis: JSON.parse(JSON.stringify({ text: evaluation.analysis })),
          notes: evaluation.recommendation ?? null,
          metrics: metricPayload,
          attempt_type: mode === "test" ? "test" : "practice",
          assignment_id: assignmentId ?? null,
          audio_url: audioUrl || null,
          test_session_id: testSessionId ?? null,
          
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
      } catch {}
      window.dispatchEvent(new Event(refreshKey));

      setSaveStatus("saved");
    };

    console.log("AUDIO URL YANG MAU DISIMPAN:", audioUrl);

    void persistResult();
  }, [analysisLoading, evaluation, partIndex, transcript, unitIndex, mode, assignmentId, audioUrl,   testSessionId]);
  if (evaluation) {
  console.log("==========");
  console.log("PART =", partIndex);
  console.log("TRANSCRIPT =", transcript);
  console.log("EVALUATION =", evaluation);
  console.log("OVERALL =", evaluation.overall);
  console.log("==========");
}

  const scoreData: EvaluationResult = evaluation ?? {
    overall: "-",
    level: "Waiting",
    metrics: [],
    recommendation: "Analyzing transcript...",
    analysis: "AI analysis will appear after the transcript is processed.",
  };

  
  
const isFinalTestResult =
  mode === "test" &&
  partIndex === 0;

console.log("PART INDEX =", partIndex);
console.log("MODE =", mode);
console.log("FINAL SUMMARY =", finalTestSummary);
console.log("IS FINAL =", isFinalTestResult);


let testScoreData: EvaluationResult | null = null;

if (isFinalTestResult && finalTestSummary) {
  testScoreData = {
    overall: finalTestSummary.overall.toFixed(1),

    level: `Final Test Band ${finalTestSummary.overall.toFixed(1)}`,

   
    metrics: [
  {
    id: "fluency",
    label: "Fluency & Coherence",
    score: finalTestSummary.fluency.toFixed(1),
    text: "Average across all parts",
  },
  {
    id: "vocabulary",
    label: "Lexical Resource",
    score: finalTestSummary.lexical.toFixed(1),
    text: "Average across all parts",
  },
  {
    id: "grammar",
    label: "Grammar Range & Accuracy",
    score: finalTestSummary.grammar.toFixed(1),
    text: "Average across all parts",
  },
  {
    id: "pronunciation",
    label: "Pronunciation",
    score: finalTestSummary.pronunciation.toFixed(1),
    text: "Average across all parts",
  },
],

    recommendation:
  evaluation?.recommendation ??
  "Review each part to improve your score.",

analysis: `
The candidate achieved an overall band score of ${finalTestSummary.overall.toFixed(1)}.

Part 1 score was ${finalTestSummary.part1.toFixed(1)},
Part 2 score was ${finalTestSummary.part2.toFixed(1)},
and Part 3 score was ${finalTestSummary.part3.toFixed(1)}.

The strongest performance appeared in the later sections of the test, showing improved ability to develop ideas and communicate responses.
To achieve a higher band score, focus on expanding answers, increasing vocabulary variety, improving grammatical accuracy, and maintaining clear pronunciation throughout all parts of the speaking test.
`,
  };
}
  
  console.log("FINAL TEST SUMMARY =", finalTestSummary);
console.log("PART INDEX =", partIndex);


  const displayScoreData = testScoreData ?? scoreData;
  const testPartBreakdown =
  mode === "test" &&
  partIndex === 0 &&
  finalTestSummary &&
  finalTestPartDetails
    ? finalTestPartDetails.map((part) => ({
        label: part.label,
        score: part.score.toFixed(1),
        description: part.description,
        evaluation: part.evaluation,
        components: part.components,
      }))
    : undefined;
    console.log("ANALYSIS CARD DATA", {
  overall: displayScoreData?.overall,
  level: displayScoreData?.level,
  metrics: displayScoreData?.metrics,
});

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
`