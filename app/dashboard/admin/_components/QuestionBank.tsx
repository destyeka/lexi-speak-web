"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import TextButton from "@/components/ui/system/TextButton";
import { InputField } from "@/components/ui/system/InputField";
import { Toggle } from "@/components/ui/system/Toggle";
import {
    NumberCircleOneIcon,
    NumberCircleTwoIcon,
    NumberCircleThreeIcon,
    NumberCircleFourIcon,
    NumberCircleFiveIcon,
    NumberCircleSixIcon,
    NumberCircleSevenIcon,
    NumberCircleEightIcon,
    NumberCircleNineIcon,
    PencilLineIcon,
    TrashIcon,
} from "@phosphor-icons/react";

const numberIcons = [
    NumberCircleOneIcon,
    NumberCircleTwoIcon,
    NumberCircleThreeIcon,
    NumberCircleFourIcon,
    NumberCircleFiveIcon,
    NumberCircleSixIcon,
    NumberCircleSevenIcon,
    NumberCircleEightIcon,
    NumberCircleNineIcon,
];

type Question = {
    id: string;
    topic_code: string;
    title: string;
    part: number;
    prompt: string | null;
    is_active: boolean;
    session: "practice" | "test";
    category: string;
    created_at: string | null;
    seq: number;
    category_code: string;
    unit_id: string;
};

type Unit = {
    id: string;

    session_code: string;

    title: string;

    description: string | null;

    type: "practice" | "test";

    category: string;

    access_level: "free" | "premium";

    is_active: boolean;

    created_at: string | null;
};

type Detail = {
    id?: string;
    type: "question" | "bullet";
    content: string;
    order_index: number;
    rubric?: string | null;
};

type QuestionBankProps = {
    pageTitle: string;
    description: string;
    emptyLabel: string;
    summaryLabel: string;
};

