"use client";

import { useEffect, useState } from "react";
import { AlertCard } from "@/components/ui/system/AlertCard";
import { InfoIcon} from "@phosphor-icons/react";
import { ElementType } from "react";
import { Modal } from "@/components/ui/modal";

type Metric = {
    label: string;
    score: string;
    description: string;
    icon?: ElementType;
};

type PartBreakdown = {
    label: string;
    score: string;
    description?: string;
    evaluation?: string;
    components?: Metric[];
};

type AnalysisCardProps = {
    title: string;
    overallScore: string;
    level: string;
    metrics: Metric[];
    recommendation?: string;
    partBreakdown?: PartBreakdown[];
    className?: string;
};

export function AnalysisCard({
    title,
    overallScore,
    level,
    metrics,
    recommendation,
    partBreakdown,
    className = "",
}: AnalysisCardProps) {
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [detailTab, setDetailTab] = useState<"komponen" | "perPart">("komponen");
    const [selectedPartIndex, setSelectedPartIndex] = useState(0);

    const hasPartBreakdown = Boolean(partBreakdown && partBreakdown.length > 0);

    const activePart = hasPartBreakdown ? partBreakdown![selectedPartIndex] ?? partBreakdown![0] : undefined;

    useEffect(() => {
        if (!hasPartBreakdown) {
            setSelectedPartIndex(0);
            return;
        }

        setSelectedPartIndex((current) => Math.min(current, (partBreakdown?.length ?? 1) - 1));
    }, [hasPartBreakdown, partBreakdown]);

    const openDetail = () => {
        setDetailTab("komponen");
        setSelectedPartIndex(0);
        setIsDetailOpen(true);
    };

    return (
        <>
            <div
                className={`w-full max-w-[800px] p-8 bg-white/50 backdrop-blur-sm rounded-2xl shadow-[1px_2px_12px_0px_rgba(217,217,217,0.50)] outline outline-1 outline-white flex flex-col gap-6 ${className}`}
            >
                {/* Header */}
                <div className="w-full inline-flex justify-between items-center gap-3">
                    <span className="bg-linear-to-r from-secondary to-primary bg-clip-text text-transparent text-base font-bold">
                        {title}
                    </span>
                    <button
                        type="button"
                        onClick={openDetail}
                        className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-sm transition-colors hover:bg-primary/5"
                    >
                        <InfoIcon size={18} weight="regular" className="text-primary" />
                        Detail
                    </button>
                </div>

                {/* Score */}
                <h1 className="w-fit bg-linear-to-r from-secondary to-primary bg-clip-text text-transparent text-5xl font-bold">
                    {overallScore} - {level}
                </h1>

                {/* Metrics */}
                <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {metrics.map((item, index) => (
                            <AlertCard
                                key={index}
                                icon={item.icon}
                                title={`${item.label} ${item.score}`}
                                description={item.description}
                                variant="success"
                                className="w-full"
                            />
                        ))}
                    </div>
                </div>

                {/* Recommendation */}
                {recommendation && (
                    <div className="w-fit">
                        <span className="bg-linear-to-r from-secondary to-primary bg-clip-text text-transparent text-base font-bold">
                            Recommendation
                        </span>

                        <p className="text-black text-base font-medium">
                            {recommendation}
                        </p>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                className="mx-4 max-w-3xl p-0 shadow-[0_24px_80px_rgba(15,23,42,0.25)]"
            >
                <div className="rounded-3xl bg-white p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Score Detail</p>
                            <h2 className="mt-2 text-2xl font-bold text-gray-900">{title}</h2>
                        </div>
                    </div>

                    <div className="mt-5 inline-flex rounded-full bg-gray-100 p-1">
                        <button
                            type="button"
                            onClick={() => setDetailTab("komponen")}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${detailTab === "komponen" ? "bg-white text-primary shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                        >
                            Komponen
                        </button>
                        <button
                            type="button"
                            onClick={() => setDetailTab("perPart")}
                            disabled={!hasPartBreakdown}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${detailTab === "perPart" ? "bg-white text-primary shadow-sm" : "text-gray-600 hover:text-gray-900"} ${!hasPartBreakdown ? "cursor-not-allowed opacity-40 hover:text-gray-600" : ""}`}
                        >
                            Per Part
                        </button>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Overall Score</p>
                            <p className="mt-2 text-3xl font-bold text-gray-900">{overallScore}</p>
                            <p className="mt-1 text-sm text-gray-600">{level}</p>
                        </div>
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 md:col-span-2">
                            <p className="text-xs uppercase tracking-wide text-gray-500">What is included</p>
                            <p className="mt-2 text-sm leading-6 text-gray-700">
                                The score above is calculated from the component breakdown below. Use this view to inspect the exact contribution of each speaking dimension or each part when available.
                            </p>
                        </div>
                    </div>

                    {detailTab === "komponen" && (
                        <div className="mt-6 rounded-2xl border border-gray-200 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">Component Breakdown</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-500">Lexical / Grammar / Pronunciation / Fluency</p>
                                </div>
                                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                    {metrics.length} components
                                </span>
                            </div>
                            <div className="mt-4 space-y-3">
                                {metrics.map((item) => (
                                    <div key={`${item.label}-${item.score}`} className="rounded-xl bg-gray-50 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-medium text-gray-700">{item.label}</span>
                                            <span className="text-sm font-bold text-gray-900">{item.score}</span>
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-gray-600">{item.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {detailTab === "perPart" && (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="mt-4 text-sm font-semibold text-gray-900">Per Part Calculation</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-500">Final score is the average of the visible parts below</p>
                                </div>
                                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                    {partBreakdown?.length ?? 0} parts
                                </span>
                            </div>

                            {hasPartBreakdown ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {partBreakdown?.map((part, index) => (
                                        <button
                                            key={`${part.label}-${index}`}
                                            type="button"
                                            onClick={() => setSelectedPartIndex(index)}
                                            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${selectedPartIndex === index ? "bg-primary text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                                        >
                                            {part.label}
                                        </button>
                                    ))}
                                </div>
                            ) : null}

                            <div className="mt-4 space-y-3">
                                {activePart ? (
                                    <div key={`${activePart.label}-${activePart.score}`} className="rounded-xl bg-gray-50 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-medium text-gray-700">{activePart.label}</span>
                                            <span className="text-sm font-bold text-gray-900">{activePart.score}</span>
                                        </div>
                                        {activePart.description ? <p className="mt-2 text-sm leading-6 text-gray-600">{activePart.description}</p> : null}
                                        {activePart.evaluation ? <p className="mt-2 text-sm leading-6 text-gray-800">{activePart.evaluation}</p> : null}

                                        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Component Scores</p>

                                            <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-4">
                                                {(() => {
                                                    const labels = ["Lexical", "Grammar", "Pronunciation", "Fluency"];
                                                    const comps: Metric[] = activePart.components ?? [];

                                                    const findByKeywords = (keys: string[]) => {
                                                        for (const k of keys) {
                                                            const found = comps.find((c) => {
                                                                const lab = (c.label || "").toLowerCase();
                                                                return lab.includes(k);
                                                            });
                                                            if (found) return found as any;
                                                        }
                                                        return undefined;
                                                    };

                                                    const keywordMap: Record<string, string[]> = {
                                                        Lexical: ["lex"],
                                                        Grammar: ["gram"],
                                                        Pronunciation: ["pron", "pronun", "pronunci"],
                                                        Fluency: ["flu", "flow"],
                                                    };

                                                    if (comps.length === 0) {
                                                        return (
                                                            <div className="sm:col-span-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 flex items-center justify-between gap-4">
                                                                <div>
                                                                    <p className="text-sm font-semibold text-gray-700">Component scores not available</p>
                                                                    <p className="mt-1 text-sm text-gray-500">This part was saved without detailed component metrics. The overall part score is shown instead.</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-xs uppercase tracking-wide text-gray-500">Part Score</p>
                                                                    <p className="mt-2 text-3xl font-extrabold text-gray-900">{activePart.score ?? "—"}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    return labels.map((label) => {
                                                        const comp = findByKeywords(keywordMap[label] || [label.toLowerCase()]);
                                                        const score = comp?.score ?? comp?.value ?? "—";
                                                        return (
                                                            <div key={`${activePart.label}-${label}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-5 flex flex-col justify-between h-full">
                                                                <div>
                                                                    <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
                                                                    <p className="mt-3 text-2xl font-extrabold text-gray-900">{score}</p>
                                                                </div>
                                                                {comp?.description ? <p className="mt-3 text-sm text-gray-600">{comp.description}</p> : null}
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                                        No per-part breakdown available for this result.
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {recommendation && (
                        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Recommendation</p>
                            <p className="mt-2 text-sm leading-6 text-emerald-950">{recommendation}</p>
                        </div>
                    )}
                </div>
            </Modal>
        </>
    );
}