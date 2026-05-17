"use client";

import { useEffect, useRef, useState } from "react";
import { AIChatBubble } from "@/components/ui/system/AIChatBubble";
import { CueCard } from "@/components/ui/system/CueCard";
import { RecordingCard } from "@/components/ui/system/RecordingCard";
import IconButton from "@/components/ui/system/IconButton";
import { TimerChip } from "@/components/ui/system/TimerChip";
import { ArrowLeft, ArrowRight, ArrowCircleLeft, ClosedCaptioning as Subtitles } from "phosphor-react";
import { Timer } from "lucide-react";
import type { Topic } from "@/lib/question-fetcher";
import { getQuestionsFromTopic } from "@/lib/question-fetcher";

type Part1SpeakingProps = {
  topics: Topic[];
  onBack?: () => void;
  onComplete?: () => void;
};

type SpeakingState = "intro" | "recording" | "playing";

export function Part1Speaking({ topics, onBack, onComplete }: Part1SpeakingProps) {
  const [state, setState] = useState<SpeakingState>("intro");
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedTranscript, setRecordedTranscript] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Get current topic and questions
  const currentTopic = topics[currentTopicIndex];
  const questions = getQuestionsFromTopic(currentTopic);
  const currentQuestion = questions[currentQuestionIndex];

  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isLastTopic = currentTopicIndex === topics.length - 1;

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "en-US";

        recognitionRef.current.onstart = () => {
          setIsRecording(true);
          setRecordedTranscript("");
        };

        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              setRecordedTranscript((prev) => prev + " " + transcript);
            } else {
              interimTranscript += transcript;
            }
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Timer for elapsed time
  useEffect(() => {
    if (isRecording && state === "recording") {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, state]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

      setState("recording");
      setElapsedTime(0);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Tidak bisa akses microphone. Pastikan permission diberikan.");
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    setIsRecording(false);
    setState("playing");
  };

  const goToNextQuestion = () => {
    if (isLastQuestion) {
      if (isLastTopic) {
        // All done
        onComplete?.();
      } else {
        // Next topic
        setCurrentTopicIndex((prev) => prev + 1);
        setCurrentQuestionIndex(0);
        setState("intro");
        setRecordedTranscript("");
      }
    } else {
      // Next question
      setCurrentQuestionIndex((prev) => prev + 1);
      setState("intro");
      setRecordedTranscript("");
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      setState("intro");
      setRecordedTranscript("");
    } else if (currentTopicIndex > 0) {
      const prevTopic = topics[currentTopicIndex - 1];
      const prevQuestions = getQuestionsFromTopic(prevTopic);
      setCurrentTopicIndex((prev) => prev - 1);
      setCurrentQuestionIndex(prevQuestions.length - 1);
      setState("intro");
      setRecordedTranscript("");
    }
  };

  return (
    <div className="min-h-screen p-6">
      {/* Background blur */}
      <div className="relative">
        <img
          className="w-96 h-96 blur-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/20"
          src="/logo.png"
          alt="background"
        />
      </div>

      {/* Header */}
      <div className="flex w-full justify-between items-center mb-6 relative z-10">
        <div className="inline-flex justify-start items-center gap-6">
          <IconButton variant="base" icon={ArrowLeft} onClick={onBack} />
          <h2 className="text-center justify-start text-black text-lg font-bold">
            Practice Part 1 - {currentTopic?.title}
          </h2>
        </div>
        <div className="inline-flex gap-6">
          <IconButton variant="toggled" icon={Subtitles} />
          <TimerChip icon={Timer} time={formatTime(elapsedTime)} className="bg-white/50" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col w-full py-6 px-32 gap-6 -z-40">
        {state === "intro" && (
          <>
            <div className="max-w-[690px] flex flex-col justify-start gap-2">
              <AIChatBubble
                variant="subtitle"
                message={`Now let's practice: ${currentTopic?.title}`}
              />
            </div>

            {/* Question display */}
            <CueCard
              variant="open"
              topic={currentTopic?.title}
              status={`Q${currentQuestionIndex + 1}/${questions.length}`}
              question={currentQuestion}
              items={[]}
            />

            {/* Start button */}
            <div className="flex gap-3">
              {currentQuestionIndex > 0 || currentTopicIndex > 0 ? (
                  <button
                  onClick={goToPreviousQuestion}
                  className="px-6 py-3 bg-white/50 hover:bg-white/70 text-primary font-medium rounded-lg flex items-center gap-2"
                >
                  <ArrowCircleLeft size={20} />
                  Previous
                </button>
              ) : null}
              <button
                onClick={startRecording}
                className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg"
              >
                Start Recording
              </button>
            </div>
          </>
        )}

        {state === "recording" && (
          <>
            <RecordingCard
              coachName="AI Coach"
              studentName="You"
              coachTranscription={currentQuestion}
              studentTranscription={recordedTranscript || "Listening..."}
            />

            {/* Stop button */}
            <button
              onClick={stopRecording}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg w-fit"
            >
              Stop Recording
            </button>
          </>
        )}

        {state === "playing" && (
          <>
            <RecordingCard
              coachName="AI Coach"
              studentName="You"
              coachTranscription={currentQuestion}
              studentTranscription={recordedTranscript}
            />

            {/* Navigation buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setState("intro")}
                className="px-8 py-3 bg-white/50 hover:bg-white/70 text-primary font-medium rounded-lg"
              >
                Re-record
              </button>

              <button
                onClick={goToNextQuestion}
                className="px-8 py-3 bg-primary hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-2"
              >
                {isLastQuestion && isLastTopic ? "Complete" : "Next"}
                <ArrowRight size={20} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