export default function QuestionBank({
    pageTitle,
    description,
    emptyLabel,
    summaryLabel,
}: QuestionBankProps) {
    const router = useRouter();
    const [rows, setRows] = useState<Question[]>([]);
    const [unitRows, setUnitRows] =
        useState<Unit[]>([]);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState("");
    const [isUnauthorized, setIsUnauthorized] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const [activeTab, setActiveTab] =
        useState<"units" | "topics">("units");
    const [pageSize, setPageSize] = useState<5 | 10>(5);
    const [currentPage, setCurrentPage] = useState(1);

    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const selectedTopic = rows.find((r) => r.id === selectedTopicId);

    const [details, setDetails] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [editTopic, setEditTopic] = useState<Question | null>(null);
    const [editSession, setEditSession] = useState<"practice" | "test">("practice");
    const [editCategory, setEditCategory] = useState("");
    const [editTitle, setEditTitle] = useState("");
    const [editPrompt, setEditPrompt] = useState("");
    const [editPart, setEditPart] = useState<number>(1);
    const [editActive, setEditActive] = useState(true);
    const [editDetails, setEditDetails] = useState<Detail[]>([]);

    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const [newPart, setNewPart] = useState<number>(1);
    const [newCategory, setNewCategory] = useState("");
    const [newSession, setNewSession] = useState<"practice" | "test">("practice");
    const [newTitle, setNewTitle] = useState("");
    const [newPrompt, setNewPrompt] = useState("");
    const [newActive, setNewActive] = useState(true);

    const [newDetails, setNewDetails] = useState<
        { type: "question" | "bullet"; content: string; rubric?: string | null }[]
    >([]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setNotice("");
            setIsUnauthorized(false);

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.replace("/login");
                return;
            }

            const { data: me } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .maybeSingle();

            if (me?.role !== "admin") {
                setIsUnauthorized(true);
                setNotice("You are signed in, but your role is not admin.");
                setLoading(false);
                return;
            }

            if (activeTab === "topics") {

                const { data, error } =
                    await supabase
                        .from("topics")
                        .select(`
        id,
        topic_code,
        category,
        session,
        part,
        title,
        prompt,
        is_active,
        created_at,
        unit_id
      `)
                        .order("created_at", {
                            ascending: false,
                        });

                if (error) {
                    setNotice(error.message);
                }

                setRows(
                    (data as Question[] | null) ?? []
                );

            } else {

                const { data, error } =
                    await supabase
                        .from("session_units")
                        .select(`
        id,
        session_code,
        title,
        description,
        type,
        category,
        access_level,
        is_active,
        created_at
      `)
                        .order("created_at", {
                            ascending: false,
                        });

                if (error) {
                    setNotice(error.message);
                }

                setUnitRows(
                    (data as Unit[] | null) ?? []
                );
            }
            setLoading(false);
        };

        void load();
    }, [router, activeTab]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, pageSize]);

    const filteredRows = useMemo(() => {
        const q = searchTerm.toLowerCase();

        return rows.filter((row) =>
            row.prompt?.toLowerCase().includes(q)
        );
    }, [rows, searchTerm]);

    const filteredUnitRows = useMemo(() => {

        const q =
            searchTerm.toLowerCase();

        return unitRows.filter(
            (row) =>
                row.title
                    ?.toLowerCase()
                    .includes(q) ||

                row.session_code
                    ?.toLowerCase()
                    .includes(q)
        );

    }, [unitRows, searchTerm]);

    const totalRows =
        activeTab === "topics"
            ? filteredRows.length
            : filteredUnitRows.length;
    const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
    const safePage = Math.min(currentPage, pageCount);
    const startIndex = (safePage - 1) * pageSize;
    const visibleRows =
        activeTab === "topics"
            ? filteredRows.slice(
                startIndex,
                startIndex + pageSize
            )
            : filteredUnitRows.slice(
                startIndex,
                startIndex + pageSize
            );
    const startLabel = totalRows === 0 ? 0 : startIndex + 1;
    const endLabel = Math.min(startIndex + pageSize, totalRows);

    useEffect(() => {
        if (currentPage > pageCount) {
            setCurrentPage(pageCount);
        }
    }, [currentPage, pageCount]);

    const handleRowClick = async (topicId: string) => {
        setSelectedTopicId(topicId);
        setIsModalOpen(true);

        const { data } = await supabase
            .from("topic_details")
            .select("*")
            .eq("topic_id", topicId)
            .order("order_index");

        setDetails(data || []);
    };

    return (
        <section className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
                <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">{pageTitle}</h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
                {notice ? <p className="mt-3 text-sm text-error-600">{notice}</p> : null}
            </div>

            <div className="flex items-center gap-2">

                <button
                    onClick={() => setActiveTab("units")}
                    className={`
      rounded-2xl px-4 py-2 text-sm font-medium transition

      ${activeTab === "units"
                            ? "bg-[var(--primary)] text-white"
                            : "bg-white text-gray-500 border border-gray-200 dark:bg-white/[0.03] dark:border-gray-800"
                        }
    `}
                >
                    Units
                </button>

                <button
                    onClick={() => setActiveTab("topics")}
                    className={`
      rounded-2xl px-4 py-2 text-sm font-medium transition

      ${activeTab === "topics"
                            ? "bg-[var(--primary)] text-white"
                            : "bg-white text-gray-500 border border-gray-200 dark:bg-white/[0.03] dark:border-gray-800"
                        }
    `}
                >
                    Topics
                </button>

            </div>

            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* LEFT CARD */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">

                        {activeTab === "topics"
                            ? `Total ${summaryLabel}`
                            : "Total Units"}

                    </p>
                    <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-white/90">
                        {totalRows}
                    </p>
                </div>

                {/* RIGHT CARD */}
                <div className="inline-flex justify-between items-center rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        New Unit
                    </p>
                    <TextButton
                        variant="primary"
                        onClick={() => router.push("/dashboard/admin/question-bank/create")}
                    >
                        Create Unit
                    </TextButton>
                </div>

            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                {/* Top Controls Bar */}
                <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                    {/* Search */}
                    <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder={`Search...`}
                        className="w-full sm:w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    />

                    {/* Entries Per Page */}
                    <div className="flex items-center gap-2">
                        <select
                            value={pageSize}
                            onChange={(event) => setPageSize(parseInt(event.target.value) as 5 | 10)}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                        </select>
                        <span className="text-sm text-gray-600 dark:text-gray-400">entries per page</span>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    {isUnauthorized ? (
                        <div className="px-5 py-6 text-sm text-gray-600 dark:text-gray-300">
                            Admin access required. Please set your account role to <span className="font-semibold">admin</span> in Supabase table <span className="font-semibold">profiles</span>.
                        </div>
                    ) : (
                        <table className="min-w-full">
                            <thead>

                                {activeTab === "topics" ? (

                                    <tr className="border-b border-gray-100 dark:border-gray-800">

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Code
                                        </th>

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Category
                                        </th>

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Part
                                        </th>

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Title
                                        </th>

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Prompt
                                        </th>

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Status
                                        </th>

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Created
                                        </th>

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Actions
                                        </th>
                                    </tr>

                                ) : (

                                    <tr className="border-b border-gray-100 dark:border-gray-800">

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Code
                                        </th>

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Type
                                        </th>

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Category
                                        </th>

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Title
                                        </th>

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Access
                                        </th>

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Status
                                        </th>

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Created
                                        </th>

                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                            Actions
                                        </th>
                                    </tr>

                                )}

                            </thead>

                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-4 text-sm text-gray-500">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : visibleRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-4 text-sm text-gray-500">
                                            No data found
                                        </td>
                                    </tr>
                                ) : (
                                    activeTab === "topics" ? (

                                        (visibleRows as Question[]).map((row) => (

                                            <tr
                                                key={row.id}
                                                onClick={() =>
                                                    handleRowClick(row.id)
                                                }
                                                className={`
        cursor-pointer border-b last:border-0
        hover:bg-gray-50 dark:hover:bg-white/5
      `}
                                            >

                                                <td className="px-5 py-4 text-sm font-medium">
                                                    {row.topic_code}
                                                </td>

                                                <td className="px-5 py-4 text-sm font-medium">
                                                    {row.category}
                                                </td>

                                                <td className="px-5 py-4 text-sm font-medium">
                                                    Part {row.part}
                                                </td>

                                                <td className="px-5 py-4 text-sm">
                                                    {row.title || "-"}
                                                </td>

                                                <td className="px-5 py-4 text-sm">
                                                    {row.prompt || "-"}
                                                </td>

                                                <td className="px-5 py-4 text-sm">
                                                    <span className={`
      inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase

      ${row.is_active === true
                                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                                                            : "bg-gray-100 text-gray-500 dark:bg-gray-500/10 dark:text-gray-400"
                                                        }
    `}>
                                                        {row.is_active
                                                            ? "Active"
                                                            : "Inactive"}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-sm text-gray-500">
                                                    {row.created_at
                                                        ? new Date(
                                                            row.created_at
                                                        ).toLocaleDateString()
                                                        : "-"}
                                                </td>

                                                <td className="px-5 py-4 text-sm">
                                                    <div className="flex items-center gap-2">

                                                        {/* EDIT */}
                                                        <button
                                                            onClick={(e) => {

                                                                e.stopPropagation();

                                                                router.push(
                                                                    `/dashboard/admin/question-bank/${row.unit_id}/edit`
                                                                );
                                                            }}
                                                            className="text-[var(--color-warning-text)] hover:text-[var(--color-warning-bg)]"
                                                        >
                                                            <PencilLineIcon
                                                                size={18}
                                                                weight="fill"
                                                            />
                                                        </button>

                                                        {/* DELETE SESSION */}
                                                        <button
                                                            onClick={async (e) => {

                                                                e.stopPropagation();

                                                                const confirmDelete =
                                                                    confirm(
                                                                        "Delete this entire session?"
                                                                    );

                                                                if (!confirmDelete)
                                                                    return;

                                                                const { error } =
                                                                    await supabase
                                                                        .from("session_units")
                                                                        .delete()
                                                                        .eq(
                                                                            "id",
                                                                            row.unit_id
                                                                        );

                                                                if (!error) {

                                                                    setRows((prev) =>
                                                                        prev.filter(
                                                                            (r) =>
                                                                                r.unit_id !==
                                                                                row.unit_id
                                                                        )
                                                                    );

                                                                    setCurrentPage(1);

                                                                } else {

                                                                    alert(error.message);
                                                                }
                                                            }}
                                                            className="text-[var(--color-error-text)] hover:text-[var(--color-error-bg)]"
                                                        >
                                                            <TrashIcon
                                                                size={18}
                                                                weight="fill"
                                                            />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))

                                    ) : (

                                        (visibleRows as Unit[]).map((row) => (

                                            <tr
                                                key={row.id}

                                                onClick={() =>
                                                    router.push(
                                                        `/dashboard/admin/question-bank/${row.id}`
                                                    )
                                                }

                                                className={`
        cursor-pointer border-b last:border-0
        hover:bg-gray-50 dark:hover:bg-white/5
      `}
                                            >

                                                <td className="px-5 py-4 text-sm font-medium">
                                                    {row.session_code}
                                                </td>

                                                <td className="px-5 py-4 text-sm">

                                                    <span
                                                        className={`
      inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase

      ${row.type === "practice"
                                                                ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                                                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400"
                                                            }
    `}
                                                    >
                                                        {row.type}
                                                    </span>

                                                </td>

                                                <td className="px-5 py-4 text-sm">
                                                    {row.category}
                                                </td>

                                                <td className="px-5 py-4 text-sm">
                                                    {row.title}
                                                </td>

                                                <td className="px-5 py-4 text-sm uppercase">
                                                    {row.access_level}
                                                </td>

                                                <td className="px-5 py-4 text-sm">
                                                    <span className={`
      inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase

      ${row.is_active === true
                                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                                                            : "bg-gray-100 text-gray-500 dark:bg-gray-500/10 dark:text-gray-400"
                                                        }
    `}>
                                                        {row.is_active
                                                            ? "Active"
                                                            : "Inactive"}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-sm text-gray-500">
                                                    {row.created_at
                                                        ? new Date(
                                                            row.created_at
                                                        ).toLocaleDateString()
                                                        : "-"}
                                                </td>

                                                <td className="px-5 py-4 text-sm">

                                                    <div className="flex items-center gap-2">

                                                        {/* EDIT */}
                                                        <button
                                                            onClick={(e) => {

                                                                e.stopPropagation();

                                                                router.push(
                                                                    `/dashboard/admin/question-bank/${row.id}/edit`
                                                                );
                                                            }}
                                                            className="text-[var(--color-warning-text)] hover:text-[var(--color-warning-bg)]"
                                                        >
                                                            <PencilLineIcon
                                                                size={18}
                                                                weight="fill"
                                                            />
                                                        </button>

                                                        {/* DELETE */}
                                                        <button
                                                            onClick={async (e) => {

                                                                e.stopPropagation();

                                                                const confirmDelete =
                                                                    confirm(
                                                                        "Delete this session?"
                                                                    );

                                                                if (!confirmDelete)
                                                                    return;

                                                                const { error } =
                                                                    await supabase
                                                                        .from("session_units")
                                                                        .delete()
                                                                        .eq("id", row.id);

                                                                if (!error) {

                                                                    setUnitRows((prev) =>
                                                                        prev.filter(
                                                                            (r) =>
                                                                                r.id !== row.id
                                                                        )
                                                                    );

                                                                    setCurrentPage(1);


                                                                } else {

                                                                    alert(error.message);
                                                                }
                                                            }}
                                                            className="text-[var(--color-error-text)] hover:text-[var(--color-error-bg)]"
                                                        >
                                                            <TrashIcon
                                                                size={18}
                                                                weight="fill"
                                                            />
                                                        </button>
                                                    </div>
                                                </td>

                                            </tr>
                                        ))

                                    )
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Bottom Info & Pagination */}
                {!loading ? (
                    <div className="space-y-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800 sm:flex sm:items-center sm:justify-between sm:space-y-0">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {totalRows === 0 ? (
                                `No ${emptyLabel.toLowerCase()} found`
                            ) : (
                                `Showing ${startLabel} to ${endLabel} of ${totalRows} entries`
                            )}
                        </p>
                        {totalRows > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={safePage <= 1}
                                    onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                                >
                                    ‹
                                </button>
                                {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
                                    <button
                                        key={page}
                                        type="button"
                                        onClick={() => setCurrentPage(page)}
                                        className={`rounded-lg px-3 py-2 text-sm font-medium transition ${safePage === page
                                            ? "bg-brand-500 text-white"
                                            : "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    disabled={safePage >= pageCount}
                                    onClick={() => setCurrentPage((value) => Math.min(pageCount, value + 1))}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                                >
                                    ›
                                </button>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
            {isModalOpen && (
                <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">

                        {/* HEADER */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Topic Details</h3>
                        </div>

                        {/* CONTENT */}
                        {!selectedTopic ? (
                            <p className="w-fit text-sm text-gray-500">Loading...</p>
                        ) : (
                            <div className="flex flex-col gap-5 max-h-[600px] overflow-y-auto pr-2">

                                {/* TOPIC */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs uppercase text-gray-400">
                                        Part {selectedTopic.part}
                                    </span>

                                    <h2 className="text-black text-2xl font-semibold leading-snug">
                                        {selectedTopic.title || "Untitled"}
                                    </h2>

                                    {selectedTopic.prompt && (
                                        <p className="text-sm text-gray-500">
                                            {selectedTopic.prompt}
                                        </p>
                                    )}
                                </div>

                                {/* LABEL */}
                                <div className="flex flex-col gap-1">
                                    <span className="text-primary text-sm font-bold">
                                        Question Details
                                    </span>

                                    {/* DETAILS */}
                                    {details.length === 0 ? (
                                        <p className="text-sm text-gray-500">No details</p>
                                    ) : (
                                        <div className="flex flex-col gap-1">
                                            {details.map((d, index) => {
                                                const Icon = numberIcons[index];

                                                return (
                                                    <div
                                                        key={d.id}
                                                        className="w-full p-3 bg-[var(--color-tertiary)] rounded-2xl border border-1 border-[var(--color-primary)] flex items-center gap-2"
                                                    >
                                                        {Icon ? (
                                                            <Icon size={20} weight="regular" className="text-primary" />
                                                        ) : (
                                                            <div className="w-5 h-5 flex items-center justify-center text-xs font-bold text-primary">
                                                                {index + 1}
                                                            </div>
                                                        )}

                                                        <span className="text-[var(--color-primary)] text-sm font-medium">
                                                            {d.content}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* FOOTER */}
                        <div className="mt-6 flex justify-end gap-2">
                            <TextButton
                                variant="secondary"

                                onClick={() => {

                                    if (!selectedTopic)
                                        return;

                                    router.push(
                                        `/dashboard/admin/question-bank/${selectedTopic.unit_id}/edit`
                                    );
                                }}
                            >
                                Edit
                            </TextButton>
                            <TextButton
                                variant="secondary"
                                onClick={() => setIsModalOpen(false)}
                            >
                                Close
                            </TextButton>
                        </div>
                    </div>
                </div>
            )}
        </section >
    );
}
