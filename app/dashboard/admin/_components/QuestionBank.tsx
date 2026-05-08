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
import { title } from "process";

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
    title: string;
    part: number;
    prompt: string | null;
    is_active: boolean;
    created_at: string | null;
};

type Detail = {
    id?: string;
    type: "question" | "bullet";
    content: string;
    order_index: number;
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
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState("");
    const [isUnauthorized, setIsUnauthorized] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [pageSize, setPageSize] = useState<5 | 10>(5);
    const [currentPage, setCurrentPage] = useState(1);

    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const selectedTopic = rows.find((r) => r.id === selectedTopicId);

    const [details, setDetails] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [editTopic, setEditTopic] = useState<Question | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editPrompt, setEditPrompt] = useState("");
    const [editPart, setEditPart] = useState<number>(1);
    const [editActive, setEditActive] = useState(true);
    const [editDetails, setEditDetails] = useState<Detail[]>([]);

    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const [newPart, setNewPart] = useState<number>(1);
    const [newTitle, setNewTitle] = useState("");
    const [newPrompt, setNewPrompt] = useState("");
    const [newActive, setNewActive] = useState(true);

    const [newDetails, setNewDetails] = useState<
        { type: "question" | "bullet"; content: string }[]
    >([]);

    // Auto-generate structure when part changes
    useEffect(() => {
        if (newPart === 2) {
            // Part 2: Cue card structure (1 question + 3 bullets)
            setNewDetails([
                { type: "question", content: "" },
                { type: "bullet", content: "" },
                { type: "bullet", content: "" },
                { type: "bullet", content: "" },
            ]);
        } else {
            // Part 1 & 3: Default to 3 questions
            setNewDetails([
                { type: "question", content: "" },
                { type: "question", content: "" },
                { type: "question", content: "" },
            ]);
        }
    }, [newPart]);

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

            const { data, error } = await supabase
                .from("topics")
                .select("id, part, title, prompt, is_active, created_at")
                .order("created_at", { ascending: false });

            if (error) {
                setNotice(error.message);
            }

            setRows((data as Question[] | null) ?? []);
            setLoading(false);
        };

        void load();
    }, [router]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, pageSize]);

    const filteredRows = useMemo(() => {
        const q = searchTerm.toLowerCase();

        return rows.filter((row) =>
            row.prompt?.toLowerCase().includes(q)
        );
    }, [rows, searchTerm]);

    const totalRows = filteredRows.length;
    const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
    const safePage = Math.min(currentPage, pageCount);
    const startIndex = (safePage - 1) * pageSize;
    const visibleRows = filteredRows.slice(startIndex, startIndex + pageSize);
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

            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* LEFT CARD */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Total {summaryLabel}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-white/90">
                        {totalRows}
                    </p>
                </div>

                {/* RIGHT CARD */}
                <div className="inline-flex justify-between items-center rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        New Questions
                    </p>
                    <TextButton
                        variant="primary"
                        onClick={() => setIsCreateOpen(true)}
                    >
                        Create Topic
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
                                <tr className="border-b border-gray-100 dark:border-gray-800">
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Part</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Title</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Prompt</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Created</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                                </tr>
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
                                    visibleRows.map((row) => (
                                        <tr
                                            key={row.id}
                                            onClick={() => handleRowClick(row.id)}
                                            className={`
            cursor-pointer border-b last:border-0
            hover:bg-gray-50 dark:hover:bg-white/5
            ${selectedTopicId === row.id ? "bg-brand-50" : ""}
          `}
                                        >
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
                                                {row.is_active ? "Active" : "Inactive"}
                                            </td>

                                            <td className="px-5 py-4 text-sm text-gray-500">
                                                {row.created_at
                                                    ? new Date(row.created_at).toLocaleDateString()
                                                    : "-"}
                                            </td>
                                            <td className="px-5 py-4 text-sm flex gap-2">
                                                {/* EDIT */}
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();

                                                        setEditTopic(row);
                                                        setEditTitle(row.title);
                                                        setEditPrompt(row.prompt || "");
                                                        setEditPart(row.part);
                                                        setEditActive(row.is_active);

                                                        const { data } = await supabase
                                                            .from("topic_details")
                                                            .select("*")
                                                            .eq("topic_id", row.id)
                                                            .order("order_index");

                                                        setEditDetails(data || []);
                                                    }}
                                                    className="text-[var(--color-warning-text)] hover:text-[var(--color-warning-bg)]"
                                                >
                                                    <PencilLineIcon size={18} weight="fill" />
                                                </button>

                                                {/* DELETE */}
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();

                                                        const confirmDelete = confirm("Delete this topic?");
                                                        if (!confirmDelete) return;

                                                        const { error } = await supabase
                                                            .from("topics")
                                                            .delete()
                                                            .eq("id", row.id);

                                                        if (!error) {
                                                            setRows((prev) => prev.filter((r) => r.id !== row.id));
                                                        } else {
                                                            alert(error.message);
                                                        }
                                                    }}
                                                    className="text-[var(--color-error-text)] hover:text-[var(--color-error-bg)]"
                                                >
                                                    <TrashIcon size={18} weight="fill"/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
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
                                onClick={async () => {
                                    if (!selectedTopic) return;

                                    // 🔥 close view modal
                                    setIsModalOpen(false);

                                    // 🔥 open edit modal
                                    setEditTopic(selectedTopic);
                                    setEditTitle(selectedTopic.title);
                                    setEditPrompt(selectedTopic.prompt || "");
                                    setEditPart(selectedTopic.part);
                                    setEditActive(selectedTopic.is_active);

                                    // 🔥 fetch details
                                    const { data } = await supabase
                                        .from("topic_details")
                                        .select("*")
                                        .eq("topic_id", selectedTopic.id)
                                        .order("order_index");

                                    setEditDetails(data || []);
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
            {editTopic && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">

                        <h3 className="text-lg font-semibold mb-4">Edit Topic</h3>

                        {/* PART */}
                        <div className="w-full p-3 mb-3 text-primary outline-dashed outline-[var(--primary)] rounded-2xl">
                            <select
                                value={editPart}
                                onChange={(e) => setEditPart(Number(e.target.value))}
                                className="w-full outline-none bg-transparent"
                            >
                                <option value={1}>Part 1</option>
                                <option value={2}>Part 2</option>
                                <option value={3}>Part 3</option>
                            </select>
                        </div>

                        {/* TITLE */}
                        <label htmlFor="editTitle" className="w-full block text-base font-bold text-primary">
                            Title
                            <InputField
                                className="flex-1 min-w-0 mt-2 my-3"
                                value={editTitle}
                                onChange={(v) => setEditTitle(v)}
                                placeholder="Title"
                            />
                        </label>

                        {/* PROMPT */}
                        <label htmlFor="editPrompt" className="w-full block text-base font-bold text-primary">
                            Prompt
                            <InputField
                                className="flex-1 min-w-0 mt-2 my-3"
                                value={editPrompt}
                                onChange={(v) => setEditPrompt(v)}
                                placeholder="Prompt"
                            />
                        </label>

                        {/* ACTIVE */}
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-medium">Activate topic</span>

                            <Toggle
                                checked={editActive}
                                onChange={(v) => setEditActive(v)}
                            />
                        </div>


                        {/* DETAILS */}
                        <div className="space-y-2 mb-4">
                            {editDetails.map((d, i) => (
                                <div key={d.id ?? i} className="flex gap-2">

                                    {/* TYPE */}
                                    <div className="mx-auto p-3 text-primary outline-dashed outline-[var(--primary)] rounded-2xl flex items-center">
                                        <select
                                            value={d.type}
                                            onChange={(e) => {
                                                const updated = [...editDetails];
                                                updated[i].type = e.target.value as any;
                                                setEditDetails(updated);
                                            }}
                                            className="bg-transparent outline-none w-full"
                                        >
                                            <option value="question">Question</option>
                                            <option value="bullet">Bullet</option>
                                        </select>
                                    </div>

                                    {/* CONTENT */}
                                    <InputField
                                        className="flex-1"
                                        value={d.content}
                                        onChange={(v) => {
                                            const updated = [...editDetails];
                                            updated[i].content = v;
                                            setEditDetails(updated);
                                        }}
                                        placeholder="Content"
                                    />

                                    {/* DELETE */}
                                    <button
                                        onClick={() => {
                                            setEditDetails((prev) =>
                                                prev
                                                    .filter((_, idx) => idx !== i)
                                                    .map((d, index) => ({
                                                        ...d,
                                                        order_index: index,
                                                    }))
                                            );
                                        }}
                                        className="text-red-500"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* ADD DETAIL */}
                        <button
                            onClick={() =>
                                setEditDetails((prev) => [
                                    ...prev,
                                    {
                                        type: "question",
                                        content: "",
                                        order_index: prev.length, // 🔥 important
                                    },
                                ])
                            }
                            className="mb-4 text-primary"
                        >
                            Add Detail
                        </button>

                        {/* ACTIONS */}
                        <div className="flex justify-end gap-2">
                            <TextButton
                                variant="secondary"
                                onClick={() => setEditTopic(null)}
                            >
                                Cancel
                            </TextButton>


                            <TextButton
                                variant="primary"
                                onClick={async () => {
                                    const { error } = await supabase
                                        .from("topics")
                                        .update({
                                            part: editPart,
                                            title: editTitle,
                                            prompt: editPrompt,
                                            is_active: editActive,
                                        })
                                        .eq("id", editTopic.id);

                                    if (error) {
                                        alert(error.message);
                                        return;
                                    }

                                    await supabase
                                        .from("topic_details")
                                        .delete()
                                        .eq("topic_id", editTopic.id);

                                    if (editDetails.length > 0) {
                                        await supabase.from("topic_details").insert(
                                            editDetails.map((d) => ({
                                                topic_id: editTopic.id,
                                                type: d.type,
                                                content: d.content,
                                                order_index: d.order_index, // 🔥 USE EXISTING ORDER
                                            }))
                                        );
                                    }

                                    setRows((prev) =>
                                        prev.map((r) =>
                                            r.id === editTopic.id
                                                ? {
                                                    ...r,
                                                    part: editPart,
                                                    title: editTitle,
                                                    prompt: editPrompt,
                                                    is_active: editActive,
                                                }
                                                : r
                                        )
                                    );

                                    // 🔥 5. reset
                                    setEditTopic(null);
                                    setEditDetails([]);
                                }}
                            >
                                Save
                            </TextButton>
                        </div>
                    </div>
                </div>
            )
            }

            {
                isCreateOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                        <div
                            className="w-full max-w-lg rounded-2xl bg-white p-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-semibold mb-4">Create Topic</h3>

                            {/* PART */}
                            <div className="w-full p-3 mb-3 text-primary outline-dashed outline-[var(--primary)] rounded-2xl">
                                <select
                                    value={newPart}
                                    onChange={(e) => setNewPart(Number(e.target.value))}
                                    className="w-full outline-none bg-transparent"
                                >
                                    <option value={1}>Part 1</option>
                                    <option value={2}>Part 2</option>
                                    <option value={3}>Part 3</option>
                                </select>
                            </div>

                            <label htmlFor="newTitle" className="w-full block text-base font-bold text-primary">
                                Title
                                <InputField
                                    className="flex-1 min-w-0 mt-2 my-3"
                                    value={newTitle}
                                    onChange={(v) => setNewTitle(v)}
                                    placeholder="Title"
                                />
                            </label>

                            {/* PROMPT */}
                            <label htmlFor="newPrompt" className="w-full block text-base font-bold text-primary">
                                Prompt
                                <InputField
                                    className="flex-1 min-w-0 mt-2 my-3"
                                    value={newPrompt}
                                    onChange={(v) => setNewPrompt(v)}
                                    placeholder="Prompt"
                                />
                            </label>

                            {/* ACTIVE */}
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-medium">Activate topic</span>

                                <Toggle
                                    checked={newActive}
                                    onChange={(v) => setNewActive(v)}
                                />
                            </div>

                            {/* DETAILS */}
                            <div className="space-y-2 mb-4">
                                {newDetails.map((d, i) => (
                                    <div key={i} className="flex gap-2">
                                        <div className="mx-auto p-3 text-primary outline-dashed outline-[var(--primary)] rounded-2xl flex items-center">
                                            <select
                                                value={d.type}
                                                onChange={(e) => {
                                                    const updated = [...newDetails];
                                                    updated[i].type = e.target.value as any;
                                                    setNewDetails(updated);
                                                }}
                                                className="bg-transparent outline-none w-full"
                                            >
                                                <option value="question">Question</option>
                                                <option value="bullet">Bullet</option>
                                            </select>
                                        </div>

                                        <InputField
                                            className="flex-1"
                                            value={d.content}
                                            onChange={(v) => {
                                                const updated = [...newDetails];
                                                updated[i].content = v;
                                                setNewDetails(updated);
                                            }}
                                            placeholder="Content"
                                        />

                                        <button
                                            onClick={() =>
                                                setNewDetails((prev) => prev.filter((_, idx) => idx !== i))
                                            }
                                            className="text-red-500"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* ADD DETAIL */}
                            <button
                                onClick={() =>
                                    setNewDetails((prev) => [
                                        ...prev,
                                        {
                                            type: "question",
                                            content: "",
                                            order_index: prev.length,
                                        },
                                    ])
                                }

                                className="text-primary my-4"
                            >
                                Add Detail
                            </button>

                            {/* ACTIONS */}
                            <div className="flex justify-end gap-2">
                                <TextButton
                                    variant="secondary"
                                    onClick={() => setIsCreateOpen(false)}
                                >
                                    Cancel
                                </TextButton>
                                <TextButton
                                    variant="primary"
                                    onClick={async () => {
                                        const { data: topic, error } = await supabase
                                            .from("topics")
                                            .insert({
                                                part: newPart,
                                                title: newTitle,
                                                prompt: newPrompt,
                                                is_active: newActive,
                                            })
                                            .select()
                                            .single();

                                        if (error) {
                                            alert(error.message);
                                            return;
                                        }

                                        if (newDetails.length > 0) {
                                            await supabase.from("topic_details").insert(
                                                newDetails.map((d, i) => ({
                                                    topic_id: topic.id,
                                                    type: d.type,
                                                    content: d.content,
                                                    order_index: i,
                                                }))
                                            );
                                        }

                                        setRows((prev) => [topic, ...prev]);

                                        setIsCreateOpen(false);
                                        setNewPrompt("");
                                        setNewPart(1);
                                        setNewActive(true);
                                        setNewDetails([]);
                                    }}
                                >
                                    Create
                                </TextButton>
                            </div>
                        </div>
                    </div>
                )
            }
        </section >
    );
}
