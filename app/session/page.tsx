"use client";

import { AIChatBubble } from "@/components/ui/system/AIChatBubble";
import { AlertCard } from "@/components/ui/system/AlertCard";
import IconButton from "@/components/ui/system/IconButton";
import { TimerChip } from "@/components/ui/system/TimerChip";
import { ArrowLeftIcon, InfoIcon, NumberCircleOneIcon, NumberCircleTwoIcon, SubtitlesIcon } from "@phosphor-icons/react";
import { Timer } from "lucide-react";

type SessionPageProps = {
    params: {
        sessionId: string;
    };
};

export default function SessionPage({ params }: SessionPageProps) {
    return (
        <div className="min-h-screen p-6">
            <div className="relative">
                <img className="w-96 h-96 blur-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/20" src="/logo.png" />
            </div>
            <div className="flex w-full justify-between items-center">
                <div className="inline-flex justify-start items-center gap-6">

                    <IconButton variant="base" icon={ArrowLeftIcon} />
                    <h2 className="text-center justify-start text-black text-lg font-bold">Practice Unit 1 - Part 1 (Introduction)</h2>

                </div>
                <div className="inline-flex gap-6">
                    <IconButton variant="toggled" icon={SubtitlesIcon} />
                    <TimerChip icon={Timer} time="00:00:00" className="bg-white/50" />
                </div>
            </div>
            <div className="flex flex-col w-full py-6 px-32 gap-4 -z-40">
                <div className="max-w-[690px] flex flex-col justify-start gap-2">
                    <AIChatBubble variant="subtitle" message="Hello! Before we start the practice session, let’s give you a nice understanding about this introduction and interview system first!" />
                    <AIChatBubble variant="subtitle" message="Please carefully read the instructions below before proceed the practice session." />
                </div>
                <div className="px-4 inline-flex flex-col justify-start items-start gap-3">
                    <AlertCard variant="text" icon={NumberCircleOneIcon} description="I will include 2 speaking topics with 4 question for each topic, so 8 questions in total." />
                    <AlertCard variant="warning" icon={NumberCircleTwoIcon} description="You will have to speak for the total of 4-5 minutes for 8 questions." />
                    <AlertCard variant="success" icon={InfoIcon} description="Tips: Keep your answers reasonable while treating it like a casual conversation." />
                </div>
            </div>
        </div>
    );
}