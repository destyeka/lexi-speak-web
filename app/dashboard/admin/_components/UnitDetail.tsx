"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

import TextButton from "@/components/ui/system/TextButton";

import { useRouter } from "next/navigation";

type Props = {
    unitId: string;
};

type TopicDetail = {
    id: string;

    type: "question" | "bullet";

    content: string;

    rubric?: string | null;

    order_index: number;
};

type Topic = {
    id: string;

    part: number;

    title: string;

    prompt: string | null;

    details: TopicDetail[];
};

type SessionUnit = {
    id: string;

    session_code: string;

    title: string;

    description: string | null;

    type: "practice" | "test";

    category: string;

    access_level: "free" | "premium";

    is_active: boolean;
};

export default function UnitDetail({
    unitId,
}: Props) {

    const router = useRouter();

    const [loading, setLoading] =
        useState(true);

    const [session, setSession] =
        useState<SessionUnit | null>(
            null
        );

    const [topics, setTopics] =
        useState<Topic[]>([]);

    useEffect(() => {

        const loadData =
            async () => {

                setLoading(true);

                // 🔥 SESSION
                const {
                    data: sessionData,
                } = await supabase
                    .from("session_units")
                    .select("*")
                    .eq("id", unitId)
                    .single();

                if (!sessionData) {
                    setLoading(false);
                    return;
                }

                setSession(sessionData);

                // 🔥 TOPICS
                const {
                    data: topicsData,
                } = await supabase
                    .from("topics")
                    .select("*")
                    .eq("unit_id", unitId)
                    .order("part");

                if (!topicsData) {
                    setLoading(false);
                    return;
                }

                const formattedTopics =
                    [];

                for (const topic of topicsData) {

                    const {
                        data: detailsData,
                    } = await supabase
                        .from("topic_details")
                        .select("*")
                        .eq("topic_id", topic.id)
                        .order("order_index");

                    formattedTopics.push({
                        ...topic,

                        details:
                            detailsData || [],
                    });
                }

                setTopics(formattedTopics);

                setLoading(false);
            };

        loadData();

    }, [unitId]);

    return (

        <div className="grid grid-cols-12 gap-6 min-h-screen">

            {/* LEFT */}
            <div className="col-span-4">

                <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">

                    {loading || !session ? (

                        <p className="text-sm text-gray-500">
                            Loading...
                        </p>

                    ) : (

                        <>
                            {/* HEADER */}
                            <div className="mb-6">

                                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    {session.session_code}
                                </p>

                                <h1 className="mt-2 text-2xl font-bold text-gray-800 dark:text-white">
                                    {session.title}
                                </h1>

                                {session.description && (
                                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                                        {session.description}
                                    </p>
                                )}
                            </div>

                            {/* BADGES */}
                            <div className="mb-6 flex flex-wrap gap-2">

                                {/* TYPE */}
                                <span
                                    className={`
            inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase

            ${session.type === "practice"
                                            ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400"
                                        }
          `}
                                >
                                    {session.type}
                                </span>

                                {/* ACCESS */}
                                <span
                                    className={`
            inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase

            ${session.access_level === "premium"
                                            ? "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400"
                                            : "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                                        }
          `}
                                >
                                    {session.access_level}
                                </span>

                                {/* STATUS */}
                                <span
                                    className={`
            inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase

            ${session.is_active
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                            : "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                                        }
          `}
                                >
                                    {session.is_active
                                        ? "Active"
                                        : "Inactive"}
                                </span>

                            </div>

                            {/* META */}
                            <div className="space-y-4">

                                <div>
                                    <p className="text-xs uppercase text-gray-400">
                                        Category
                                    </p>

                                    <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                                        {session.category}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs uppercase text-gray-400">
                                        Total Parts
                                    </p>

                                    <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                                        3 Parts
                                    </p>
                                </div>

                            </div>

                            {/* ACTIONS */}
                            <div className="mt-8 flex gap-3">

                                <TextButton
                                    className="flex-1"
                                    variant="secondary"
                                    onClick={() =>
                                        router.push(
                                            "/dashboard/admin/question-bank"
                                        )
                                    }
                                >
                                    Back
                                </TextButton>

                                <TextButton
                                    className="flex-1"
                                    variant="primary"
                                    onClick={() =>
                                        router.push(
                                            `/dashboard/admin/question-bank/${unitId}/edit`
                                        )
                                    }
                                >
                                    Edit
                                </TextButton>

                            </div>
                        </>

                    )}

                </div>

            </div>

            {/* RIGHT */}
            <div className="col-span-8">

                <div className="flex flex-col gap-6">

                    {loading ? (

                        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
                            <p className="text-sm text-gray-500">
                                Loading session...
                            </p>
                        </div>

                    ) : (

                        topics.map((topic) => (

                            <div
                                key={topic.id}
                                className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]"
                            >

                                {/* PART HEADER */}
                                <div className="mb-6">

                                    <div className="flex items-center gap-3">

                                        <div
                                            className={`
                rounded-xl px-3 py-2 text-sm font-semibold text-primary bg-tertiary
                                                }
              `}
                                        >
                                            Part {topic.part}
                                        </div>

                                        <p className="text-xs uppercase tracking-wide text-gray-400">
                                            IELTS Speaking
                                        </p>

                                    </div>

                                    <h2 className="mt-4 text-2xl font-bold text-gray-800 dark:text-white">
                                        {topic.title}
                                    </h2>

                                    {topic.prompt && (
                                        <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                                            {topic.prompt}
                                        </p>
                                    )}

                                </div>

                                {/* DETAILS */}
                                <div className="space-y-3">

                                    {topic.details.length === 0 ? (

                                        <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400 dark:border-gray-700">
                                            No details available.
                                        </div>

                                    ) : (

                                        topic.details.map(
                                            (detail, index) => (

                                                <div
                                                    key={detail.id}
                                                    className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700"
                                                >

                                                    {/* TOP */}
                                                    <div className="mb-3 flex items-center gap-3">

                                                        {/* NUMBER */}
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-sm font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                                            {index + 1}
                                                        </div>

                                                        {/* TYPE */}
                                                        <div
                                                            className={` flex px-6
                        rounded-xl h-10 justify-center items-center text-xs font-semibold uppercase bg-gray-100 text-sm font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300
                      `}
                                                        >
                                                            {detail.type}
                                                        </div>

                                                    </div>

                                                    {/* CONTENT */}
                                                    <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                                                        {detail.content}
                                                    </p>

                                                    {/* RUBRIC */}
                                                    {detail.rubric && (

                                                        <div className="mt-4 rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.03]">

                                                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                                                AI Rubric
                                                            </p>

                                                            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                                                                {detail.rubric}
                                                            </p>

                                                        </div>

                                                    )}

                                                </div>
                                            )
                                        )

                                    )}

                                </div>

                            </div>
                        ))

                    )}

                </div>

            </div>

        </div>
    );
}