"use client";

import { useEffect, useState } from "react";
import {
    getAdminSummary,
    getActivityTrend,
    getScoreTrend,
} from "@/lib/reports";
import { Chart } from "./Chart";
import { exportToExcel } from "@/lib/exportExcel";
import { exportToPDF } from "@/lib/exportPdf";

type ReportProps = {
    pageTitle: string;
    description?: string;
};

export default function Report({ pageTitle, description }: ReportProps) {
    const [summary, setSummary] = useState<any>(null);
    const [activity, setActivity] = useState<any[]>([]);
    const [scores, setScores] = useState<any[]>([]);

    useEffect(() => {
        (async () => {
            setSummary(await getAdminSummary());
            setActivity(await getActivityTrend());
            setScores(await getScoreTrend());
        })();
    }, []);

    const handleExportExcel = () => {
        const combined = [
            ...activity.map((a) => ({
                type: "activity",
                date: a.date,
                value: a.count,
            })),
            ...scores.map((s) => ({
                type: "score",
                date: s.date,
                value: s.avg,
            })),
        ];

        exportToExcel(combined);
    };

    return (
        <div id="report-root" className="flex flex-col gap-6">

            {/* HEADER */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">{pageTitle}</h1>

                    <div className="flex gap-2">
                        <button
                            onClick={handleExportExcel}
                            className="px-3 py-2 rounded-lg bg-green-500 text-white text-sm"
                        >
                            Export Excel
                        </button>

                        <button
                            onClick={() =>
                                exportToPDF({
                                    summary,
                                    activity,
                                    scores,
                                })
                            }
                            className="px-3 py-2 rounded-lg bg-red-500 text-white text-sm"
                        >
                            Export PDF
                        </button>
                    </div>
                </div>

                {description && (
                    <p className="text-sm text-gray-500">{description}</p>
                )}
            </div>

            {/* SUMMARY */}
            <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-xs uppercase text-gray-500">Total Users</p>
                    <p className="mt-2 text-2xl font-bold">
                        {summary?.totalUsers ?? "-"}
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-xs uppercase text-gray-500">Total Attempts</p>
                    <p className="mt-2 text-2xl font-bold">
                        {summary?.totalAttempts ?? "-"}
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-xs uppercase text-gray-500">Average Score</p>
                    <p className="mt-2 text-2xl font-bold">
                        {summary?.avgScore ?? "-"}
                    </p>
                </div>
            </div>

            {/* CHARTS */}
            <Chart title="Activity" data={activity} dataKey="count" />
            <Chart title="Score Trend" data={scores} dataKey="avg" />

        </div>
    );
}