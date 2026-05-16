"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AIChatBubble } from "@/components/ui/system/AIChatBubble";
import { AlertCard } from "@/components/ui/system/AlertCard";
import IconButton from "@/components/ui/system/IconButton";
import { TimerChip } from "@/components/ui/system/TimerChip";
import { ArrowLeftIcon, InfoIcon, NumberCircleOneIcon, NumberCircleTwoIcon, SubtitlesIcon } from "@phosphor-icons/react";
import { Timer } from "lucide-react";
import { Part1Speaking } from "@/components/Part1Speaking";
import { getRandomTopicsFromPart, type Topic } from "@/lib/question-fetcher";

type SessionPageProps = {
    params: {
        sessionId: string;
    };
};

type SessionState = "intro" | "speaking" | "complete";

export default function SessionPage({ params }: SessionPageProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [state, setState] = useState<SessionState>("intro");
    const [topics, setTopics] = useState<Topic[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch topics on mount
    useEffect(() => {
        const fetchTopics = async () => {
            try {
                setIsLoading(true);
                // Default to Part 1, can be extended to support other parts
                const part = searchParams.get("part") ? parseInt(searchParams.get("part")!) : 1;
                const topicCount = searchParams.get("count") ? parseInt(searchParams.get("count")!) : 2;
                
                const fetchedTopics = await getRandomTopicsFromPart(part, topicCount);
                setTopics(fetchedTopics);
            } catch (error) {
                console.error("Error fetching topics:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTopics();
    }, [searchParams]);

    const handleStartSession = () => {
        setState("speaking");
    };

    const handleBack = () => {
        router.back();
    };

    const handleComplete = () => {
        setState("complete");
        // Can redirect or show completion screen here
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading speaking topics...</p>
                </div>
            </div>
        );
    }

    if (state === "speaking" && topics.length > 0) {
        return (
            <Part1Speaking
                topics={topics}
                onBack={handleBack}
                onComplete={handleComplete}
            />
        );
    }

    if (state === "complete") {
        return (
            <div className="min-h-screen p-6 flex flex-col items-center justify-center">
                <div className="relative mb-8">
                    <img className="w-96 h-96 blur-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/20" src="/logo.png" />
                </div>
                <div className="max-w-[600px] text-center">
                    <h2 className="text-4xl font-bold text-black mb-6">Session Complete! 🎉</h2>
                    <p className="text-lg text-gray-600 mb-8">Great job! Your speaking session has been recorded and analyzed.</p>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="px-8 py-3 bg-primary hover:bg-blue-700 text-white font-bold rounded-lg"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Intro state
    return (
        <div className="min-h-screen p-6">
            <div className="relative">
                <img className="w-96 h-96 blur-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/20" src="/logo.png" />
            </div>
            <div className="flex w-full justify-between items-center">
                <div className="inline-flex justify-start items-center gap-6">

                    <IconButton variant="base" icon={ArrowLeftIcon} onClick={handleBack} />
                    <h2 className="text-center justify-start text-black text-lg font-bold">Practice Unit 1 - Part 1 (Introduction)</h2>

                </div>
                <div className="inline-flex gap-6">
                    <IconButton variant="toggled" icon={SubtitlesIcon} />
                    <TimerChip icon={Timer} time="00:00:00" className="bg-white/50" />
                </div>
            </div>
            <div className="flex flex-col w-full py-6 px-32 gap-4 -z-40">
                <div className="max-w-[690px] flex flex-col justify-start gap-2">
                    <AIChatBubble variant="subtitle" message="Hello! Before we start the practice session, let's give you a nice understanding about this introduction and interview system first!" />
                    <AIChatBubble variant="subtitle" message="Please carefully read the instructions below before proceed the practice session." />
                </div>
                <div className="px-4 inline-flex flex-col justify-start items-start gap-3">
                    <AlertCard variant="text" icon={NumberCircleOneIcon} description={`I will include ${topics.length} speaking topics with multiple questions for each topic.`} />
                    <AlertCard variant="warning" icon={NumberCircleTwoIcon} description="You will have to speak for the total of 4-5 minutes for all questions." />
                    <AlertCard variant="success" icon={InfoIcon} description="Tips: Keep your answers natural & casual. Speak clearly and answer the questions directly." />
                </div>

                {/* Start button */}
                <div className="mt-6 flex gap-4">
                    <button
                        onClick={handleStartSession}
                        className="px-8 py-3 bg-primary hover:bg-blue-700 text-white font-bold rounded-lg"
                    >
                        Start Speaking Now
                    </button>
                </div>
            </div>
        </div>
    );
}
