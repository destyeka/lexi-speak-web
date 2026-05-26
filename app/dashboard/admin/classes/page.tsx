"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { exportToExcel } from "@/lib/exportExcel";
import {
    PencilLineIcon,
    TrashIcon,
    CopyIcon,
} from "@phosphor-icons/react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

type ClassRow = {
    id: string;
    name: string;
    description: string | null;
    join_code: string;
    coach_id: string | null;
    created_by: string | null;
    created_at: string | null;

    coach?: {
        id: string;
        email: string;
    } | null;

    creator?: {
        id: string;
        email: string;
    } | null;

    class_members?: {
        id: string;
    }[];
};

export default function ClassesTable() {
    const router = useRouter();

    const [rows, setRows] = useState<ClassRow[]>(
        []
    );

    const [loading, setLoading] =
        useState(true);

    const [searchTerm, setSearchTerm] =
        useState("");

    const [coachFilter,
        setCoachFilter] =
        useState("all");

    const [studentFilter,
        setStudentFilter] =
        useState("all");

    const [sortBy,
        setSortBy] =
        useState("created_at");

    const [sortOrder,
        setSortOrder] =
        useState<"asc" | "desc">(
            "desc"
        );

    const [startDate,
        setStartDate] =
        useState<Date | null>(null);

    const [endDate,
        setEndDate] =
        useState<Date | null>(null);

    const [pageSize, setPageSize] =
        useState<
            10 | 25 | 50 | 100
        >(10);

    const [currentPage, setCurrentPage] =
        useState(1);

    const [selectedRows,
        setSelectedRows] =
        useState<string[]>([]);

    const [notice, setNotice] =
        useState("");

    const [exportColumns,
        setExportColumns] =
        useState<string[]>([
            "name",
            "description",
            "join_code",
            "coach",
            "students",
            "created",
        ]);

    const [isUnauthorized, setIsUnauthorized] =
        useState(false);

    const [memberCounts, setMemberCounts] =
        useState<Record<string, number>>(
            {}
        );

    const [progressMap,
        setProgressMap] =
        useState<
            Record<string, number>
        >({});

    const [attemptCounts,
        setAttemptCounts] =
        useState<
            Record<string, number>
        >({});

    const [selectedClass,
        setSelectedClass] =
        useState<ClassRow | null>(
            null
        );

    const [isClassModalOpen,
        setIsClassModalOpen] =
        useState(false);

    const [classStudents,
        setClassStudents] =
        useState<any[]>([]);

    const [loadingStudents,
        setLoadingStudents] =
        useState(false);

    const [selectedStudents,
        setSelectedStudents] =
        useState<string[]>([]);

    const [studentAffiliationFilter,
        setStudentAffiliationFilter] =
        useState("all");

    const [studentActivityFilter,
        setStudentActivityFilter] =
        useState("all");

    const [studentSortBy,
        setStudentSortBy] =
        useState("email");

    const [studentSortOrder,
        setStudentSortOrder] =
        useState<"asc" | "desc">(
            "asc"
        );

    const [studentStartDate,
        setStudentStartDate] =
        useState<Date | null>(null);

    const [studentEndDate,
        setStudentEndDate] =
        useState<Date | null>(null);

    const [studentExportColumns,
        setStudentExportColumns] =
        useState<string[]>([
            "email",
            "affiliation",
            "progress",
            "attempts",
            "joined",
        ]);

    useEffect(() => {
        const load = async () => {

            setLoading(true);

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.replace("/login");
                return;
            }

            const { data: me } =
                await supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", user.id)
                    .maybeSingle();

            if (me?.role !== "admin") {

                setIsUnauthorized(true);
                setLoading(false);

                return;
            }

            const { data, error } =
                await supabase
                    .from("classes")
                    .select(`
      id,
      name,
      description,
      join_code,
      coach_id,
      created_by,
      created_at,

      coach:profiles!classes_coach_id_fkey (
        id,
        email
      ),

      creator:profiles!classes_created_by_fkey (
        id,
        email
      )
    `)
                    .order("created_at", {
                        ascending: false,
                    });

            if (error) {
                console.error(error);
                setNotice(error.message);
            }

            const { data: memberData } =
                await supabase
                    .from("class_members")
                    .select("class_id");

            const {
                data: historyData
            } = await supabase
                .from("student_score_history")
                .select(`
        student_id,
        score
    `);

            const latestScores:
                Record<string, number> = {};

            const attempts:
                Record<string, number> = {};

            historyData?.forEach((h) => {

                if (!h.student_id) return;

                attempts[h.student_id] =
                    (attempts[h.student_id] || 0)
                    + 1;

                latestScores[h.student_id] =
                    h.score || 0;
            });

            setProgressMap(
                latestScores
            );

            setAttemptCounts(
                attempts
            );

            const counts:
                Record<string, number> = {};

            memberData?.forEach((m) => {

                counts[String(m.class_id)] =
                    (counts[String(m.class_id)] || 0) + 1;
            });

            setMemberCounts(counts);

            console.log(memberData);
            console.log(counts);
            console.log(data);

            console.log(
                "COUNTS",
                counts
            );

            console.log(
                "ROWS",
                data?.map((r) => ({
                    id: r.id,
                    name: r.name,
                }))
            );

            console.log(
                "ROW IDS",
                rows.map((r) => r.id)
            );

            console.log(
                "MEMBER IDS",
                memberData
            );

            console.log("TOTAL ROWS", data?.length);

            setRows((data as any[]) ?? []);
            setLoading(false);
        };

        load();
    }, [router]);

    const filteredRows = useMemo(() => {

        const query =
            searchTerm
                .trim()
                .toLowerCase();

        let result = [...rows];

        // SEARCH
        if (query) {

            result = result.filter(
                (row) => {

                    return (
                        row.name
                            ?.toLowerCase()
                            .includes(query) ||

                        row.join_code
                            ?.toLowerCase()
                            .includes(query) ||

                        row.coach?.email
                            ?.toLowerCase()
                            .includes(query)
                    );
                }
            );
        }

        // COACH FILTER
        if (coachFilter === "assigned") {

            result = result.filter(
                (r) => r.coach_id
            );
        }

        if (coachFilter === "unassigned") {

            result = result.filter(
                (r) => !r.coach_id
            );
        }

        // STUDENT FILTER
        if (studentFilter !== "all") {

            result = result.filter(
                (r) => {

                    const count =
                        memberCounts[r.id]
                        || 0;

                    if (
                        studentFilter === "empty"
                    ) {
                        return count === 0;
                    }

                    if (
                        studentFilter === "small"
                    ) {
                        return (
                            count >= 1 &&
                            count <= 10
                        );
                    }

                    if (
                        studentFilter === "medium"
                    ) {
                        return (
                            count >= 11 &&
                            count <= 30
                        );
                    }

                    if (
                        studentFilter === "large"
                    ) {
                        return count > 30;
                    }

                    return true;
                }
            );
        }

        // DATE FILTER
        if (startDate || endDate) {

            result = result.filter(
                (row) => {

                    if (
                        !row.created_at
                    ) {
                        return false;
                    }

                    const createdAt =
                        new Date(
                            row.created_at
                        );

                    if (
                        startDate &&
                        createdAt < startDate
                    ) {
                        return false;
                    }

                    if (
                        endDate &&
                        createdAt > endDate
                    ) {
                        return false;
                    }

                    return true;
                }
            );
        }

        // SORT
        result.sort((a, b) => {

            let aValue: any;
            let bValue: any;

            switch (sortBy) {

                case "students":

                    aValue =
                        memberCounts[a.id]
                        || 0;

                    bValue =
                        memberCounts[b.id]
                        || 0;

                    break;

                case "coach":

                    aValue =
                        a.coach?.email
                        || "";

                    bValue =
                        b.coach?.email
                        || "";

                    break;

                case "name":

                    aValue = a.name;
                    bValue = b.name;

                    break;

                default:

                    aValue =
                        a.created_at || "";

                    bValue =
                        b.created_at || "";
            }

            if (
                typeof aValue ===
                "string"
            ) {

                return sortOrder === "asc"
                    ? aValue.localeCompare(
                        bValue
                    )
                    : bValue.localeCompare(
                        aValue
                    );
            }

            return sortOrder === "asc"
                ? aValue - bValue
                : bValue - aValue;
        });

        return result;

    }, [
        rows,
        searchTerm,
        coachFilter,
        studentFilter,
        sortBy,
        sortOrder,
        startDate,
        endDate,
        memberCounts,
    ]);

    const totalRows =
        filteredRows.length;

    const pageCount = Math.max(
        1,
        Math.ceil(totalRows / pageSize)
    );

    const safePage = Math.min(
        currentPage,
        pageCount
    );

    const startIndex =
        (safePage - 1) * pageSize;

    const visibleRows =
        filteredRows.slice(
            startIndex,
            startIndex + pageSize
        );

    const studentAffiliations =
        Array.from(
            new Set(
                classStudents
                    .map(
                        (s) =>
                            s.student
                                ?.affiliation
                    )
                    .filter(Boolean)
            )
        );

    const filteredStudents =
        [...classStudents]

            .filter((s) => {

                const student =
                    s.student;

                if (!student) {
                    return false;
                }

                // AFFILIATION
                if (
                    studentAffiliationFilter
                    !== "all"
                ) {

                    if (
                        student.affiliation !==
                        studentAffiliationFilter
                    ) {
                        return false;
                    }
                }

                // ACTIVITY
                const hasActivity =
                    (attemptCounts[
                        student.id
                    ] || 0) > 0;

                if (
                    studentActivityFilter
                    === "active" &&
                    !hasActivity
                ) {
                    return false;
                }

                if (
                    studentActivityFilter
                    === "inactive" &&
                    hasActivity
                ) {
                    return false;
                }


                return true;
            })
            



            .sort((a, b) => {

                const studentA =
                    a.student;

                const studentB =
                    b.student;

                if (
                    !studentA ||
                    !studentB
                ) {
                    return 0;
                }

                let aValue: any;
                let bValue: any;

                switch (
                studentSortBy
                ) {

                    case "joined":

                        aValue =
                            a.created_at || "";

                        bValue =
                            b.created_at || "";

                        break;

                    default:

                        aValue =
                            studentA.email
                            || "";

                        bValue =
                            studentB.email
                            || "";
                }

                if (
                    typeof aValue ===
                    "string"
                ) {

                    return studentSortOrder
                        === "asc"

                        ? aValue.localeCompare(
                            bValue
                        )

                        : bValue.localeCompare(
                            aValue
                        );
                }

                return 0;
            });

    const allStudentsSelected =
        filteredStudents.length > 0 &&
        filteredStudents.every(
            (s) =>
                selectedStudents.includes(
                    s.student?.id
                )
        );

    const totalStudents =
        Object.values(
            memberCounts
        ).reduce(
            (sum, count) =>
                sum + count,
            0
        );

    const assignedClasses =
        rows.filter(
            (r) => r.coach_id
        ).length;

    const unassignedClasses =
        rows.filter(
            (r) => !r.coach_id
        ).length;

    const openClassModal = async (
        row: ClassRow
    ) => {

        setSelectedClass(row);

        setIsClassModalOpen(true);

        setLoadingStudents(true);

        // GET CLASS MEMBERS
        console.log(
            "ROW ID",
            row.id,
            typeof row.id
        );
        const {
            data: members,
            error: memberError
        } = await supabase
            .from("class_members")
            .select(`
            class_id,
            joined_at,
            student_id
        `)
            .eq("class_id", row.id);

        if (
            memberError ||
            !members
        ) {

            console.error(
                memberError
            );

            setClassStudents([]);

            setLoadingStudents(false);

            return;
        }

        // GET STUDENT IDS
        const studentIds =
            members
                .map(
                    (m) => m.student_id
                )
                .filter(Boolean);

        if (studentIds.length === 0) {

            setClassStudents([]);

            setLoadingStudents(false);

            return;
        }

        // GET STUDENT PROFILES
        const {
            data: profiles,
            error: profileError
        } = await supabase
            .from("profiles")
            .select(`
            id,
            email,
            affiliation
        `)
            .in("id", studentIds);

        if (profileError) {

            console.error(
                profileError
            );

            setClassStudents([]);

            setLoadingStudents(false);

            return;
        }

        // MERGE
        const merged =
            members.map((m) => ({

                ...m,

                student:
                    profiles?.find(
                        (p) =>
                            p.id ===
                            m.student_id
                    ) || null
            }));

        console.log(
            "MERGED STUDENTS",
            merged
        );

        setClassStudents(
            merged
        );

        setLoadingStudents(false);
    };

    const handleDelete = async (
        id: string
    ) => {

        const confirmed =
            confirm(
                "Delete this class?"
            );

        if (!confirmed) return;

        const { error } =
            await supabase
                .from("classes")
                .delete()
                .eq("id", id);

        if (error) {
            alert(error.message);
            return;
        }

        setRows((prev) =>
            prev.filter(
                (r) => r.id !== id
            )
        );
    };

    const exportClasses = (
        exportRows: ClassRow[]
    ) => {

        const exportData =
            exportRows.map((r) => {

                const row:
                    Record<string, any> = {};

                if (
                    exportColumns.includes(
                        "name"
                    )
                ) {
                    row.Name = r.name;
                }

                if (
                    exportColumns.includes(
                        "description"
                    )
                ) {
                    row.Description =
                        r.description || "-";
                }

                if (
                    exportColumns.includes(
                        "join_code"
                    )
                ) {
                    row["Join Code"] =
                        r.join_code;
                }

                if (
                    exportColumns.includes(
                        "coach"
                    )
                ) {
                    row.Coach =
                        r.coach?.email
                        || "-";
                }

                if (
                    exportColumns.includes(
                        "students"
                    )
                ) {
                    row.Students =
                        memberCounts[r.id]
                        || 0;
                }

                if (
                    exportColumns.includes(
                        "created"
                    )
                ) {
                    row.Created =
                        r.created_at
                            ? new Date(
                                r.created_at
                            ).toLocaleDateString()
                            : "-";
                }

                return row;
            });

        exportToExcel(exportData);
    };

    const exportClassMembers = (
        exportRows: any[]
    ) => {

        const exportData =
            exportRows.map(
                (item) => {

                    const student =
                        item.student;

                    const row:
                        Record<string, any>
                        = {};

                    if (
                        studentExportColumns.includes(
                            "email"
                        )
                    ) {

                        row.Email =
                            student?.email
                            || "-";
                    }

                    if (
                        studentExportColumns.includes(
                            "affiliation"
                        )
                    ) {

                        row.Affiliation =
                            student?.affiliation
                            || "-";
                    }

                    if (
                        studentExportColumns.includes(
                            "progress"
                        )
                    ) {

                        row.Latest =
                            progressMap[
                            student?.id
                            ] ?? "-";
                    }

                    if (
                        studentExportColumns.includes(
                            "attempts"
                        )
                    ) {

                        row.Attempts =
                            attemptCounts[
                            student?.id
                            ] || 0;
                    }

                    if (
                        studentExportColumns.includes(
                            "joined"
                        )
                    ) {

                        row.Joined =
                            item.joined_at

                                ? new Date(
                                    item.joined_at
                                ).toLocaleDateString()

                                : "-";
                    }

                    return row;
                }
            );

        exportToExcel(
            exportData
        );
    };

    return (
        <section className="space-y-6">

            {/* HEADER */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">

                <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
                    Classes
                </h1>

                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Manage learning classes and coach assignments.
                </p>

                {notice ? (
                    <p className="mt-3 text-sm text-red-500">
                        {notice}
                    </p>
                ) : null}
            </div>

            {/* SUMMARY */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                    <p className="text-xs uppercase text-gray-500">
                        Total Classes
                    </p>

                    <p className="text-2xl font-bold">
                        {rows.length}
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                    <p className="text-xs uppercase text-gray-500">
                        Assigned Coaches
                    </p>

                    <p className="text-2xl font-bold">
                        {assignedClasses}
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                    <p className="text-xs uppercase text-gray-500">
                        Unassigned
                    </p>

                    <p className="text-2xl font-bold">
                        {unassignedClasses}
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                    <p className="text-xs uppercase text-gray-500">
                        Total Students
                    </p>

                    <p className="text-2xl font-bold">
                        {totalStudents}
                    </p>
                </div>
            </div>

            {/* TABLE */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">

                {/* CONTROLS */}
                <div className="space-y-6 border-b border-gray-100 px-5 py-5 dark:border-gray-800">

                    {/* SEARCH & ACTIONS */}
                    <div className="
    flex flex-col gap-4
    lg:flex-row
    lg:items-center
    lg:justify-between
">

                        {/* LEFT */}
                        <div>

                            <input
                                value={searchTerm}
                                onChange={(e) =>
                                    setSearchTerm(
                                        e.target.value
                                    )
                                }
                                placeholder="Search class..."
                                className="
                w-full lg:w-80
                rounded-xl border
                border-gray-300
                bg-white
                px-4 py-2.5
                text-sm outline-none
                focus:border-primary
            "
                            />
                        </div>

                        {/* RIGHT */}
                        <div className="
        flex flex-wrap
        items-center gap-3
    ">

                            {/* ROWS */}
                            <select
                                value={pageSize}
                                onChange={(e) =>
                                    setPageSize(
                                        parseInt(
                                            e.target.value
                                        ) as
                                        | 10
                                        | 25
                                        | 50
                                        | 100
                                    )
                                }
                                className="
                rounded-xl border
                px-3 py-2.5 text-sm
                min-w-[110px]
            "
                            >
                                <option value={10}>
                                    10 Rows
                                </option>

                                <option value={25}>
                                    25 Rows
                                </option>

                                <option value={50}>
                                    50 Rows
                                </option>

                                <option value={100}>
                                    100 Rows
                                </option>
                            </select>

                            {/* EXPORT SELECTED */}
                            <button
                                disabled={
                                    selectedRows.length === 0
                                }

                                onClick={() => {

                                    const selected =
                                        filteredRows.filter(
                                            (r) =>
                                                selectedRows.includes(
                                                    r.id
                                                )
                                        );

                                    exportClasses(
                                        selected
                                    );
                                }}

                                className="
                rounded-xl
                bg-green-500
                px-4 py-2.5
                text-sm font-medium
                text-white
                transition

                hover:bg-green-600

                disabled:cursor-not-allowed
                disabled:opacity-50
            "
                            >
                                Export Selected (
                                {selectedRows.length}
                                )
                            </button>

                            {/* EXPORT ALL */}
                            <button
                                onClick={() =>
                                    exportClasses(
                                        filteredRows
                                    )
                                }
                                className="
      rounded-xl border
      border-green-200
      bg-green-50
      px-5 py-2.5 text-sm
      font-medium
      text-green-700
      transition hover:bg-green-100

      disabled:cursor-not-allowed
      disabled:opacity-50
    "
                            >
                                Export All (
                                {filteredRows.length}
                                )
                            </button>
                        </div>
                    </div>

                    {/* EXPORT COLUMNS */}
                    <div className="space-y-3">

                        <p className="
        text-xs font-medium
        uppercase tracking-wide
        text-gray-500
    ">
                            EXPORT COLUMNS
                        </p>

                        <div className="
        flex flex-wrap gap-3
    ">

                            {[
                                ["name", "Name"],
                                [
                                    "description",
                                    "Description",
                                ],
                                [
                                    "join_code",
                                    "Join Code",
                                ],
                                ["coach", "Coach"],
                                [
                                    "students",
                                    "Students",
                                ],
                                ["created", "Created"],
                            ].map(([key, label]) => {

                                const active =
                                    exportColumns.includes(
                                        key
                                    );

                                return (

                                    <button
                                        key={key}

                                        onClick={() => {

                                            setExportColumns(
                                                (prev) => {

                                                    if (
                                                        prev.includes(
                                                            key
                                                        )
                                                    ) {

                                                        return prev.filter(
                                                            (v) =>
                                                                v !== key
                                                        );
                                                    }

                                                    return [
                                                        ...prev,
                                                        key,
                                                    ];
                                                }
                                            );
                                        }}

                                        className={`
                        rounded-full
                        border px-4 py-2
                        text-sm transition

                        ${active
                                                ? `
border-primary
bg-primary
text-white
`
                                                : `
border-gray-300
bg-white
text-gray-600
hover:bg-gray-50
`
                                            }
                    `}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* FILTERS */}
                    <div className="space-y-3">

                        <p className="
            text-xs font-medium
            uppercase tracking-wide
            text-gray-500
        ">
                            FILTERS
                        </p>

                        <div className="flex flex-wrap gap-4">

                            {/* COACH */}
                            <div className="flex flex-col gap-1">

                                <label className="
                    text-xs font-medium
                    text-gray-500
                ">
                                    Coach Status
                                </label>

                                <select
                                    value={coachFilter}
                                    onChange={(e) =>
                                        setCoachFilter(
                                            e.target.value
                                        )
                                    }
                                    className="
                        min-w-[180px]
                        rounded-xl border
                        px-3 py-2 text-sm
                    "
                                >
                                    <option value="all">
                                        All Classes
                                    </option>

                                    <option value="assigned">
                                        Assigned
                                    </option>

                                    <option value="unassigned">
                                        Unassigned
                                    </option>
                                </select>
                            </div>

                            {/* STUDENTS */}
                            <div className="flex flex-col gap-1">

                                <label className="
                    text-xs font-medium
                    text-gray-500
                ">
                                    Student Count
                                </label>

                                <select
                                    value={studentFilter}
                                    onChange={(e) =>
                                        setStudentFilter(
                                            e.target.value
                                        )
                                    }
                                    className="
                        min-w-[180px]
                        rounded-xl border
                        px-3 py-2 text-sm
                    "
                                >
                                    <option value="all">
                                        All Sizes
                                    </option>

                                    <option value="empty">
                                        Empty Classes
                                    </option>

                                    <option value="small">
                                        1–10 Students
                                    </option>

                                    <option value="medium">
                                        11–30 Students
                                    </option>

                                    <option value="large">
                                        30+ Students
                                    </option>
                                </select>
                            </div>

                        </div>
                    </div>

                    {/* DATES */}
                    <div className="space-y-3">

                        <p className="
            text-xs font-medium
            uppercase tracking-wide
            text-gray-500
        ">
                            DATES
                        </p>

                        <div className="flex flex-wrap gap-4">

                            <div className="flex flex-col gap-1">

                                <label className="
                    text-xs font-medium
                    text-gray-500
                ">
                                    From Date
                                </label>

                                <DatePicker
                                    selected={startDate}
                                    onChange={(
                                        date:
                                            Date | null
                                    ) =>
                                        setStartDate(date)
                                    }
                                    placeholderText="Start date"
                                    className="
                        min-w-[160px]
                        rounded-xl border
                        px-3 py-2 text-sm
                    "
                                    dateFormat="dd MMM yyyy"
                                />
                            </div>

                            <div className="flex flex-col gap-1">

                                <label className="
                    text-xs font-medium
                    text-gray-500
                ">
                                    To Date
                                </label>

                                <DatePicker
                                    selected={endDate}
                                    onChange={(
                                        date:
                                            Date | null
                                    ) =>
                                        setEndDate(date)
                                    }
                                    placeholderText="End date"
                                    className="
                        min-w-[160px]
                        rounded-xl border
                        px-3 py-2 text-sm
                    "
                                    dateFormat="dd MMM yyyy"
                                />
                            </div>

                        </div>
                    </div>

                    {/* SORT */}
                    <div className="space-y-3">

                        <p className="
            text-xs font-medium
            uppercase tracking-wide
            text-gray-500
        ">
                            SORT
                        </p>

                        <div className="flex flex-wrap gap-4">

                            <div className="flex flex-col gap-1">

                                <label className="
                    text-xs font-medium
                    text-gray-500
                ">
                                    Sort By
                                </label>

                                <select
                                    value={sortBy}
                                    onChange={(e) =>
                                        setSortBy(
                                            e.target.value
                                        )
                                    }
                                    className="
                        min-w-[180px]
                        rounded-xl border
                        px-3 py-2 text-sm
                    "
                                >
                                    <option value="created_at">
                                        Created Date
                                    </option>

                                    <option value="students">
                                        Students
                                    </option>

                                    <option value="coach">
                                        Coach
                                    </option>

                                    <option value="name">
                                        Class Name
                                    </option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">

                                <label className="
                    text-xs font-medium
                    text-gray-500
                ">
                                    Order
                                </label>

                                <select
                                    value={sortOrder}
                                    onChange={(e) =>
                                        setSortOrder(
                                            e.target.value as
                                            "asc" | "desc"
                                        )
                                    }
                                    className="
                        min-w-[140px]
                        rounded-xl border
                        px-3 py-2 text-sm
                    "
                                >
                                    <option value="desc">
                                        Descending
                                    </option>

                                    <option value="asc">
                                        Ascending
                                    </option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">

                                <label className="
                    text-xs opacity-0
                ">
                                    reset
                                </label>

                                <button
                                    onClick={() => {

                                        setSearchTerm("");

                                        setCoachFilter(
                                            "all"
                                        );

                                        setStudentFilter(
                                            "all"
                                        );

                                        setSortBy(
                                            "created_at"
                                        );

                                        setSortOrder(
                                            "desc"
                                        );

                                        setStartDate(
                                            null
                                        );

                                        setEndDate(
                                            null
                                        );
                                    }}
                                    className="
                        rounded-xl border
                        px-4 py-2 text-sm
                        transition
                        hover:bg-gray-50
                    "
                                >
                                    Reset All
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

                {/* TABLE */}
                <div className="overflow-x-auto">

                    {isUnauthorized ? (

                        <div className="px-5 py-6 text-sm text-gray-500">
                            Admin access required.
                        </div>

                    ) : (

                        <table className="min-w-full">

                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-800">

                                    <th className="
    px-5 py-3
    text-left
">
                                        <input
                                            type="checkbox"

                                            checked={
                                                visibleRows.length > 0 &&
                                                visibleRows.every(
                                                    (r) =>
                                                        selectedRows.includes(
                                                            r.id
                                                        )
                                                )
                                            }

                                            onChange={(e) => {

                                                if (e.target.checked) {

                                                    setSelectedRows(
                                                        visibleRows.map(
                                                            (r) => r.id
                                                        )
                                                    );

                                                } else {

                                                    setSelectedRows([]);
                                                }
                                            }}
                                        />
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                        Class
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                        Join Code
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                        Coach
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                        Students
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                        Created
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            <tbody>

                                {loading ? (

                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-5 py-4 text-sm text-gray-500"
                                        >
                                            Loading classes...
                                        </td>
                                    </tr>

                                ) : visibleRows.length === 0 ? (

                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-5 py-4 text-sm text-gray-500"
                                        >
                                            No classes found.
                                        </td>
                                    </tr>

                                ) : (

                                    visibleRows.map((row) => (

                                        <tr
                                            key={row.id}

                                            onClick={() =>
                                                openClassModal(row)
                                            }

                                            className="
        cursor-pointer
        border-b border-gray-100
        last:border-0

        hover:bg-gray-50

        dark:border-gray-800
        dark:hover:bg-white/[0.03]
    "
                                        >

                                            <td className="px-5 py-4">

                                                <input
                                                    type="checkbox"

                                                    checked={
                                                        selectedRows.includes(
                                                            row.id
                                                        )
                                                    }

                                                    onChange={(e) => {

                                                        if (e.target.checked) {

                                                            setSelectedRows(
                                                                (prev) => [
                                                                    ...prev,
                                                                    row.id,
                                                                ]
                                                            );

                                                        } else {

                                                            setSelectedRows(
                                                                (prev) =>
                                                                    prev.filter(
                                                                        (id) =>
                                                                            id !== row.id
                                                                    )
                                                            );
                                                        }
                                                    }}
                                                />
                                            </td>

                                            <td className="px-5 py-4">

                                                <div>
                                                    <p className="font-medium text-gray-800 dark:text-white">
                                                        {row.name}
                                                    </p>

                                                    <p className="mt-1 text-sm text-gray-500">
                                                        {row.description || "-"}
                                                    </p>
                                                </div>

                                            </td>

                                            <td className="px-5 py-4 text-sm font-medium text-primary">
                                                {row.join_code}
                                            </td>

                                            <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                                                {row.coach?.email || "Unassigned"}
                                            </td>

                                            <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                                                {memberCounts[String(row.id)] || 0}
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

                                                    <button
                                                        onClick={(e) => {

                                                            e.stopPropagation();

                                                            navigator.clipboard.writeText(
                                                                row.join_code
                                                            );
                                                        }}
                                                        className="text-gray-500 transition hover:text-primary"
                                                    >
                                                        <CopyIcon
                                                            size={18}
                                                        />
                                                    </button>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(
                                                                `/dashboard/admin/classes/${row.id}/edit`
                                                            );
                                                        }}
                                                        className="text-yellow-500 transition hover:text-yellow-600"
                                                    >
                                                        <PencilLineIcon
                                                            size={18}
                                                        />
                                                    </button>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(row.id);
                                                        }}
                                                        className="text-red-500 transition hover:text-red-600"
                                                    >
                                                        <TrashIcon
                                                            size={18}
                                                        />
                                                    </button>

                                                </div>

                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* PAGINATION */}
                {!loading && (
                    <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 dark:border-gray-800">

                        <p className="text-sm text-gray-500">
                            Showing{" "}
                            {startIndex + 1}–
                            {Math.min(
                                startIndex + pageSize,
                                totalRows
                            )}{" "}
                            of {totalRows}
                        </p>

                        <div className="flex items-center gap-2">

                            <button
                                disabled={safePage <= 1}
                                onClick={() =>
                                    setCurrentPage(
                                        (p) =>
                                            Math.max(
                                                1,
                                                p - 1
                                            )
                                    )
                                }
                                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                            >
                                ‹
                            </button>

                            {Array.from(
                                {
                                    length: pageCount,
                                },
                                (_, i) => i + 1
                            ).map((page) => (

                                <button
                                    key={page}
                                    onClick={() =>
                                        setCurrentPage(
                                            page
                                        )
                                    }
                                    className={`
                    rounded-lg px-3 py-2 text-sm

                    ${safePage === page
                                            ? "bg-primary text-white"
                                            : "border"
                                        }
                  `}
                                >
                                    {page}
                                </button>
                            ))}

                            <button
                                disabled={
                                    safePage >= pageCount
                                }
                                onClick={() =>
                                    setCurrentPage(
                                        (p) =>
                                            Math.min(
                                                pageCount,
                                                p + 1
                                            )
                                    )
                                }
                                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                            >
                                ›
                            </button>

                        </div>
                    </div>
                )}
            </div>

            {/* CLASS MODAL */}
            {isClassModalOpen &&
                selectedClass && (

                    <div className="
fixed inset-0 z-[100000]
flex items-center justify-center
bg-black/40
p-4
">

                        <div className="
w-full max-w-6xl
rounded-2xl bg-white
p-6 shadow-lg
">

                            {/* HEADER */}
                            <div className="
mb-5 flex items-start
justify-between
">

                                <div>

                                    <h2 className="
text-xl font-semibold
">
                                        {selectedClass.name}
                                    </h2>

                                    <p className="
mt-1 text-sm text-gray-500
">
                                        {
                                            selectedClass.description
                                            || "No description"
                                        }
                                    </p>

                                </div>

                                <button
                                    onClick={() => {

                                        setIsClassModalOpen(
                                            false
                                        );

                                        setSelectedClass(
                                            null
                                        );

                                        setSelectedStudents(
                                            []
                                        );
                                    }}
                                    className="
rounded-lg border
px-4 py-2 text-sm
"
                                >
                                    Close
                                </button>

                            </div>

                            {/* CLASS INFO */}
                            <div className="
mb-6 grid gap-4
lg:grid-cols-[1.4fr_1fr]
">

                                {/* LEFT */}
                                <div className="
grid gap-4
">

                                    <div className="
rounded-xl border
px-4 py-3
">
                                        <p className="
text-xs uppercase
text-gray-500
">
                                            Coach
                                        </p>

                                        <p className="
mt-2 text-sm
font-medium
">
                                            {
                                                selectedClass.coach
                                                    ?.email
                                                || "Unassigned"
                                            }
                                        </p>
                                    </div>

                                    <div className="
rounded-xl border
px-4 py-3
">
                                        <p className="
text-xs uppercase
text-gray-500
">
                                            Join Code
                                        </p>

                                        <p className="
mt-2 text-sm
font-medium text-primary
">
                                            {
                                                selectedClass.join_code
                                            }
                                        </p>
                                    </div>

                                </div>

                                {/* RIGHT */}
                                <div className="
grid grid-cols-2
gap-3
">

                                    <div className="
rounded-xl border
px-4 py-3
">
                                        <p className="
text-xs uppercase
text-gray-500
">
                                            Students
                                        </p>

                                        <p className="
mt-2 text-lg
font-bold
">
                                            {
                                                filteredStudents.length
                                            }
                                        </p>
                                    </div>

                                    <div className="
rounded-xl border
px-4 py-3
">
                                        <p className="
text-xs uppercase
text-gray-500
">
                                            Active
                                        </p>

                                        <p className="
mt-2 text-lg
font-bold text-emerald-600
">
                                            {
                                                filteredStudents.filter(
                                                    (s) => {

                                                        const id =
                                                            s.student?.id;

                                                        return (
                                                            id &&
                                                            progressMap[
                                                            id
                                                            ] !== undefined
                                                        );
                                                    }
                                                ).length
                                            }
                                        </p>
                                    </div>

                                    <div className="
rounded-xl border
px-4 py-3
">
                                        <p className="
text-xs uppercase
text-gray-500
">
                                            Inactive
                                        </p>

                                        <p className="
mt-2 text-lg
font-bold text-rose-500
">
                                            {
                                                filteredStudents.filter(
                                                    (s) => {

                                                        const id =
                                                            s.student?.id;

                                                        return (
                                                            id &&
                                                            progressMap[
                                                            id
                                                            ] === undefined
                                                        );
                                                    }
                                                ).length
                                            }
                                        </p>
                                    </div>

                                    <div className="
rounded-xl border
px-4 py-3
">
                                        <p className="
text-xs uppercase
text-gray-500
">
                                            Affiliations
                                        </p>

                                        <p className="
mt-2 text-lg
font-bold
">
                                            {
                                                studentAffiliations.length
                                            }
                                        </p>
                                    </div>

                                </div>
                            </div>

                            {/* TABLE */}
                            <div className="
max-h-[520px]
overflow-y-auto
">

                                {loadingStudents ? (

                                    <p className="
text-sm text-gray-500
">
                                        Loading students...
                                    </p>

                                ) : (

                                    <>

                                        {/* CONTROLS */}
                                        <div className="
mb-4 flex flex-wrap
items-end justify-between
gap-4
">

                                            {/* LEFT */}
                                            <div className="
        flex flex-wrap
        items-end gap-3
    ">

                                                {/* AFFILIATION */}
                                                <div className="
            flex flex-col gap-1
        ">
                                                    <label className="
                text-xs font-medium
                text-gray-500
            ">
                                                        Affiliation
                                                    </label>

                                                    <select
                                                        value={
                                                            studentAffiliationFilter
                                                        }
                                                        onChange={(e) =>
                                                            setStudentAffiliationFilter(
                                                                e.target.value
                                                            )
                                                        }
                                                        className="
                    rounded-lg border
                    px-3 py-2 text-sm
                "
                                                    >
                                                        <option value="all">
                                                            All
                                                        </option>

                                                        {studentAffiliations.map(
                                                            (a) => (
                                                                <option
                                                                    key={a}
                                                                    value={a}
                                                                >
                                                                    {a}
                                                                </option>
                                                            )
                                                        )}
                                                    </select>
                                                </div>

                                                {/* ACTIVITY */}
                                                <div className="
            flex flex-col gap-1
        ">
                                                    <label className="
                text-xs font-medium
                text-gray-500
            ">
                                                        Activity
                                                    </label>

                                                    <select
                                                        value={
                                                            studentActivityFilter
                                                        }
                                                        onChange={(e) =>
                                                            setStudentActivityFilter(
                                                                e.target.value
                                                            )
                                                        }
                                                        className="
                    rounded-lg border
                    px-3 py-2 text-sm
                "
                                                    >
                                                        <option value="all">
                                                            All
                                                        </option>

                                                        <option value="active">
                                                            Active
                                                        </option>

                                                        <option value="inactive">
                                                            Inactive
                                                        </option>
                                                    </select>
                                                </div>

                                                {/* SORT */}
                                                <div className="
            flex flex-col gap-1
        ">
                                                    <label className="
                text-xs font-medium
                text-gray-500
            ">
                                                        Sort By
                                                    </label>

                                                    <select
                                                        value={studentSortBy}
                                                        onChange={(e) =>
                                                            setStudentSortBy(
                                                                e.target.value
                                                            )
                                                        }
                                                        className="
                    rounded-lg border
                    px-3 py-2 text-sm
                "
                                                    >
                                                        <option value="email">
                                                            Email
                                                        </option>

                                                        <option value="progress">
                                                            Latest
                                                        </option>

                                                        <option value="attempts">
                                                            Attempts
                                                        </option>

                                                        <option value="joined">
                                                            Joined
                                                        </option>
                                                    </select>
                                                </div>

                                                {/* ORDER */}
                                                <div className="
            flex flex-col gap-1
        ">
                                                    <label className="
                text-xs font-medium
                text-gray-500
            ">
                                                        Order
                                                    </label>

                                                    <select
                                                        value={
                                                            studentSortOrder
                                                        }
                                                        onChange={(e) =>
                                                            setStudentSortOrder(
                                                                e.target.value as
                                                                "asc" | "desc"
                                                            )
                                                        }
                                                        className="
                    rounded-lg border
                    px-3 py-2 text-sm
                "
                                                    >
                                                        <option value="asc">
                                                            Ascending
                                                        </option>

                                                        <option value="desc">
                                                            Descending
                                                        </option>
                                                    </select>
                                                </div>

                                                {/* RESET */}
                                                <div className="
            flex flex-col gap-1
        ">
                                                    <label className="
                text-xs opacity-0
            ">
                                                        reset
                                                    </label>

                                                    <button
                                                        onClick={() => {

                                                            setStudentAffiliationFilter(
                                                                "all"
                                                            );

                                                            setStudentActivityFilter(
                                                                "all"
                                                            );

                                                            setStudentSortBy(
                                                                "email"
                                                            );

                                                            setStudentSortOrder(
                                                                "asc"
                                                            );

                                                            setStudentStartDate(
                                                                null
                                                            );

                                                            setStudentEndDate(
                                                                null
                                                            );
                                                        }}

                                                        className="
                    rounded-lg border
                    px-4 py-2 text-sm
                    transition
                    hover:bg-gray-50
                "
                                                    >
                                                        Reset
                                                    </button>
                                                </div>

                                            </div>

                                            {/* RIGHT */}
                                            <div>

                                                <button
                                                    disabled={
                                                        selectedStudents.length === 0
                                                    }

                                                    onClick={() => {

                                                        const selected =
                                                            filteredStudents.filter(
                                                                (s) =>

                                                                    s.student?.id &&

                                                                    selectedStudents.includes(
                                                                        s.student.id
                                                                    )
                                                            );

                                                        exportClassMembers(
                                                            selected
                                                        );
                                                    }}

                                                    className="
        rounded-xl
        bg-green-500
        px-4 py-2.5
        text-sm font-medium
        text-white
        transition

        hover:bg-green-600

        disabled:cursor-not-allowed
        disabled:opacity-50
    "
                                                >
                                                    Export (
                                                    {
                                                        selectedStudents.length
                                                    }
                                                    )
                                                </button>

                                            </div>

                                        </div>

                                        {/* TABLE */}
                                        <table className="
min-w-full
">

                                            <thead className="
sticky top-0 z-10
bg-white
">

                                                <tr className="
border-b border-gray-200
">

                                                    <th className="
px-4 py-3 text-left
">
                                                        <input
                                                            type="checkbox"

                                                            checked={
                                                                allStudentsSelected
                                                            }

                                                            onChange={(e) => {

                                                                e.stopPropagation();

                                                                if (e.target.checked) {

                                                                    setSelectedStudents(
                                                                        filteredStudents
                                                                            .map((s) => s.student?.id)
                                                                            .filter(Boolean)
                                                                    );

                                                                } else {

                                                                    setSelectedStudents(
                                                                        []
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                    </th>

                                                    <th className="
px-4 py-3 text-left
text-xs font-medium
text-gray-500
">
                                                        Email
                                                    </th>

                                                    <th className="
px-4 py-3 text-left
text-xs font-medium
text-gray-500
">
                                                        Affiliation
                                                    </th>

                                                    <th className="
px-4 py-3 text-left
text-xs font-medium
text-gray-500
">
                                                        Latest
                                                    </th>

                                                    <th className="
px-4 py-3 text-left
text-xs font-medium
text-gray-500
">
                                                        Attempts
                                                    </th>

                                                    <th className="
px-4 py-3 text-left
text-xs font-medium
text-gray-500
">
                                                        Joined
                                                    </th>

                                                </tr>
                                            </thead>

                                            <tbody>

                                                {filteredStudents.length === 0 ? (

                                                    <tr>

                                                        <td
                                                            colSpan={6}
                                                            className="
px-4 py-10 text-center
text-sm text-gray-500
"
                                                        >
                                                            No students found.
                                                        </td>

                                                    </tr>

                                                ) : (

                                                    filteredStudents.map(
                                                        (item) => {

                                                            const student =
                                                                item.student;

                                                            if (!student) {
                                                                return null;
                                                            }

                                                            return (

                                                                <tr
                                                                    key={`${item.student?.id}-${item.joined_at}`}
                                                                    className="
border-b
border-gray-100
"
                                                                >

                                                                    <td className="
px-4 py-3
">

                                                                        <input
                                                                            type="checkbox"

                                                                            checked={
                                                                                selectedStudents.includes(
                                                                                    student.id
                                                                                )
                                                                            }

                                                                            onChange={(e) => {

                                                                                if (
                                                                                    e.target.checked
                                                                                ) {

                                                                                    setSelectedStudents(
                                                                                        (prev) => [
                                                                                            ...prev,
                                                                                            student.id,
                                                                                        ]
                                                                                    );

                                                                                } else {

                                                                                    setSelectedStudents(
                                                                                        (prev) =>
                                                                                            prev.filter(
                                                                                                (id) =>
                                                                                                    id !==
                                                                                                    student.id
                                                                                            )
                                                                                    );
                                                                                }
                                                                            }}
                                                                        />
                                                                    </td>

                                                                    <td className="
px-4 py-3 text-sm
font-medium
">
                                                                        {student.email}
                                                                    </td>

                                                                    <td className="
px-4 py-3 text-sm
text-gray-500
">
                                                                        {
                                                                            student.affiliation
                                                                            || "-"
                                                                        }
                                                                    </td>

                                                                    <td className="
px-4 py-3 text-sm
font-semibold
">
                                                                        {
                                                                            progressMap[
                                                                            student.id
                                                                            ] ?? "-"
                                                                        }
                                                                    </td>

                                                                    <td className="
px-4 py-3 text-sm
">
                                                                        {
                                                                            attemptCounts[
                                                                            student.id
                                                                            ] || 0
                                                                        }
                                                                    </td>

                                                                    <td className="
px-4 py-3 text-sm
text-gray-500
">
                                                                        {
                                                                            item.joined_at
                                                                                ? new Date(
                                                                                    item.joined_at
                                                                                ).toLocaleDateString()
                                                                                : "-"
                                                                        }
                                                                    </td>

                                                                </tr>
                                                            );
                                                        }
                                                    )
                                                )}

                                            </tbody>
                                        </table>

                                    </>
                                )}
                            </div>

                        </div>
                    </div>
                )}
        </section>
    );
}