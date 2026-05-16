"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import {
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
  messages: ChatMessage[];
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
}

interface ResultPageProps { transcript: string; }
interface MetricData { id: string; label: string; score: string; text: string; }
interface ScoreData { overall: string; metrics: MetricData[]; recommendation: string; }
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
  ,PART3_INTRO: "part3_intro",
  PART3_SESSION: "part3_session",
  PART3_RESULT: "part3_result"
};

type PageValue = PageMap[keyof PageMap];

const PulseRing = ({ color = "#ef4444", size = 180 }: { color?: string; size?: number }) => (
  <div style={{ position: "absolute", width: size, height: size, borderRadius: "50%", background: `radial-gradient(circle, ${color}33 0%, ${color}11 50%, transparent 75%)`, animation: "pulseGlow 2.5s ease-in-out infinite", pointerEvents: "none" }} />
);

export default function LexaPracticeSession() {
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

  // PART 3 state (mirip Part 1)
  const [transcriptPart3, setTranscriptPart3] = useState("");

  // PERBAIKAN 1: Pisah state transkrip agar Part 1 tidak terhapus oleh Part 2
  const [transcriptPart1, setTranscriptPart1] = useState("");
  const [transcriptPart2, setTranscriptPart2] = useState("");

  const [messages] = useState<ChatMessage[]>([
    { role: "lexa", text: "Good morning, my name is Lexa. What's your name?" },
  ]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const unitId = searchParams.get("unit");

  useEffect(() => {
    let cancelled = false;

    const loadTopics = async () => {
      if (!unitId) {
        setSessionTopics([]);
        setIsTopicsLoading(false);
        return;
      }

      setIsTopicsLoading(true);
      const topics = await getTopicsByUnit(unitId);

      if (!cancelled) {
        setSessionTopics(topics);
        setIsTopicsLoading(false);
      }
    };

    loadTopics();

    return () => {
      cancelled = true;
    };
  }, [unitId]);

  const part1Topic = sessionTopics.find((topic) => topic.part === 1) ?? null;
  const part2Topic = sessionTopics.find((topic) => topic.part === 2) ?? null;
  const part3Topic = sessionTopics.find((topic) => topic.part === 3) ?? null;

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
      if (remainingText && !transcriptPart3.includes(remainingText)) {
        setTranscriptPart3((prev) => (prev + " " + remainingText).trim());
      }
      setPage(PAGES.PART3_RESULT);
    } else if (page === PAGES.PART2_SESSION) {
      if (remainingText && !transcriptPart2.includes(remainingText)) {
        setTranscriptPart2((prev) => (prev + " " + remainingText).trim());
      }
      setPage(PAGES.PART2_RESULT);
    } else {
      if (remainingText && !transcriptPart1.includes(remainingText)) {
        setTranscriptPart1((prev) => (prev + " " + remainingText).trim());
      }
      setPage(PAGES.RESULT);
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
  const headerTitle = page.startsWith("part2")
    ? `Practice Unit 1 – Part 2${part2Topic?.title ? ` (${part2Topic.title})` : " (Cue Card)"}`
    : page.startsWith("part3")
      ? `Practice Unit 1 – Part 3${part3Topic?.title ? ` (${part3Topic.title})` : " (Introduction)"}`
      : `Practice Unit 1 – Part 1${part1Topic?.title ? ` (${part1Topic.title})` : " (Introduction)"}`;

  const currentTranscript = page.startsWith("part2") ? transcriptPart2 : page.startsWith("part3") ? transcriptPart3 : transcriptPart1;
  const hasSpoken = Boolean(currentTranscript.trim() || liveTranscript.trim() || interimTranscript.trim());

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
        <span style={styles.headerTitle}>{headerTitle}</span>
        <div style={styles.headerRight}>
          {(page === PAGES.RESULT || page === PAGES.PART2_RESULT || page === PAGES.PART3_RESULT) && (
            <button onClick={page === PAGES.PART3_RESULT ? startPart3Session : page === PAGES.PART2_RESULT ? startPart2Session : startSession} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex", alignItems: "center", padding: 4, marginRight: 8 }} title="Restart Session">
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

      {/* Body */}
      <main style={styles.main}>
        {page === PAGES.INTRO && <IntroPage />}
        {page === PAGES.SESSION && (
          <SessionPage messages={messages} isListening={isListening} isRecording={isRecording} setIsRecording={setIsRecording} recError={recError} setRecError={setRecError} transcript={transcriptPart1} setTranscript={setTranscriptPart1} liveTranscript={liveTranscript} setLiveTranscript={setLiveTranscript} interimTranscript={interimTranscript} setInterimTranscript={setInterimTranscript} />
        )}
        {page === PAGES.RESULT && <ResultPage transcript={transcriptPart1} />}
        {page === PAGES.PART2_INTRO && <IntroPagePart2 />}
        {page === PAGES.PART2_SESSION && (
          <SessionPagePart2 isRecording={isRecording} setIsRecording={setIsRecording} transcript={transcriptPart2} setTranscript={setTranscriptPart2} liveTranscript={liveTranscript} setLiveTranscript={setLiveTranscript} interimTranscript={interimTranscript} setInterimTranscript={setInterimTranscript} recError={recError} setRecError={setRecError} isListening={isListening} />
        )}
        {page === PAGES.PART2_RESULT && <ResultPage transcript={transcriptPart2} />}
        {page === PAGES.PART3_INTRO && (
          <IntroPagePart3
            topic={part3Topic}
            bullets={part3Bullets}
            isLoading={isTopicsLoading}
          />
        )}
        {page === PAGES.PART3_SESSION && (
          <SessionPage messages={part3Messages} isListening={isListening} isRecording={isRecording} setIsRecording={setIsRecording} recError={recError} setRecError={setRecError} transcript={transcriptPart3} setTranscript={setTranscriptPart3} liveTranscript={liveTranscript} setLiveTranscript={setLiveTranscript} interimTranscript={interimTranscript} setInterimTranscript={setInterimTranscript} />
        )}
        {page === PAGES.PART3_RESULT && <ResultPage transcript={transcriptPart3} />}
      </main>

      {/* Footer Utama */}
      <footer style={styles.footer}>
        {page === PAGES.RESULT ? (
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
            <button style={{ ...styles.startBtn, background: "linear-gradient(135deg, #f87171, #ef4444)" }} onClick={() => alert("Selesai! Seluruh sesi latihan berhasil disimpan.") }>
              Save &amp; Finish All
            </button>
          </>
        ) : (
          <>
            <button style={styles.cancelBtn} onClick={() => setPage(PAGES.INTRO)}> Cancel </button>
            {page === PAGES.INTRO ? (
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

function IntroPage() {
  return (
    <div style={styles.chat}>
      <div style={styles.lexaBubbleWrap}>
        <LexaAvatar />
        <div>
          <div style={styles.lexaName}>Lexa – AI Coach</div>
          <div style={styles.lexaBubble}> Hello! Before we start the practice session, let&apos;s give you a nice understanding about this <strong>introduction and interview</strong> system first! </div>
        </div>
      </div>
      <div style={styles.contentAlign}>
        <p style={styles.instructionLabel}>Please carefully read the instructions below before proceed the practice session</p>
        <div style={styles.infoCard}><span style={styles.infoIcon}>i</span> <span>I will include <strong>2 speaking topics</strong> with <strong>4 question</strong> for each topic, so <strong>8 questions in total.</strong></span></div>
        <div style={styles.warningCard}><span style={styles.infoIcon}>i</span> <span>You will have to speak for the total of <strong>4–5 minutes</strong> for 8 questions.</span></div>
        <div style={styles.tipCard}><span style={styles.infoIcon}>i</span> <span>Tips: Keep your answers reasonable while treating it like a casual conversation.</span></div>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 0 }}><PulseRing color="#ef4444" size={220} /></div>
      </div>
    </div>
  );
}

function IntroPagePart2() {
  return (
    <div style={styles.chat}>
      <div style={styles.lexaBubbleWrap}>
        <LexaAvatar />
        <div>
          <div style={styles.lexaName}>Lexa – AI Coach</div>
          <div style={styles.lexaBubble}> Hello, again! Before we start the practice session, let’s give you a nice understanding about this <strong>individual long turn system</strong> first! </div>
        </div>
      </div>
      <div style={styles.contentAlign}>
        <p style={styles.instructionLabel}>Please carefully read the instructions below before proceed the practice session</p>
        <div style={styles.infoCard}><span style={styles.infoIcon}>i</span> <span>I will give you a question based on the chosen unit</span></div>
        <div style={styles.warningCard}><span style={styles.infoIcon}>i</span> <span>The cue card will opens and you get 1 minute to think about what you’re going to say. You can make some notes to help you if you wish.</span></div>
        <div style={styles.warningCard}><span style={styles.infoIcon}>i</span> <span>The cue card will closes and you will got the chance to speak for up to 2 minutes.</span></div>
        <div style={styles.tipCard}><span style={styles.infoIcon}>i</span> <span>Tips: Focus on covering all bullet points clearly and finish with a short summary.</span></div>
      </div>
    </div>
  );
}

function IntroPagePart3({
  topic,
}: {
  topic: Topic | null;
}) {
  const topicTitle = topic?.title ?? "Part 3 Discussion";
  const topicPrompt = topic?.prompt ?? "I will ask you some follow-up questions related to this topic.";

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
        <div style={styles.infoCard}><span style={styles.infoIcon}>i</span> <span>{topicPrompt}</span></div>
        <div style={styles.warningCard}><span style={styles.infoIcon}>i</span> <span>You will have to speak for the total of <strong>4–5 minutes</strong> for this part.</span></div>
        <div style={styles.tipCard}><span style={styles.infoIcon}>i</span> <span>Tips: Be natural and keep answers concise but informative.</span></div>
      </div>
    </div>
  );
}

function SessionPage({ messages, isRecording, setIsRecording, recError, setRecError, transcript, setTranscript, liveTranscript, setLiveTranscript, interimTranscript, setInterimTranscript }: SessionPageProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isStoppingRef = useRef(false);
  
  const startRecording = async () => {
    setRecError(null);
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
      } catch {}
      recognitionRef.current = null;
      isStoppingRef.current = false;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalResult = "";
      let interimResult = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalResult += event.results[i][0].transcript + " ";
        else interimResult += event.results[i][0].transcript;
      }
      
      if (finalResult) {
        setTranscript((prev) => {
          const updated = prev + finalResult;
          setLiveTranscript(updated + interimResult);
          return updated;
        });
      } else {
        setLiveTranscript(transcript + interimResult);
      }
      setInterimTranscript(interimResult);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEventLike) => {
      // Abaikan error 'aborted' yang di-trigger saat menghentikan/abort
      if (e.error === "aborted") return;
      if (e.error !== "no-speech") setRecError(`Error: ${e.error}`);
    };

    recognition.onend = () => {
      // Jika tidak sedang berhenti sengaja, coba restart agar continuous listening tetap bekerja.
      if (recognitionRef.current && !isStoppingRef.current) {
        try { recognition.start(); } catch {}
      } else {
        setIsRecording(false);
      }
    };

    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      try {
        isStoppingRef.current = true;
        recognitionRef.current.abort();
      } catch (err) { console.log(err); }
      recognitionRef.current = null;
      isStoppingRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { isStoppingRef.current = true; recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
        isStoppingRef.current = false;
        setIsRecording(false);
      }
    };
  }, [setIsRecording]);

  return (
    <div style={styles.chat}>
      {messages.map((m, i) => (
        <div key={i} style={styles.lexaBubbleWrap}>
          <LexaAvatar />
          <div>
            <div style={styles.lexaName}>Lexa – AI Coach</div>
            <div style={styles.lexaBubble}>{m.text}</div>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: "100%", marginTop: 24, paddingRight: 20, boxSizing: "border-box", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={styles.userAvatar}>D</div>
          <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>davinzata</span>
        </div>
        <div style={{ ...styles.listeningCard, width: "100%", maxWidth: "450px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <button onClick={() => isRecording ? stopRecording() : startRecording()} style={{ ...styles.recordBtn, background: isRecording ? "#fff" : "rgba(255,255,255,0.2)", color: isRecording ? "#ef4444" : "#fff" }}> ● </button>
            <span style={{ fontSize: 14, color: "#fff", fontWeight: 500 }}>{isRecording ? "Listening..." : "Click microphone to talk"}</span>
          </div>
          <div style={styles.transcriptBox}>
            <span style={{ fontSize: 12, color: "#C95B5B", fontWeight: 600 }}>Live Audio Transcription</span>
            <p style={{ fontSize: 15, color: "#374151", margin: "6px 0 0 0" }}>{recError || liveTranscript || transcript || interimTranscript || "Start speaking..."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionPagePart2({ isRecording, setIsRecording, transcript, setTranscript, liveTranscript, setLiveTranscript, interimTranscript, setInterimTranscript, recError, setRecError }: SessionPagePart2Props) {
  const recognitionRef = useRef<any>(null);
  const [isFlipped, setIsFlipped] = useState(false);

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
      try { recognitionRef.current.abort(); } catch {}
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
              {/* Balon peringatan orange sesuai mockup kedua */}
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
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#f87171" }}>Topic 1 – Memorable Event</span>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#166534" }}>Cue Card Open</span>
            </div>

            <h2 style={{ fontSize: "28px", fontWeight: 500, color: "#000000", margin: "0 0 24px 0", lineHeight: 1.3 }}>
              Describe something you own which is very important to you.
            </h2>

            <span style={{ fontSize: "12px", fontWeight: 700, color: "#C95B5B", display: "block", marginBottom: "16px", letterSpacing: "0.05em" }}>
              YOU SHOULD SAY:
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-start" }}>
              {[
                "Where you got it from",
                "How long you have had it",
                "What you used it for",
                "Explain why it is so important to you"
              ].map((text, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "20px", padding: "6px 16px", color: "#C95B5B", fontSize: "14px", fontWeight: "500" }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #C95B5B", borderRadius: "50%", width: "16px", height: "16px", fontSize: "11px", fontWeight: "700" }}>
                    {idx + 1}
                  </span>
                  {text}
                </div>
              ))}
            </div>
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
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
              </div>
            </div>

            {/* Box Audio Transcription Internal di Sisi Bawah Kartu */}
            <div 
              onClick={(e) => e.stopPropagation()} // Supaya saat blok teks diseleksi, kartu tidak berputar kembali
              style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", minHeight: "120px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", color: "#6b7280", fontSize: "14px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span style={{ fontWeight: "600" }}>Audio Transcription</span>
              </div>
              <p style={{ fontSize: "15px", color: "#111827", margin: 0, lineHeight: 1.5 }}>
                {recError || liveTranscript || transcript || interimTranscript || "Start speaking..."}
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

function ResultPage({ transcript }: ResultPageProps) {
  const scoreData: ScoreData = {
    overall: "9.0",
    metrics: [
      { id: "fluency", label: "Fluency", score: "9.0", text: "Excellent speech flow with natural pauses." },
      { id: "vocabulary", label: "Vocabulary", score: "9.0", text: "Rich and idiomatic vocabulary used accurately." },
      { id: "grammar", label: "Grammar", score: "9.0", text: "Complex sentence structures with zero errors." },
      { id: "pronunciation", label: "Pronunciation", score: "9.0", text: "Clear pronunciation and perfect intonation." },
    ],
    recommendation: "Maintain your consistency and try speaking on varied abstract topics to secure this band score."
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", paddingBottom: "20px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>davinzata</span>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#fecaca", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold" }}>D</div>
        </div>
        <div style={{ background: "#C95B5B", color: "#fff", borderRadius: "12px 12px 0px 12px", padding: "12px 18px", fontSize: "14px", maxWidth: "600px", lineHeight: 1.5 }}>
          {/* PERBAIKAN 5: Teks tiruan "Work each year..." SUDAH DIHAPUS BERSIH */}
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
      <div style={{ background: "#ffffff", border: "1px solid #f3f4f6", borderRadius: "16px", padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,0.02)", position: "relative", width: "calc(100% - 44px)", marginLeft: "44px", boxSizing: "border-box" }}>
        <div style={{ position: "absolute", top: "32px", right: "32px", color: "#C95B5B", border: "1.5px solid #C95B5B", borderRadius: "50%", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold" }}>i</div>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#C95B5B", margin: "0 0 16px 0" }}>AI Coach Analysis</h3>
        <div style={{ fontSize: "56px", fontWeight: 800, color: "#C95B5B", lineHeight: 1, marginBottom: "24px" }}>{scoreData.overall}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", marginBottom: "24px" }}>
          {scoreData.metrics.map((m) => (
            <div key={m.id} style={{ background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#166534" }}>
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#166534" }}>{m.label} {m.score}</span>
              </div>
              <p style={{ fontSize: "13px", color: "#166534", margin: 0, lineHeight: 1.4, fontWeight: "500" }}>{m.text}</p>
            </div>
          ))}
        </div>
        <div>
          <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#C95B5B", margin: "0 0 8px 0" }}>Recommendation</h4>
          <p style={{ fontSize: "13px", color: "#111827", margin: 0, lineHeight: 1.5 }}>{scoreData.recommendation}</p>
        </div>
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
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  timerBadge: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 20 },
  main: { flex: 1, padding: "24px 28px", overflowY: "auto", position: "relative" },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px", borderTop: "1px solid #f3f4f6" },
  cancelBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6b7280", fontWeight: 500 },
  startBtn: { background: "linear-gradient(135deg, #f87171, #ef4444)", color: "#fff", border: "none", borderRadius: 24, padding: "10px 28px", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 14px rgba(239,68,68,0.35)" },
  chat: { display: "flex", flexDirection: "column", gap: 12, width: "100%" },
  lexaBubbleWrap: { display: "flex", alignItems: "flex-start", gap: 10 },
  lexaAvatar: { width: 40, height: 40, borderRadius: "100%", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1.5px solid #f5f5f5" },
  lexaName: { fontSize: 16, fontWeight: 700, color: "#C95B5B", marginBottom: 4 },
  lexaBubble: { background: "#ffffff", border: "1px solid #f3f4f6", borderRadius: "0 12px 12px 12px", padding: "10px 14px", fontSize: "16px", fontWeight: "500", color: "#000000", lineHeight: 1.6, maxWidth: "642px" },
  contentAlign: { marginLeft: 50, maxWidth: "642px", position: "relative" },
  instructionLabel: { fontSize: 14, color: "#6b7280", margin: "8px 0 12px 0" },
  infoCard: { display: "flex", alignItems: "flex-start", gap: 10, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#374151", marginBottom: "12px" },
  warningCard: { display: "flex", alignItems: "flex-start", gap: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#92400e", marginBottom: "12px" },
  tipCard: { display: "flex", alignItems: "flex-start", gap: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#166534", marginBottom: "12px" },
  userAvatar: { width: 24, height: 24, borderRadius: "50%", background: "#fecaca", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold" },
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