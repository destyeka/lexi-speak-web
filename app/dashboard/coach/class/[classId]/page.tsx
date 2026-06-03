"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AnalysisCard } from "@/components/ui/system/AnalysisCard";
import { generateSessionCode } from "@/lib/generateSessionCode";
import { InputField } from "@/components/ui/system/InputField";
import TextButton from "@/components/ui/system/TextButton";
import { Toggle } from "@/components/ui/system/Toggle";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import TextArea from "@/components/form/input/TextArea";
import DatePicker from "@/components/form/date-picker";
import { PencilLineIcon, EyeIcon, PlusIcon, UsersIcon } from "@phosphor-icons/react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Assignment {
  id: string;
  class_id: string;
  part: number;
  title: string;
  prompt: string;
  description: string | null;
  start_at: string | null;
  due_at: string | null;
  is_active: boolean;
  created_at: string | null;
}

interface Question {
  id: string;
  type?: "question" | "bullet" | string;
  content: string;
  prompt?: string;
  order_index: number;
  rubric?: string;
}

interface QuestionBankDetail {
  type: "question" | "bullet";
  content: string;
  prompt?: string;
  rubric?: string;
  order_index: number;
}

interface QuestionBankGroup {
  topic_code: string;
  title: string;
  is_public: boolean;
  created_by: string | null;
  created_at: string | null;
  parts: Array<{
    id: string;
    part: number;
    title: string;
    prompt?: string | null;
    details: QuestionBankDetail[];
  }>;
}

interface StudentStatus {
  student_id: string;
  email: string;
  status: string;
  submitted_at: string | null;
  latest_score: number | null;
  metrics?: any[];
  analysis?: any;
  notes?: string | null;
}

interface ClassMemberSummary {
  id: string;
  email: string;
  name: string;
  latest_score: number | null;
}

interface ScoreHistoryRow {
  student_id: string;
  score: number;
  recorded_at: string;
}

interface SubmissionRow {
  student_id: string;
  assignment_id: string;
  submitted_at: string | null;
  score?: number | null;
  metrics?: any;
  analysis?: any;
}

const formatBand = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const normalized = value > 9.5 ? value / 10 : value;
  return Math.max(0, Math.min(9, Number(normalized.toFixed(1))));
};

const getCurrentLevelLabel = (band: number | null) => {
  if (band === null) return "-";
  if (band < 3.5) return "A2 (Elementary)";
  if (band < 4.5) return "B1 (Intermediate)";
  if (band < 5.5) return "B1+ (Upper Beginner)";
  if (band < 6.5) return "B2 (Upper-Intermediate)";
  if (band < 7.5) return "C1 (Advanced)";
  return "C1+ (Advanced)";
};

export default function ClassAssignmentsPage() {
  const params = useParams() as { classId?: string };
  const router = useRouter();
  const classId = params.classId;

  const [className, setClassName] = useState("");
  const [classDescription, setClassDescription] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedAssignmentForStatus, setSelectedAssignmentForStatus] = useState<Assignment | null>(null);
  const [studentStatuses, setStudentStatuses] = useState<StudentStatus[]>([]);
  const [selectedSummaryStatus, setSelectedSummaryStatus] = useState<StudentStatus | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [classMembers, setClassMembers] = useState<ClassMemberSummary[]>([]);
  const [scoreHistoryRows, setScoreHistoryRows] = useState<ScoreHistoryRow[]>([]);
  const [submissionRows, setSubmissionRows] = useState<SubmissionRow[]>([]);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const { isOpen: isReportModalOpen, openModal: openReportModal, closeModal: closeReportModal } = useModal(false);
  const [selectedReportStudentId, setSelectedReportStudentId] = useState<string>("");
  const [currentTime] = useState(() => Date.now());

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPart, setEditPart] = useState(1);
  const [editStartAt, setEditStartAt] = useState("");
  const [editStartTime, setEditStartTime] = useState("00:00");
  const [editDueAt, setEditDueAt] = useState("");
  const [editDueTime, setEditDueTime] = useState("23:59");
  const [editActive, setEditActive] = useState(true);
  const [editQuestions, setEditQuestions] = useState<Question[]>([]);

  const [isAssignmentFlowOpen, setIsAssignmentFlowOpen] = useState(false);
  const [assignmentFlowStep, setAssignmentFlowStep] = useState<"chooseSource" | "selectBank" | "schedule" | "createBank">("chooseSource");
  const [questionBanks, setQuestionBanks] = useState<QuestionBankGroup[]>([]);
  const [selectedBank, setSelectedBank] = useState<QuestionBankGroup | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [bankRequestMessage, setBankRequestMessage] = useState<string | null>(null);
  const [bankSearchTerm, setBankSearchTerm] = useState("");

  const [scheduleStartAt, setScheduleStartAt] = useState("");
  const [scheduleStartTime, setScheduleStartTime] = useState("00:00");
  const [scheduleDueAt, setScheduleDueAt] = useState("");
  const [scheduleDueTime, setScheduleDueTime] = useState("23:59");

  const [createBankName, setCreateBankName] = useState("");
  const [createBankDescription, setCreateBankDescription] = useState("");
  const [createBankActive, setCreateBankActive] = useState(true);
  const [createBankCategory, setCreateBankCategory] = useState("education");
  const [createBankParts, setCreateBankParts] = useState<
    Array<{
      part: number;
      title: string;
      prompt: string;
      details: QuestionBankDetail[];
    }>
  >([
    {
      part: 1,
      title: "",
      prompt: "",
      details: [
        { type: "question", content: "", prompt: "", rubric: "", order_index: 0 },
        { type: "question", content: "", prompt: "", rubric: "", order_index: 1 },
        { type: "question", content: "", prompt: "", rubric: "", order_index: 2 },
      ],
    },
    {
      part: 2,
      title: "",
      prompt: "",
      details: [
        { type: "question", content: "", prompt: "", rubric: "", order_index: 0 },
        { type: "bullet", content: "", order_index: 1 },
        { type: "bullet", content: "", order_index: 2 },
        { type: "bullet", content: "", order_index: 3 },
      ],
    },
    {
      part: 3,
      title: "",
      prompt: "",
      details: [
        { type: "question", content: "", prompt: "", rubric: "", order_index: 0 },
        { type: "question", content: "", prompt: "", rubric: "", order_index: 1 },
        { type: "question", content: "", prompt: "", rubric: "", order_index: 2 },
      ],
    },
  ]);

  function formatLocalDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function toLocalDate(dateString: string) {
    const [year, month, day] = dateString.split("-").map(Number);
    if (!year || !month || !day) return undefined;
    return new Date(year, month - 1, day);
  }

  const handleEditDueAtChange = useCallback(([selected]: Date[]) => {
    setEditDueAt(selected ? formatLocalDate(selected) : "");
  }, []);

  const handleEditStartAtChange = useCallback(([selected]: Date[]) => {
    setEditStartAt(selected ? formatLocalDate(selected) : "");
  }, []);

  const dateTimeToIso = (dateString: string, timeString: string) => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split("-").map(Number);
    const [hours, minutes] = timeString.split(":").map(Number);
    if (!year || !month || !day || hours === undefined || minutes === undefined) return null;
    const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return date.toISOString();
  };

  const validateAssignmentDates = (startAt: string | null, dueAt: string | null) => {
    if (!startAt || !dueAt) return null;
    if (new Date(dueAt).getTime() < new Date(startAt).getTime()) {
      return "Due date & time cannot be earlier than the start date & time.";
    }
    return null;
  };

  const buildQuestionsForPart = (part: number) => {
    if (part === 2) {
      return [
        { id: crypto.randomUUID(), type: "question", content: "", prompt: "", order_index: 0, rubric: "" },
        { id: crypto.randomUUID(), type: "bullet", content: "", prompt: "", order_index: 1, rubric: "" },
        { id: crypto.randomUUID(), type: "bullet", content: "", prompt: "", order_index: 2, rubric: "" },
        { id: crypto.randomUUID(), type: "bullet", content: "", prompt: "", order_index: 3, rubric: "" },
      ];
    }

    const count = part === 1 ? 3 : 3;
    return Array.from({ length: count }, (_, index) => ({
      id: crypto.randomUUID(),
      type: "question",
      content: "",
      prompt: "",
      order_index: index,
      rubric: "",
    }));
  };

  const loadQuestionBanks = useCallback(async () => {
    setIsLoadingBanks(true);
    setBankRequestMessage(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setBankRequestMessage("Silakan login ulang untuk memuat question bank.");
      setIsLoadingBanks(false);
      return;
    }

    // Query dari session_units dulu, dengan filter public atau created by user
    const selectStatement = `
      id,
      session_code,
      title,
      description,
      is_public,
      created_by,
      created_at,
      topics(
        id,
        unit_id,
        topic_code,
        part,
        title,
        prompt,
        is_active,
        created_at,
        created_by,
        topic_details(id, type, content, prompt, rubric, order_index)
      )
    `;

    const { data: unitsData, error: unitsError } = await supabase
      .from("session_units")
      .select(selectStatement)
      .order("created_at", { ascending: false });

    if (unitsError) {
      console.error("Error fetching question banks:", unitsError);
      setBankRequestMessage(unitsError.message || "Gagal memuat question bank.");
      setIsLoadingBanks(false);
      return;
    }

    type UnitRow = {
      id: string;
      session_code: string | null;
      title: string;
      description: string | null;
      is_public: boolean;
      created_by: string | null;
      created_at: string | null;
      topics: Array<{
        id: string;
        unit_id: string | null;
        topic_code: string | null;
        part: number;
        title: string;
        prompt: string | null;
        is_active: boolean;
        created_at: string | null;
        created_by: string | null;
        topic_details: Array<{
          id: string;
          type: "question" | "bullet" | string;
          content: string;
          prompt: string | null;
          rubric: string | null;
          order_index: number;
        }> | null;
      }> | null;
    };

    const units = ((unitsData as UnitRow[] | null) ?? []);

    setCurrentUserId(user.id);

    const bankMap = new Map<string, QuestionBankGroup>();
    units.forEach((unit) => {
      const code = unit.session_code || unit.id;
      const topics = unit.topics ?? [];

      const parts = topics
        .sort((a, b) => a.part - b.part)
        .map((topic) => {
          const detailRows = (topic.topic_details ?? []).map((detail) => ({
            type: detail.type as "question" | "bullet",
            content: detail.content,
            prompt: detail.prompt ?? undefined,
            rubric: detail.rubric ?? undefined,
            order_index: detail.order_index,
          }));

          return {
            id: topic.id,
            part: topic.part,
            title: topic.title,
            prompt: topic.prompt,
            details: detailRows.sort((a, b) => a.order_index - b.order_index),
          };
        });

      bankMap.set(code, {
        topic_code: code,
        title: unit.title || `Bank ${code}`,
        is_public: unit.is_public,
        created_by: unit.created_by,
        created_at: unit.created_at,
        parts,
      });
    });

    const banks = Array.from(bankMap.values());
    setQuestionBanks(banks);
    setIsLoadingBanks(false);
  }, []);

  const handleOpenScheduleForBank = (bank: QuestionBankGroup) => {
    setSelectedBank(bank);
    setBankRequestMessage(null);
    setScheduleStartAt("");
    setScheduleStartTime("00:00");
    setScheduleDueAt("");
    setScheduleDueTime("23:59");
    setAssignmentFlowStep("schedule");
  };

  const handleCreateBank = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("Silakan login ulang untuk membuat question bank.");
      return;
    }

    if (!createBankName.trim()) {
      alert("Nama question bank harus diisi.");
      return;
    }

    const sessionType = "practice";

    const systemCategoryMap: Record<string, string> = {
      music: "MUS",
      identity: "IDN",
      education: "EDU",
      culinary: "CUL",
      travel: "TRV",
      art: "ART",
      sports: "SPT",
      technology: "TEC",
      health: "HLT",
      business: "BUS",
    };

    const category = createBankCategory || "education";
    let categoryCode = systemCategoryMap[category] || null;
    if (!categoryCode) {
      categoryCode = category.trim().toUpperCase().slice(0, 3) || "EDU";
    }

    const { sessionCode, seq } = await generateSessionCode({
      session: sessionType,
      category,
      categoryCode,
    });

    const bankTitle = createBankName.trim();

    const {
      data: sessionData,
      error: sessionError,
    } = await supabase
      .from("session_units")
      .insert({
        session_code: sessionCode,
        seq,
        category,
        category_code: categoryCode,
        type: sessionType,
        title: bankTitle,
        description: createBankDescription || bankTitle,
        access_level: "free",
        is_active: createBankActive,
        is_public: false,
        created_by: user.id,
      })
      .select()
      .single();

    if (sessionError || !sessionData) {
      console.error("Error creating shared session unit:", sessionError);
      alert(sessionError?.message || "Gagal membuat question bank.");
      return;
    }

    const topicInsertRows = createBankParts.map((part) => ({
      unit_id: sessionData.id,
      topic_code: sessionData.session_code,
      category,
      category_code: categoryCode,
      session: sessionType,
      part: part.part,
      title: part.title || `${bankTitle} Part ${part.part}`,
      prompt: part.prompt || "",
      is_active: createBankActive,
      created_by: user.id,
      is_public: false,
    }));

    const { data: insertedTopics, error: topicError } = await supabase
      .from("topics")
      .insert(topicInsertRows)
      .select("id, part");

    if (topicError || !insertedTopics) {
      console.error("Error creating question bank topics:", topicError);
      alert(topicError?.message || "Gagal membuat question bank.");
      return;
    }

    const topicMap = new Map<number, string>();
    (insertedTopics as { id: string; part: number }[]).forEach((topic) => {
      topicMap.set(topic.part, topic.id);
    });

    const detailRows = createBankParts.flatMap((part) =>
      part.details.map((detail) => ({
        topic_id: topicMap.get(part.part),
        type: detail.type,
        content: detail.content,
        rubric: detail.rubric,
        prompt: detail.prompt,
        order_index: detail.order_index,
      }))
    );

    const { error: detailError } = await supabase.from("topic_details").insert(detailRows);
    if (detailError) {
      console.error("Error saving question bank details:", detailError);
      alert(detailError.message || "Gagal menyimpan detail question bank.");
      return;
    }

    // Create local bank data for immediate display
    const selectedBankData = {
      topic_code: sessionData.session_code,
      title: bankTitle,
      is_public: false,
      created_by: user.id,
      created_at: sessionData.created_at || new Date().toISOString(),
      parts: createBankParts.map((part) => ({
        id: topicMap.get(part.part) ?? "",
        part: part.part,
        title: part.title || `${bankTitle} Part ${part.part}`,
        prompt: part.prompt,
        details: part.details,
      })),
    };

    // Set the created bank as selected bank
    setSelectedBank(selectedBankData);

    // Reload all banks from database to ensure it appears in the list
    await loadQuestionBanks();

    // Reset the create bank form
    setCreateBankName("");
    setCreateBankDescription("");
    setCreateBankActive(true);
    setCreateBankParts([
      {
        part: 1,
        title: "",
        prompt: "",
        details: [
          { type: "question", content: "", prompt: "", rubric: "", order_index: 0 },
          { type: "question", content: "", prompt: "", rubric: "", order_index: 1 },
          { type: "question", content: "", prompt: "", rubric: "", order_index: 2 },
        ],
      },
      {
        part: 2,
        title: "",
        prompt: "",
        details: [
          { type: "question", content: "", prompt: "", rubric: "", order_index: 0 },
          { type: "bullet", content: "", prompt: "", rubric: "", order_index: 1 },
          { type: "bullet", content: "", prompt: "", rubric: "", order_index: 2 },
          { type: "bullet", content: "", prompt: "", rubric: "", order_index: 3 },
        ],
      },
      {
        part: 3,
        title: "",
        prompt: "",
        details: [
          { type: "question", content: "", prompt: "", rubric: "", order_index: 0 },
          { type: "question", content: "", prompt: "", rubric: "", order_index: 1 },
          { type: "question", content: "", prompt: "", rubric: "", order_index: 2 },
        ],
      },
    ]);

    // Move to schedule step (bank is ready to use for assignment)
    setAssignmentFlowStep("schedule");
  };

  const handleCreateAssignmentFromBank = async () => {
    if (!selectedBank) return;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("Silakan login ulang untuk membuat assignment.");
      return;
    }

    const startAtValue = dateTimeToIso(scheduleStartAt, scheduleStartTime);
    const dueAtValue = dateTimeToIso(scheduleDueAt, scheduleDueTime);
    const validationError = validateAssignmentDates(startAtValue, dueAtValue);
    if (validationError) {
      alert(validationError);
      return;
    }

    const { data, error } = await supabase
      .from("assignments")
      .insert({
        class_id: classId,
        coach_id: user.id,
        part: 1,
        title: selectedBank.title,
        description: selectedBank.title,
        start_at: startAtValue,
        due_at: dueAtValue,
        is_active: true,
      })
      .select()
      .single();

    if (error || !data) {
      alert(error?.message || "Failed to create assignment.");
      return;
    }

    const questionRows = selectedBank.parts.flatMap((part) =>
      part.details.map((detail) => ({
        assignment_id: data.id,
        topic_id: part.id,
        part: part.part,
        content: detail.content,
        prompt: detail.type === "question" ? detail.prompt ?? "" : "",
        type: detail.type,
        order_index: detail.order_index,
        rubric: detail.type === "question" ? detail.rubric ?? "" : "",
      }))
    );

    const { error: questionError } = await supabase.from("assignment_questions").insert(questionRows);
    if (questionError) {
      console.error("Error saving assignment questions:", questionError);
      alert(`Failed to save assignment questions: ${questionError.message}`);
      return;
    }

    setIsAssignmentFlowOpen(false);
    setAssignmentFlowStep("chooseSource");
    setSelectedBank(null);
    setScheduleStartAt("");
    setScheduleStartTime("00:00");
    setScheduleDueAt("");
    setScheduleDueTime("23:59");
    await fetchAssignments();
  };

  const bankHasAllParts = (bank: QuestionBankGroup) => {
    const parts = new Set(bank.parts.map((part) => part.part));
    return parts.has(1) && parts.has(2) && parts.has(3);
  };

  const clearCreateBankForm = () => {
    setCreateBankName("");
    setCreateBankDescription("");
    setCreateBankActive(true);
    setCreateBankParts([
      {
        part: 1,
        title: "",
        prompt: "",
        details: [
          { type: "question", content: "", prompt: "", rubric: "", order_index: 0 },
          { type: "question", content: "", prompt: "", rubric: "", order_index: 1 },
          { type: "question", content: "", prompt: "", rubric: "", order_index: 2 },
        ],
      },
      {
        part: 2,
        title: "",
        prompt: "",
        details: [
          { type: "question", content: "", prompt: "", rubric: "", order_index: 0 },
          { type: "bullet", content: "", prompt: "", rubric: "", order_index: 1 },
          { type: "bullet", content: "", prompt: "", rubric: "", order_index: 2 },
          { type: "bullet", content: "", prompt: "", rubric: "", order_index: 3 },
        ],
      },
      {
        part: 3,
        title: "",
        prompt: "",
        details: [
          { type: "question", content: "", prompt: "", rubric: "", order_index: 0 },
          { type: "question", content: "", prompt: "", rubric: "", order_index: 1 },
          { type: "question", content: "", prompt: "", rubric: "", order_index: 2 },
        ],
      },
    ]);
  };

  const openAssignmentFlow = async () => {
    setIsAssignmentFlowOpen(true);
    setAssignmentFlowStep("chooseSource");
    await loadQuestionBanks();
  };

  const closeAssignmentFlow = () => {
    setIsAssignmentFlowOpen(false);
    setAssignmentFlowStep("chooseSource");
    setSelectedBank(null);
    setBankSearchTerm("");
    setBankRequestMessage(null);
    clearCreateBankForm();
  };

  const fetchClassInfo = useCallback(async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("name, description")
      .eq("id", classId)
      .maybeSingle();

    if (!error && data) {
      setClassName(data.name);
      setClassDescription(data.description);
    }
  }, [classId]);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("assignments")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });

    if (error) {
      setNotice(error.message);
      setAssignments([]);
    } else {
      setAssignments((data as Assignment[]) || []);
    }
    setLoading(false);
  }, [classId]);

  const getStudentNameFromEmail = (email: string) => {
    if (!email) return "Unknown Student";
    return email
      .split("@")[0]
      .replace(/[._]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const fetchClassReportData = useCallback(async () => {
    setReportLoading(true);
    setReportNotice(null);

    if (!classId) {
      setReportLoading(false);
      return;
    }

    const { data: membersData, error: membersError } = await supabase
      .from("class_members")
      .select("student_id")
      .eq("class_id", classId);

    if (membersError) {
      setReportNotice(membersError.message);
      setClassMembers([]);
      setScoreHistoryRows([]);
      setReportLoading(false);
      return;
    }

    const studentIds = (membersData as { student_id: string }[] | null)
      ?.map((item) => item.student_id)
      .filter(Boolean) ?? [];

    if (studentIds.length === 0) {
      setClassMembers([]);
      setScoreHistoryRows([]);
      setReportNotice("No students are currently enrolled in this class.");
      setReportLoading(false);
      return;
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", studentIds);

    if (profilesError) {
      setReportNotice(profilesError.message);
      setClassMembers([]);
      setScoreHistoryRows([]);
      setReportLoading(false);
      return;
    }

    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from("assignments")
      .select("id")
      .eq("class_id", classId);

    if (assignmentsError) {
      setReportNotice(assignmentsError.message);
      setClassMembers([]);
      setScoreHistoryRows([]);
      setReportLoading(false);
      return;
    }

    const assignmentIds = ((assignmentsData as { id: string }[] | null) ?? [])
      .map((assignment) => assignment.id)
      .filter(Boolean);

    const { data: submissions, error: submissionsError } = await supabase
      .from("assignment_submissions")
      .select("student_id, assignment_id, submitted_at, score, metrics")
      .in("assignment_id", assignmentIds)
      .in("student_id", studentIds)
      .in("status", ["submitted", "complete"]);

    if (submissionsError) {
      setReportNotice(submissionsError.message);
      setClassMembers([]);
      setScoreHistoryRows([]);
      setSubmissionRows([]);
      setReportLoading(false);
      return;
    }

    const submissionList = (submissions ?? []) as SubmissionRow[];
    setSubmissionRows(submissionList);

    const { data: history, error: historyError } = await supabase
      .from("student_score_history")
      .select("student_id, score, recorded_at")
      .in("student_id", studentIds)
      .order("recorded_at", { ascending: true });

    if (historyError) {
      setReportNotice(historyError.message);
      setClassMembers([]);
      setScoreHistoryRows([]);
      setReportLoading(false);
      return;
    }

    const scoreHistoryByStudent = new Map<string, ScoreHistoryRow[]>();
    const historyRows = (history as ScoreHistoryRow[] | null) ?? [];
    historyRows.forEach((row: ScoreHistoryRow) => {
      if (!scoreHistoryByStudent.has(row.student_id)) {
        scoreHistoryByStudent.set(row.student_id, []);
      }
      scoreHistoryByStudent.get(row.student_id)?.push(row);
    });

    const getScoreForSubmission = (studentId: string, submittedAt: string | null) => {
      if (!submittedAt) return null;
      const rows = scoreHistoryByStudent.get(studentId) ?? ([] as ScoreHistoryRow[]);
      let latestRow: ScoreHistoryRow | null = null;
      const submittedTime = new Date(submittedAt).getTime();
      rows.forEach((row: ScoreHistoryRow) => {
        const recordedTime = new Date(row.recorded_at).getTime();
        if (recordedTime <= submittedTime) {
          if (!latestRow || recordedTime > new Date(latestRow.recorded_at).getTime()) {
            latestRow = row;
          }
        }
      });
      return latestRow ? Number((latestRow as ScoreHistoryRow).score) : null;
    };

    const submissionScoreRows: ScoreHistoryRow[] = submissionList
      .map((submission: SubmissionRow) => {
        // Prefer explicit score stored on the submission; fallback to history lookup
        const explicitScore = (submission as SubmissionRow & { score?: number }).score;
        if (explicitScore !== undefined && explicitScore !== null) {
          return {
            student_id: submission.student_id,
            score: Number(explicitScore),
            recorded_at: submission.submitted_at || new Date().toISOString(),
          };
        }
        const score = getScoreForSubmission(submission.student_id, submission.submitted_at);
        if (score === null) return null;
        return {
          student_id: submission.student_id,
          score,
          recorded_at: submission.submitted_at || new Date().toISOString(),
        };
      })
      .filter((row): row is ScoreHistoryRow => row !== null);

    const latestSubmissionScoreByStudent = new Map<string, ScoreHistoryRow>();
    submissionScoreRows.forEach((row) => {
      const existing = latestSubmissionScoreByStudent.get(row.student_id);
      if (!existing || new Date(row.recorded_at) > new Date(existing.recorded_at)) {
        latestSubmissionScoreByStudent.set(row.student_id, row);
      }
    });

    setClassMembers(
      ((profiles as { id: string; email: string }[] | null) ?? []).map((profile) => ({
        id: profile.id,
        email: profile.email,
        name: getStudentNameFromEmail(profile.email || ""),
        latest_score: latestSubmissionScoreByStudent.get(profile.id)?.score ?? null,
      }))
    );

    setScoreHistoryRows(submissionScoreRows);
    if (!submissionScoreRows.length) {
      setReportNotice("No submitted assignment history is available for this class yet.");
    }
    setReportLoading(false);
  }, [classId]);

  const initialize = useCallback(async () => {
    setLoading(true);
    setNotice(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: me, error: roleError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (roleError || me?.role !== "guru") {
      router.push("/dashboard");
      return;
    }

    await fetchClassInfo();
    await fetchAssignments();
    await fetchClassReportData();
    setLoading(false);
  }, [router, fetchClassInfo, fetchAssignments, fetchClassReportData]);

  useEffect(() => {
    if (!classId) {
      router.push("/dashboard/coach/class");
      return;
    }

    const timeout = window.setTimeout(() => {
      void initialize();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [initialize, classId, router]);

  const fetchAssignmentQuestions = async (assignment: Assignment) => {
    const { data, error } = await supabase
      .from("assignment_questions")
      .select("*")
      .eq("assignment_id", assignment.id)
      .order("order_index", { ascending: true });

    if (!error) {
      setSelectedQuestions((data as Question[]) || []);
    } else {
      setSelectedQuestions([]);
    }
  };

  const reportRows = useMemo(() => {
    if (selectedReportStudentId) {
      return scoreHistoryRows
        .filter((row) => row.student_id === selectedReportStudentId)
        .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    }

    return [...scoreHistoryRows].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );
  }, [scoreHistoryRows, selectedReportStudentId]);

  const classReportSeries = useMemo(() => {
    const scoreByDate = new Map<string, { total: number; count: number }>();

    reportRows.forEach((row) => {
      const dateKey = new Date(row.recorded_at).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
      });

      const existing = scoreByDate.get(dateKey) ?? { total: 0, count: 0 };
      scoreByDate.set(dateKey, {
        total: existing.total + Number(row.score),
        count: existing.count + 1,
      });
    });

    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 29);

    const categories: string[] = [];
    const averageData: Array<number | null> = [];
    const dailyCounts: number[] = [];

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateKey = date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
      });
      categories.push(dateKey);

      const item = scoreByDate.get(dateKey);
      if (item?.count) {
        averageData.push(Math.round((item.total / item.count) * 10) / 10);
        dailyCounts.push(item.count);
      } else {
        averageData.push(null);
        dailyCounts.push(0);
      }
    }

    const seriesName = selectedReportStudentId ? "Student score" : "Class average";

    return {
      categories,
      dailyCounts,
      series: [{ name: seriesName, data: averageData }],
    };
  }, [reportRows, selectedReportStudentId]);

  const classReportOptions = useMemo<ApexOptions>(() => ({
    chart: {
      id: "class-score-trend",
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    stroke: { curve: "smooth", width: 3 },
    markers: { size: 0 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: classReportSeries.categories,
      labels: { style: { colors: "#6b7280", fontSize: "12px" } },
    },
    yaxis: selectedReportStudentId
      ? {
          min: 0,
          max: 9,
          tickAmount: 10,
          labels: { formatter: (value) => `${Math.round(value * 10) / 10}` },
        }
      : {
          title: { text: "Avg score", style: { color: "#2563eb" } },
          min: 0,
          max: 9,
          tickAmount: 10,
          labels: { formatter: (value) => `${Math.round(value * 10) / 10}` },
        },
    grid: { strokeDashArray: 3, borderColor: "#e5e7eb" },
    tooltip: {
      theme: "light",
      x: { format: "dd MMM" },
      y: {
        formatter: (value: any, options: any) => {
          const dataPointIndex = options?.dataPointIndex;
          const attempts = classReportSeries.dailyCounts?.[dataPointIndex];
          const averageValue = `${Math.round(Number(value) * 10) / 10}`;
          return attempts !== undefined
            ? `${averageValue}\nTotal attempts: ${attempts}`
            : averageValue;
        },
      },
    },
  }), [classReportSeries.categories, classReportSeries.dailyCounts, selectedReportStudentId]);

  const selectedReportStudent = useMemo(
    () => classMembers.find((member) => member.id === selectedReportStudentId) || null,
    [classMembers, selectedReportStudentId]
  );

  const studentSelectOptions = useMemo(
    () => classMembers.map((member) => ({
      value: member.id,
      label: `${member.name} (${member.email})`,
    })),
    [classMembers]
  );

  const reportTitle = selectedReportStudent
    ? `Student Progress Report – ${selectedReportStudent.name}`
    : "Class Progress Report";

  const reportSummary = useMemo(() => {
    const studentScores = reportRows.map((row) => Number(row.score));
    const averageFromCurrentChart = studentScores.length
      ? Math.round((studentScores.reduce((sum, score) => sum + score, 0) / studentScores.length) * 10) / 10
      : null;

    const classScoreRows = !selectedReportStudentId ? reportRows : [];
    const averageScore = selectedReportStudentId
      ? averageFromCurrentChart
      : classScoreRows.length
      ? Math.round((classScoreRows.reduce((sum, row) => sum + Number(row.score), 0) / classScoreRows.length) * 10) / 10
      : null;

    const assignmentCompletedCount = selectedReportStudentId
      ? submissionRows.filter((row) => row.student_id === selectedReportStudentId).length
      : submissionRows.length;

    const progressPercent = selectedReportStudentId
      ? assignments.length > 0
        ? Math.round((assignmentCompletedCount / assignments.length) * 100)
        : null
      : classMembers.length > 0 && assignments.length > 0
        ? Math.round((assignmentCompletedCount / (assignments.length * classMembers.length)) * 100)
        : null;

    const latestScoreAverage = selectedReportStudentId
      ? selectedReportStudent?.latest_score ?? null
      : (() => {
          const scores = classMembers
            .map((member) => member.latest_score)
            .filter((score): score is number => score !== null);
          if (!scores.length) return null;
          return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
        })();

    const estimatedBand = latestScoreAverage !== null ? formatBand(latestScoreAverage) : null;
    const currentLevel = getCurrentLevelLabel(estimatedBand);

    return {
      totalStudents: classMembers.length,
      averageScore,
      assignmentCompletedCount,
      progressPercent,
      currentLevel,
      estimatedBand,
    };
  }, [assignments.length, classMembers, reportRows, selectedReportStudent, selectedReportStudentId, submissionRows]);

  const handleSaveEdit = async () => {
    if (!editAssignment) return;

    const startAtValue = dateTimeToIso(editStartAt, editStartTime);
    const dueAtValue = dateTimeToIso(editDueAt, editDueTime);

    const validationError = validateAssignmentDates(startAtValue, dueAtValue);
    if (validationError) {
      alert(validationError);
      return;
    }

    const { error } = await supabase
      .from("assignments")
      .update({
        start_at: startAtValue,
        due_at: dueAtValue,
      })
      .eq("id", editAssignment.id);

    if (error) {
      alert(error.message);
      return;
    }

    setEditAssignment(null);
    setIsEditOpen(false);
    setEditQuestions([]);
    await fetchAssignments();
  };

  const handleDeleteAssignment = async () => {
    if (!editAssignment) return;
    const confirmed = confirm(
      "Are you sure you want to delete this assignment? This will remove the assignment and all related student submissions."
    );
    if (!confirmed) return;

    const assignmentId = editAssignment.id;

    const { error: deleteQuestionsError } = await supabase
      .from("assignment_questions")
      .delete()
      .eq("assignment_id", assignmentId);
    if (deleteQuestionsError) {
      console.error("Error deleting assignment questions:", deleteQuestionsError);
      alert(`Failed to delete assignment questions: ${deleteQuestionsError.message}`);
      return;
    }

    const { error: deleteSubmissionsError } = await supabase
      .from("assignment_submissions")
      .delete()
      .eq("assignment_id", assignmentId);
    if (deleteSubmissionsError) {
      console.error("Error deleting assignment submissions:", deleteSubmissionsError);
      alert(`Failed to delete assignment submissions: ${deleteSubmissionsError.message}`);
      return;
    }

    const { error: deleteAssignmentError } = await supabase
      .from("assignments")
      .delete()
      .eq("id", assignmentId);
    if (deleteAssignmentError) {
      console.error("Error deleting assignment:", deleteAssignmentError);
      alert(`Failed to delete assignment: ${deleteAssignmentError.message}`);
      return;
    }

    setEditAssignment(null);
    setEditQuestions([]);
    setIsEditOpen(false);
    await fetchAssignments();
    await fetchClassReportData();
  };

  const handleOpenEdit = async (assignment: Assignment) => {
    setEditAssignment(assignment);
    setEditTitle(assignment.title);
    setEditDescription(assignment.description || "");
    setEditPart(assignment.part ?? 1);
    
    if (assignment.start_at) {
      const startDate = new Date(assignment.start_at);
      setEditStartAt(formatLocalDate(startDate));
      setEditStartTime(`${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`);
    } else {
      setEditStartAt("");
      setEditStartTime("00:00");
    }
    
    if (assignment.due_at) {
      const dueDate = new Date(assignment.due_at);
      setEditDueAt(formatLocalDate(dueDate));
      setEditDueTime(`${String(dueDate.getHours()).padStart(2, "0")}:${String(dueDate.getMinutes()).padStart(2, "0")}`);
    } else {
      setEditDueAt("");
      setEditDueTime("23:59");
    }
    
    setEditActive(assignment.is_active);

    const { data, error } = await supabase
      .from("assignment_questions")
      .select("*")
      .eq("assignment_id", assignment.id)
      .order("order_index", { ascending: true });

    const questions = error ? [] : ((data as Question[]) || []);
    setEditQuestions(questions.length > 0 ? questions : buildQuestionsForPart(assignment.part ?? 1));
    setIsEditOpen(true);
  };

  const handleViewAssignment = async (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    await fetchAssignmentQuestions(assignment);
    setShowDetailModal(true);
  };

  const handleCheckStatus = async (assignment: Assignment) => {
    setSelectedAssignmentForStatus(assignment);
    setShowStatusModal(true);

    // Fetch class members
    const { data: members, error: membersError } = await supabase
      .from("class_members")
      .select("student_id")
      .eq("class_id", classId);

    if (membersError || !members) {
      console.error("Error fetching class members:", membersError);
      setStudentStatuses([]);
      return;
    }

    // Fetch student profiles and submissions
    const studentIds = members.map((m) => m.student_id).filter(Boolean) as string[];
    if (studentIds.length === 0) {
      console.warn("No students found for class", classId);
      setStudentStatuses([]);
      return;
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", studentIds);

    if (profilesError || !profiles) {
      console.error("Error fetching profiles:", profilesError);
      setStudentStatuses([]);
      return;
    }

    const fetchSubmissions = async (selectExpr: string) =>
      supabase
        .from("assignment_submissions")
        .select(selectExpr)
        .eq("assignment_id", assignment.id)
        .in("student_id", studentIds);

    let submissions: any[] | null = null;
    let submissionsError: any = null;

    ({ data: submissions, error: submissionsError } = await fetchSubmissions(
      "student_id, status, submitted_at, score, metrics, analysis"
    ));

    if (submissionsError) {
      console.error("Error fetching submissions:", submissionsError, {
        message: submissionsError?.message,
        code: submissionsError?.code,
      });

      const fallbackMessage = String(submissionsError?.message || "").toLowerCase();
      if (fallbackMessage.includes("analysis") || fallbackMessage.includes("column \"analysis\"") || fallbackMessage.includes("42703")) {
        const fallbackResult = await fetchSubmissions("student_id, status, submitted_at, score, metrics");
        submissions = fallbackResult.data as any[] | null;
        submissionsError = fallbackResult.error;
      }
    }

    if (submissionsError) {
      console.error("Error fetching submissions after fallback:", submissionsError);
      setStudentStatuses([]);
      return;
    }

    const { data: scoreRows, error: scoreError } = await supabase
      .from("student_score_history")
      .select("student_id, score, recorded_at")
      .in("student_id", studentIds)
      .order("recorded_at", { ascending: false });

    if (scoreError) {
      console.error("Error fetching score history:", scoreError);
    }

    const { data: progressRows, error: progressError } = await supabase
      .from("student_progress")
      .select("student_id, notes")
      .in("student_id", studentIds);

    if (progressError) {
      console.error("Error fetching student progress notes:", progressError);
    }

    const historyByStudent = new Map<string, ScoreHistoryRow[]>();
    (scoreRows as ScoreHistoryRow[] | null ?? []).forEach((row) => {
      if (!historyByStudent.has(row.student_id)) {
        historyByStudent.set(row.student_id, []);
      }
      historyByStudent.get(row.student_id)?.push(row);
    });

    const notesByStudent = new Map<string, string>();
    (progressRows as { student_id: string; notes: string | null }[] | null ?? []).forEach((row) => {
      if (row.notes) {
        notesByStudent.set(row.student_id, row.notes);
      }
    });

    const getScoreForSubmission = (studentId: string, submittedAt: string | null) => {
      const rows = historyByStudent.get(studentId) ?? [];
      if (rows.length === 0) return null;
      if (!submittedAt) {
        return Number(rows[0].score);
      }

      const submittedTime = new Date(submittedAt).getTime();
      const earlierScore = rows.find((row) => new Date(row.recorded_at).getTime() <= submittedTime);
      if (earlierScore) {
        return Number(earlierScore.score);
      }

      // If there is no earlier score row, use the closest later score row instead.
      const laterScore = rows.slice().reverse().find((row) => new Date(row.recorded_at).getTime() >= submittedTime);
      return laterScore ? Number(laterScore.score) : null;
    };

    const statuses: StudentStatus[] = profiles.map((profile) => {
      const submission = submissions?.find((s) => s.student_id === profile.id);
      const explicitScore = submission && submission.score !== undefined && submission.score !== null ? Number(submission.score) : null;
      return {
        student_id: profile.id,
        email: profile.email || "Unknown",
        status: submission ? submission.status : "Not Started",
        submitted_at: submission?.submitted_at || null,
        latest_score: explicitScore !== null ? explicitScore : getScoreForSubmission(profile.id, submission?.submitted_at || null),
        metrics: submission?.metrics ?? [],
        analysis: submission?.analysis ?? null,
        notes: notesByStudent.get(profile.id) ?? null,
      };
    });

    setStudentStatuses(statuses);
  };

  const openSummaryModal = (student: StudentStatus) => {
    setSelectedSummaryStatus(student);
    setShowSummaryModal(true);
  };

  const closeSummaryModal = () => {
    setSelectedSummaryStatus(null);
    setShowSummaryModal(false);
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  };

  return (
    <main className="w-full bg-transparent py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Assignments for {className || "Class"}</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Manage assignments for your students and track progress from question banks.</p>
          {classDescription ? <p className="mt-2 text-sm text-gray-500">{classDescription}</p> : null}
          {notice ? <p className="mt-3 text-sm text-error-600">{notice}</p> : null}
        </div>

        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{reportTitle}</h2>
              <p className="mt-1 text-sm text-gray-500">Track student score trends and choose a student to view a focused report.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openReportModal}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-primary-200 bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm transition hover:bg-primary-50"
              >
                <UsersIcon weight="bold" size={18} />
                Lihat report
              </button>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
                {reportLoading ? "Loading report..." : `${reportSummary.totalStudents} students enrolled`}
              </div>
            </div>
          </div>

          {reportNotice ? <p className="mt-4 text-sm text-gray-500">{reportNotice}</p> : null}

          <Modal isOpen={isReportModalOpen} onClose={closeReportModal} className="max-w-6xl m-4 p-0">
            <div className="rounded-[32px] bg-white p-6 shadow-xl dark:bg-slate-950">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{reportTitle}</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {selectedReportStudent
                      ? `Laporan individu untuk ${selectedReportStudent.name}. Data diambil dari history skor siswa.`
                      : "Menampilkan rata-rata kelas berdasarkan student_score_history. Pilih siswa untuk melihat perkembangan individu."}
                  </p>
                  {!selectedReportStudent ? (
                    <p className="mt-2 text-sm text-gray-500">
                      Nilai seperti 3.8 / 5.6 / 5.0 berasal dari ringkasan semua skor pada tanggal tersebut, bukan hanya nilai assignment tertentu.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] items-end">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Pilih siswa</label>
                  <select
                    className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
                    value={selectedReportStudentId}
                    onChange={(event) => setSelectedReportStudentId(event.target.value)}
                  >
                    <option value="">Semua siswa</option>
                    {studentSelectOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedReportStudent ? (
                  <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Selected student</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{selectedReportStudent.name}</p>
                    <p className="text-sm text-gray-500">{selectedReportStudent.email}</p>
                  </div>
                ) : null}
              </div>

              {selectedReportStudent ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Current level</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">{reportSummary.currentLevel}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Estimated IELTS Band</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {reportSummary.estimatedBand !== null ? reportSummary.estimatedBand.toFixed(1) : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Progress assignment</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {reportSummary.progressPercent !== null ? `${reportSummary.progressPercent}%` : "-"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Students</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">{reportSummary.totalStudents}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Avg score</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {reportSummary.averageScore !== null ? `${reportSummary.averageScore}` : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Last updated</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {reportRows.length > 0 ? new Date(reportRows[reportRows.length - 1].recorded_at).toLocaleDateString() : "-"}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4">
                {reportLoading ? (
                  <p className="text-sm text-gray-500">Loading chart...</p>
                ) : classReportSeries.series[0]?.data?.length ? (
                  <>
                    <ReactApexChart options={classReportOptions} series={classReportSeries.series} type="line" height={320} />
                    {!selectedReportStudent ? (
                      <p className="mt-3 text-sm text-gray-500">Hover or tap a data point to see total attempts for that day.</p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No score history is available yet.</p>
                )}
              </div>

            </div>
          </Modal>
        </div>

        <div className="mb-8 flex flex-wrap gap-4 items-center justify-between">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total assignments</p>
            <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-white/90">{assignments.length}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <TextButton
              variant="primary"
              onClick={() => openAssignmentFlow()}
              className="flex items-center gap-2"
            >
              <PlusIcon weight="bold" size={18} /> Create Assignment
            </TextButton>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Title</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Start</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Due</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Created</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-4 text-sm text-gray-500">Loading assignments...</td>
                  </tr>
                ) : assignments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-4 text-sm text-gray-500">No assignment found</td>
                  </tr>
                ) : (
                  assignments.map((assignment) => {
                    const dueDate = assignment.due_at ? new Date(assignment.due_at) : null;
                    const isExpired = dueDate ? dueDate.getTime() < currentTime : false;
                    return (
                      <tr key={assignment.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-5 py-4 text-sm font-medium">{assignment.title}</td>
                        <td className="px-5 py-4 text-sm">{formatDate(assignment.start_at)}</td>
                        <td className="px-5 py-4 text-sm">{formatDate(assignment.due_at)}</td>
                        <td className="px-5 py-4 text-sm">
                          {assignment.is_active ? (isExpired ? "Expired" : "Active") : "Inactive"}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-500">{formatDate(assignment.created_at)}</td>
                        <td className="px-5 py-4 text-sm flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewAssignment(assignment)}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                          >
                            <EyeIcon size={16} /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(assignment)}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                          >
                            <PencilLineIcon size={16} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCheckStatus(assignment)}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                          >
                            <UsersIcon size={16} /> Check Status
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showDetailModal && selectedAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col">
              {/* Header */}
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">{selectedAssignment.title}</h2>
                    <p className="mt-2 text-sm text-gray-500">Due {formatDate(selectedAssignment.due_at)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDetailModal(false)}
                    className="text-gray-500 hover:text-gray-900"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {selectedAssignment.description ? (
                  <p className="text-sm text-gray-600">{selectedAssignment.description}</p>
                ) : null}

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">Questions</h3>
                  {selectedQuestions.length === 0 ? (
                    <p className="text-sm text-gray-500">No questions added yet.</p>
                  ) : (
                    <div className="grid gap-4">
                      {selectedQuestions.map((question, idx) => (
                        <div key={question.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <p className="text-sm font-semibold text-primary">
                            {question.type === "bullet" ? `Bullet ${idx + 1}` : `Question ${idx + 1}`}
                          </p>
                          <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{question.content}</p>
                          {question.prompt ? (
                            <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3">
                              <p className="text-xs font-medium text-blue-900 mb-1">Prompt:</p>
                              <p className="text-sm text-blue-800 whitespace-pre-wrap">{question.prompt}</p>
                            </div>
                          ) : null}
                          {question.rubric ? (
                            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                              <p className="text-xs font-medium text-amber-900 mb-1">Rubric:</p>
                              <p className="text-sm text-amber-800 whitespace-pre-wrap">{question.rubric}</p>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 p-6 text-right">
                <TextButton variant="secondary" onClick={() => setShowDetailModal(false)}>
                  Close
                </TextButton>
              </div>
            </div>
          </div>
        )}


        {isAssignmentFlowOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
            <div className="w-full max-w-[96vw] max-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl bg-white p-6 shadow-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-primary">Create Assignment from Question Bank</h3>
                  <p className="mt-1 text-sm text-gray-500">Choose an existing bank or create a new bank, then schedule the assignment.</p>
                </div>
                <button type="button" onClick={closeAssignmentFlow} className="text-gray-500 hover:text-gray-900">
                  Close
                </button>
              </div>

              {assignmentFlowStep === "chooseSource" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setAssignmentFlowStep("selectBank")}
                    className="rounded-3xl border border-gray-200 bg-gray-50 p-6 text-left transition hover:bg-gray-100"
                  >
                    <p className="text-sm font-semibold text-gray-900">Select existing bank</p>
                    <p className="mt-2 text-sm text-gray-500">Pick a public bank or one you created to build a new assignment.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignmentFlowStep("createBank")}
                    className="rounded-3xl border border-gray-200 bg-gray-50 p-6 text-left transition hover:bg-gray-100"
                  >
                    <p className="text-sm font-semibold text-gray-900">Create your own bank</p>
                    <p className="mt-2 text-sm text-gray-500">Add a bank for the whole assignment with parts 1, 2, and 3.</p>
                  </button>
                </div>
              )}

              {assignmentFlowStep === "selectBank" && (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-gray-200 bg-white p-6">
                    <h3 className="mb-6 text-lg font-semibold text-gray-900">Select Question Bank</h3>

                    {isLoadingBanks ? (
                      <p className="text-sm text-gray-500">Loading banks...</p>
                    ) : (
                      <div className="space-y-4">
                        <label className="block text-sm font-semibold text-gray-700">
                          Question Bank
                          <div className="mt-2 rounded-xl border border-gray-300 p-2">
                            <select
                              value={selectedBank?.topic_code ?? ""}
                              onChange={(e) => {
                                const code = e.target.value;
                                const bank = questionBanks.find((b) => b.topic_code === code);
                                if (bank) {
                                  setSelectedBank(bank);
                                }
                              }}
                              className="w-full bg-white p-2 outline-none"
                            >
                              <option value="">-- Select a question bank --</option>
                              {questionBanks.length > 0 && (
                                <>
                                  {questionBanks.some((bank) => bank.created_by === currentUserId) && (
                                    <optgroup label="🧩 My Question Banks">
                                      {questionBanks
                                        .filter((bank) => bank.created_by === currentUserId)
                                        .map((bank) => (
                                          <option key={bank.topic_code} value={bank.topic_code}>
                                            {bank.title}
                                          </option>
                                        ))}
                                    </optgroup>
                                  )}
                                  {questionBanks.some((bank) => bank.is_public && bank.created_by !== currentUserId) && (
                                    <optgroup label="📖 Public Question Banks">
                                      {questionBanks
                                        .filter((bank) => bank.is_public && bank.created_by !== currentUserId)
                                        .map((bank) => (
                                          <option key={bank.topic_code} value={bank.topic_code}>
                                            {bank.title}
                                          </option>
                                        ))}
                                    </optgroup>
                                  )}
                                  {questionBanks.some((bank) => !bank.is_public && bank.created_by !== currentUserId) && (
                                    <optgroup label="🔒 Private Question Banks from others (Not Available)">
                                      {questionBanks
                                        .filter((bank) => !bank.is_public && bank.created_by !== currentUserId)
                                        .map((bank) => (
                                          <option key={bank.topic_code} value={bank.topic_code} disabled>
                                            {bank.title}
                                          </option>
                                        ))}
                                    </optgroup>
                                  )}
                                </>
                              )}
                            </select>
                          </div>
                        </label>

                        {questionBanks.some((bank) => !bank.is_public && bank.created_by !== currentUserId) && (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                            <p className="text-xs text-amber-800">
                              <span className="font-semibold">🔒 Private banks not available:</span> Only your own question banks and public banks from others can be selected. Private banks created by other users remain unavailable unless they are made public.
                            </p>
                          </div>
                        )}

                        {selectedBank && (
                          <div className="mt-4 rounded-2xl border border-gray-100 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-gray-900">{selectedBank.title}</p>
                            <p className="mt-1 text-xs text-gray-500">Code: {selectedBank.topic_code}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              Parts: {selectedBank.parts.map((p) => p.part).join(", ")} •{" "}
                              {selectedBank.is_public ? "Public" : "Private"}
                            </p>
                          </div>
                        )}

                        {bankRequestMessage ? (
                          <p className="text-sm text-yellow-600">{bankRequestMessage}</p>
                        ) : null}
                      </div>
                    )}

                    <div className="mt-6 flex gap-3">
                      <TextButton variant="secondary" onClick={() => setAssignmentFlowStep("chooseSource")}>
                        Back
                      </TextButton>
                      <TextButton
                        variant="primary"
                        onClick={() => {
                          if (selectedBank && bankHasAllParts(selectedBank)) {
                            handleOpenScheduleForBank(selectedBank);
                          }
                        }}
                        disabled={!selectedBank || !bankHasAllParts(selectedBank ?? ({} as QuestionBankGroup))}
                      >
                        Next
                      </TextButton>
                      <TextButton
                        variant="secondary"
                        onClick={() => setAssignmentFlowStep("createBank")}
                      >
                        Create Bank
                      </TextButton>
                    </div>
                  </div>
                </div>
              )}

              {assignmentFlowStep === "createBank" && (
                <div className="grid gap-6 xl:grid-cols-[1fr_2fr] overflow-y-auto pb-4">
                  <div className="rounded-3xl border border-gray-200 bg-white p-6">
                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-gray-900">Create Question Bank</h3>
                      <p className="mt-2 text-sm text-gray-500">Build a multi-part bank for student assignments.</p>
                    </div>

                    <label className="block mb-4 text-sm font-semibold text-primary">
                      Bank Name
                      <InputField
                        className="mt-2"
                        value={createBankName}
                        onChange={setCreateBankName}
                        placeholder="Bank title"
                      />
                    </label>

                    <label className="block mb-4 text-sm font-semibold text-primary">
                      Description
                      <TextArea
                        className="mt-2"
                        rows={4}
                        value={createBankDescription}
                        onChange={setCreateBankDescription}
                        placeholder="Optional description"
                      />
                    </label>

                    <label className="block mb-4 text-sm font-semibold text-primary">
                      Category
                      <div className="mt-2 w-full rounded-2xl p-3 text-primary outline-dashed outline-[var(--primary)]">
                        <select
                          value={createBankCategory}
                          onChange={(e) => setCreateBankCategory(e.target.value)}
                          className="w-full bg-transparent outline-none"
                        >
                          <option value="music">Music</option>
                          <option value="identity">Identity</option>
                          <option value="education">Education</option>
                          <option value="culinary">Culinary</option>
                          <option value="travel">Travel</option>
                          <option value="art">Art</option>
                          <option value="sports">Sports</option>
                          <option value="technology">Technology</option>
                          <option value="health">Health</option>
                          <option value="business">Business</option>
                        </select>
                      </div>
                    </label>

                    <div className="mb-6 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Activate bank</span>
                      <Toggle checked={createBankActive} onChange={setCreateBankActive} />
                    </div>

                    <div className="flex gap-3">
                      <TextButton variant="secondary" onClick={() => setAssignmentFlowStep("chooseSource")}>Back</TextButton>
                      <TextButton variant="primary" onClick={handleCreateBank}>Save Bank</TextButton>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {createBankParts.map((part, index) => (
                      <div key={part.part} className="rounded-3xl border border-gray-200 bg-white p-6">
                        <div className="mb-6">
                          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-gray-500">{part.part === 1 ? "Introduction" : part.part === 2 ? "Individual Long Turn" : "Two-way Discussion"}</p>
                          <h2 className="text-xl font-semibold text-gray-900">Part {part.part}</h2>
                        </div>

                        <label className="block mb-4 text-base font-bold text-primary">
                          Topic Title
                          <InputField
                            className="mt-2"
                            value={part.title}
                            onChange={(value) => {
                              setCreateBankParts((prev) => prev.map((item, idx) => (idx === index ? { ...item, title: value } : item)));
                            }}
                            placeholder={`Part ${part.part} title`}
                          />
                        </label>

                        <label className="block mb-6 text-base font-bold text-primary">
                          Prompt
                          <InputField
                            multiline
                            rows={1}
                            className="mt-2"
                            value={part.prompt}
                            onChange={(value) => {
                              setCreateBankParts((prev) => prev.map((item, idx) => (idx === index ? { ...item, prompt: value } : item)));
                            }}
                            placeholder={`Part ${part.part} user prompt`}
                          />
                        </label>

                        <div className="space-y-3">
                          {part.details.map((detail, detailIndex) => (
                            <div key={detailIndex} className="rounded-2xl border border-gray-200 p-4">
                              <div className="mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-sm font-semibold text-gray-500">
                                    {detailIndex + 1}
                                  </div>
                                  <div className="flex rounded-xl h-10 justify-center items-center text-xs font-semibold uppercase bg-gray-100 px-4 text-gray-600">
                                    {part.part === 2 ? "Bullet" : detail.type === "question" ? "Question" : "Bullet"}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = part.details.filter((_, idx) => idx !== detailIndex);
                                    setCreateBankParts((prev) =>
                                      prev.map((item, idx) => (idx === index ? { ...item, details: updated } : item))
                                    );
                                  }}
                                  className="rounded-xl px-3 py-2 text-red-500 hover:bg-red-50"
                                >
                                  ✕
                                </button>
                              </div>

                              <div className="mb-3">
                                <p className="mb-2 text-sm font-semibold text-primary">Content</p>
                                <InputField
                                  className="mt-2"
                                  value={detail.content}
                                  onChange={(value) => {
                                    setCreateBankParts((prev) =>
                                      prev.map((item, idx) =>
                                        idx === index
                                          ? {
                                              ...item,
                                              details: item.details.map((d, di) => (di === detailIndex ? { ...d, content: value } : d)),
                                            }
                                          : item
                                      )
                                    );
                                  }}
                                  placeholder="Content"
                                />
                              </div>

                              {detail.type === "question" ? (
                                <div className="space-y-3">
                                  <div>
                                    <p className="mb-2 text-sm font-semibold text-primary">Rubric</p>
                                    <InputField
                                      multiline
                                      rows={5}
                                      value={detail.rubric ?? ""}
                                      onChange={(value) => {
                                        setCreateBankParts((prev) =>
                                          prev.map((item, idx) =>
                                            idx === index
                                              ? {
                                                  ...item,
                                                  details: item.details.map((d, di) => (di === detailIndex ? { ...d, rubric: value } : d)),
                                                }
                                              : item
                                          )
                                        );
                                      }}
                                      placeholder="Rubric for AI"
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setCreateBankParts((prev) =>
                              prev.map((item, idx) =>
                                idx === index
                                  ? {
                                      ...item,
                                      details: [
                                        ...item.details,
                                        {
                                          type: part.part === 2 ? "bullet" : "question",
                                          content: "",
                                          prompt: "",
                                          rubric: "",
                                          order_index: item.details.length,
                                        },
                                      ],
                                    }
                                  : item
                              )
                            );
                          }}
                          className="text-primary mt-4"
                        >
                          + Add {part.part === 2 ? "Bullet" : "Detail"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {assignmentFlowStep === "schedule" && selectedBank && (
                <div className="space-y-4 overflow-y-auto pb-4">
                  <div className="rounded-3xl border border-gray-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-gray-900">Bank selected</p>
                    <p className="mt-2 text-sm text-gray-500">{selectedBank.title} • {selectedBank.parts.length} parts</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Start Date
                      <div className="mt-2 rounded-xl border border-gray-300 p-2">
                        <DatePicker
                          id="bank-assignment-start-date"
                          defaultDate={scheduleStartAt ? toLocalDate(scheduleStartAt) : undefined}
                          onChange={(dates) => setScheduleStartAt(dates[0] ? formatLocalDate(dates[0]) : "")}
                          placeholder="Select start date"
                          position="auto"
                        />
                      </div>
                    </label>
                    <label className="block text-sm font-semibold text-gray-700">
                      Start Time
                      <input
                        type="time"
                        value={scheduleStartTime}
                        onChange={(event) => setScheduleStartTime(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                      />
                    </label>
                    <label className="block text-sm font-semibold text-gray-700">
                      Due Date
                      <div className="mt-2 rounded-xl border border-gray-300 p-2">
                        <DatePicker
                          id="bank-assignment-due-date"
                          defaultDate={scheduleDueAt ? toLocalDate(scheduleDueAt) : undefined}
                          onChange={(dates) => setScheduleDueAt(dates[0] ? formatLocalDate(dates[0]) : "")}
                          placeholder="Select due date"
                          position="auto"
                        />
                      </div>
                    </label>
                    <label className="block text-sm font-semibold text-gray-700">
                      Due Time
                      <input
                        type="time"
                        value={scheduleDueTime}
                        onChange={(event) => setScheduleDueTime(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <TextButton variant="secondary" onClick={() => setAssignmentFlowStep("selectBank")}>Back</TextButton>
                    <TextButton variant="primary" onClick={handleCreateAssignmentFromBank}>
                      Create Assignment from Bank
                    </TextButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isEditOpen && editAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-6 text-primary">Edit Assignment Schedule</h3>
              <div className="space-y-6 flex-1 overflow-y-auto">

                <label className="w-full block text-sm font-semibold text-primary">
                  Start Date
                  <div className="w-full mt-2 border border-gray-300 rounded-lg p-2">
                    <DatePicker
                      id="edit-assignment-start-date"
                      defaultDate={editStartAt ? toLocalDate(editStartAt) : undefined}
                      onChange={handleEditStartAtChange}
                      placeholder="Select start date"
                      position="auto"
                    />
                  </div>
                </label>

                <label className="w-full block text-sm font-semibold text-primary">
                  Start Time
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full mt-2 p-2 border border-gray-300 rounded-lg"
                  />
                </label>

                <label className="w-full block text-sm font-semibold text-primary">
                  Due Date
                  <div className="w-full mt-2 border border-gray-300 rounded-lg p-2">
                    <DatePicker
                      id="edit-assignment-due-date"
                      defaultDate={editDueAt ? toLocalDate(editDueAt) : undefined}
                      onChange={handleEditDueAtChange}
                      placeholder="Select due date"
                      position="auto"
                    />
                  </div>
                </label>

                <label className="w-full block text-sm font-semibold text-primary">
                  Due Time
                  <input
                    type="time"
                    value={editDueTime}
                    onChange={(e) => setEditDueTime(e.target.value)}
                    className="w-full mt-2 p-2 border border-gray-300 rounded-lg"
                  />
                </label>
              </div>

              <div className="mt-6 border-t border-gray-200 pt-4 flex flex-wrap gap-2 justify-end">
                <TextButton variant="secondary" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </TextButton>
                <TextButton variant="primary" onClick={handleSaveEdit}>
                  Save Changes
                </TextButton>
              </div>
            </div>
          </div>
        )}

        {showStatusModal && selectedAssignmentForStatus && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">Student Status - {selectedAssignmentForStatus.title}</h2>
                    <p className="mt-2 text-sm text-gray-500">Due {formatDate(selectedAssignmentForStatus.due_at)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStatusModal(false)}
                    className="text-gray-500 hover:text-gray-900"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Student Email</th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Submitted At</th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Score at submission</th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentStatuses.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-5 py-4 text-sm text-gray-500">No students found in this class.</td>
                          </tr>
                        ) : (
                          studentStatuses.map((student) => (
                            <tr key={student.student_id} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="px-5 py-4 text-sm font-medium">{student.email}</td>
                              <td className="px-5 py-4 text-sm">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    student.status === 'submitted'
                                      ? 'bg-green-100 text-green-800'
                                      : student.status === 'in_progress'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : student.status === 'pending'
                                      ? 'bg-gray-100 text-gray-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {student.status === 'Not Started' ? 'Not Started' : student.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-sm text-gray-500">
                                {student.submitted_at ? formatDate(student.submitted_at) : '-'}
                              </td>
                              <td className="px-5 py-4 text-sm text-gray-500">
                                {typeof student.latest_score === 'number' ? student.latest_score.toFixed(1) : '-'}
                              </td>
                              <td className="px-5 py-4 text-sm text-gray-500">
                                <button
                                  type="button"
                                  onClick={() => openSummaryModal(student)}
                                  className="inline-flex items-center justify-center rounded-lg border border-primary-300 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-100"
                                >
                                  View Result
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-200 p-6 text-right">
                <TextButton variant="secondary" onClick={() => setShowStatusModal(false)}>
                  Close
                </TextButton>
              </div>
            </div>
          </div>
        )}

        {showSummaryModal && selectedSummaryStatus && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">Speaking Result — {selectedSummaryStatus.email}</h2>
                    <p className="mt-2 text-sm text-gray-500">Assignment: {selectedAssignmentForStatus?.title || "Selected assignment"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeSummaryModal}
                    className="text-gray-500 hover:text-gray-900"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="p-6">
                {(() => {
                  const analysisData = selectedSummaryStatus.analysis && typeof selectedSummaryStatus.analysis === "object"
                    ? selectedSummaryStatus.analysis
                    : null;

                  const metrics = Array.isArray(analysisData?.metrics)
                    ? analysisData.metrics.map((m: any) => ({ label: m.label ?? m.id ?? "Metric", score: String(m.score ?? m.value ?? "—"), description: m.text ?? m.description ?? "" }))
                    : Array.isArray(selectedSummaryStatus.metrics)
                      ? selectedSummaryStatus.metrics.map((m: any) => ({ label: m.label ?? m.id ?? "Metric", score: String(m.score ?? m.value ?? "—"), description: m.text ?? m.description ?? "" }))
                      : [];

                  const overallStr = typeof analysisData?.overallScore === "string"
                    ? analysisData.overallScore
                    : typeof analysisData?.overall === "string"
                      ? analysisData.overall
                      : typeof selectedSummaryStatus.latest_score === "number"
                        ? String(Number(selectedSummaryStatus.latest_score).toFixed(1))
                        : "—";

                  const levelLabel = typeof analysisData?.level === "string"
                    ? analysisData.level
                    : getCurrentLevelLabel(formatBand(Number(overallStr) || null));

                  const recommendation = typeof analysisData?.recommendation === "string"
                    ? analysisData.recommendation
                    : selectedSummaryStatus.notes ?? null;

                  const isSubmitted = selectedSummaryStatus.status === "submitted";
                  const hasAnyResult = metrics.length > 0 || Boolean(recommendation) || overallStr !== "—";

                  if (!isSubmitted) {
                    return (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-yellow-50 p-6 text-center text-sm text-yellow-700">
                        This student has not submitted the assignment yet.
                      </div>
                    );
                  }

                  if (!hasAnyResult) {
                    return (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
                        Assignment has been submitted, but no speaking result is available yet.
                      </div>
                    );
                  }

                  return (
                    <AnalysisCard
                      title={analysisData?.title ?? selectedAssignmentForStatus?.title ?? "Speaking result"}
                      overallScore={overallStr}
                      level={levelLabel}
                      metrics={metrics}
                      recommendation={recommendation ?? undefined}
                    />
                  );
                })()}
              </div>
              <div className="border-t border-gray-200 p-6 text-right">
                <TextButton variant="secondary" onClick={closeSummaryModal}>
                  Close
                </TextButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
