"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { InputField } from "@/components/ui/system/InputField";
import TextButton from "@/components/ui/system/TextButton";
import { Toggle } from "@/components/ui/system/Toggle";
import TextArea from "@/components/form/input/TextArea";
import DatePicker from "@/components/form/date-picker";
import { PencilLineIcon, TrashIcon, EyeIcon, CheckIcon, PlusIcon, UsersIcon } from "@phosphor-icons/react";

interface Assignment {
  id: string;
  class_id: string;
  part: number;
  title: string;
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
  order_index: number;
}

interface StudentStatus {
  student_id: string;
  email: string;
  status: string;
  submitted_at: string | null;
}

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

  const [isCreateOpen, setIsCreateOpen] = useState(false);
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

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPart, setNewPart] = useState(1);
  const [newStartAt, setNewStartAt] = useState("");
  const [newStartTime, setNewStartTime] = useState("00:00");
  const [newDueAt, setNewDueAt] = useState("");
  const [newDueTime, setNewDueTime] = useState("23:59");
  const [newActive, setNewActive] = useState(true);
  const [newQuestions, setNewQuestions] = useState<Question[]>([]);

  function formatLocalDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function toLocalDate(dateString: string) {
    const [year, month, day] = dateString.split("-").map(Number);
    if (!year || !month || !day) return undefined;
    return new Date(year, month - 1, day);
  }

  const handleNewDueAtChange = useCallback(([selected]: Date[]) => {
    setNewDueAt(selected ? formatLocalDate(selected) : "");
  }, []);

  const handleEditDueAtChange = useCallback(([selected]: Date[]) => {
    setEditDueAt(selected ? formatLocalDate(selected) : "");
  }, []);

  const handleNewStartAtChange = useCallback(([selected]: Date[]) => {
    setNewStartAt(selected ? formatLocalDate(selected) : "");
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
        { id: crypto.randomUUID(), type: "question", content: "", order_index: 0 },
        { id: crypto.randomUUID(), type: "bullet", content: "", order_index: 1 },
        { id: crypto.randomUUID(), type: "bullet", content: "", order_index: 2 },
        { id: crypto.randomUUID(), type: "bullet", content: "", order_index: 3 },
      ];
    }

    const count = part === 1 ? 3 : 3;
    return Array.from({ length: count }, (_, index) => ({
      id: crypto.randomUUID(),
      type: "question",
      content: "",
      order_index: index,
    }));
  };

  const questionLabel = (part: number, question: Question, index: number) => {
    if (part === 2 && index === 0) {
      return "Cue card title";
    }

    if (question.type === "bullet") {
      return `Bullet point ${index}`;
    }

    return `Question ${index + 1}`;
  };

  const selectedDateToEndOfDayIso = (dateString: string) => {
    const [year, month, day] = dateString.split("-").map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day, 23, 59, 59, 999);
    return date.toISOString();
  };

  useEffect(() => {
    if (!classId) {
      router.push("/dashboard/coach/class");
      return;
    }
    void initialize();
  }, [classId]);

  const initialize = async () => {
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
    setLoading(false);
  };

  const fetchClassInfo = async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("name, description")
      .eq("id", classId)
      .maybeSingle();

    if (!error && data) {
      setClassName(data.name);
      setClassDescription(data.description);
    }
  };

  const fetchAssignments = async () => {
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
  };

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

  const handleCreateAssignment = async () => {
    if (!newTitle.trim()) {
      alert("Title is required.");
      return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user || userError) {
      alert("Please sign in again.");
      return;
    }

    const startAtValue = dateTimeToIso(newStartAt, newStartTime);
    const dueAtValue = dateTimeToIso(newDueAt, newDueTime);

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
        part: newPart,
        title: newTitle,
        description: newDescription || null,
        start_at: startAtValue,
        due_at: dueAtValue,
        is_active: newActive,
      })
      .select()
      .single();

    if (error || !data) {
      alert(error?.message || "Failed to create assignment.");
      return;
    }

    if (newQuestions.length > 0) {
      const { error: questionError } = await supabase.from("assignment_questions").insert(
        newQuestions.map((q, index) => ({
          assignment_id: data.id,
          content: q.content,
          order_index: index,
          type: q.type ?? "question",
        }))
      );

      if (questionError) {
        console.error("Error saving assignment questions:", questionError);
        alert(`Failed to save questions: ${questionError.message}`);
        return;
      }
    }

    setNewTitle("");
    setNewDescription("");
    setNewStartAt("");
    setNewStartTime("00:00");
    setNewDueAt("");
    setNewDueTime("23:59");
    setNewActive(true);
    setNewQuestions([]);
    setIsCreateOpen(false);
    await fetchAssignments();
  };

  const handleSaveEdit = async () => {
    if (!editAssignment) return;
    if (!editTitle.trim()) {
      alert("Title is required.");
      return;
    }

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
        title: editTitle,
        part: editPart,
        description: editDescription || null,
        start_at: startAtValue,
        due_at: dueAtValue,
        is_active: editActive,
      })
      .eq("id", editAssignment.id);

    if (error) {
      alert(error.message);
      return;
    }

    const { error: deleteError } = await supabase.from("assignment_questions").delete().eq("assignment_id", editAssignment.id);
    if (deleteError) {
      console.error("Error deleting old questions:", deleteError);
      alert(`Failed to update questions: ${deleteError.message}`);
      return;
    }

    if (editQuestions.length > 0) {
      const { error: questionError } = await supabase.from("assignment_questions").insert(
        editQuestions.map((q, index) => ({
          assignment_id: editAssignment.id,
          content: q.content,
          order_index: index,
          type: q.type ?? "question",
        }))
      );

      if (questionError) {
        console.error("Error updating assignment questions:", questionError);
        alert(`Failed to save updated questions: ${questionError.message}`);
        return;
      }
    }

    setEditAssignment(null);
    setIsEditOpen(false);
    setEditQuestions([]);
    await fetchAssignments();
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
    const studentIds = members.map(m => m.student_id);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", studentIds);

    if (profilesError || !profiles) {
      console.error("Error fetching profiles:", profilesError);
      setStudentStatuses([]);
      return;
    }

    const { data: submissions, error: submissionsError } = await supabase
      .from("assignment_submissions")
      .select("student_id, status, submitted_at")
      .eq("assignment_id", assignment.id)
      .in("student_id", studentIds);

    if (submissionsError) {
      console.error("Error fetching submissions:", submissionsError);
      setStudentStatuses([]);
      return;
    }

    // Combine data
    const statuses: StudentStatus[] = profiles.map(profile => {
      const submission = submissions?.find(s => s.student_id === profile.id);
      return {
        student_id: profile.id,
        email: profile.email || "Unknown",
        status: submission ? submission.status : "Not Started",
        submitted_at: submission?.submitted_at || null,
      };
    });

    setStudentStatuses(statuses);
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
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Create manual assignments for your students. Questions are stored separately from the admin question bank.</p>
          {classDescription ? <p className="mt-2 text-sm text-gray-500">{classDescription}</p> : null}
          {notice ? <p className="mt-3 text-sm text-error-600">{notice}</p> : null}
        </div>

        <div className="mb-8 flex flex-wrap gap-4 items-center justify-between">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total assignments</p>
            <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-white/90">{assignments.length}</p>
          </div>
          <TextButton
            variant="primary"
            onClick={() => {
              setNewPart(1);
              setNewQuestions(buildQuestionsForPart(1));
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <PlusIcon weight="bold" size={18} /> New Assignment
          </TextButton>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Title</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Part</th>
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
                    const isExpired = dueDate ? dueDate.getTime() < Date.now() : false;
                    return (
                      <tr key={assignment.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-5 py-4 text-sm font-medium">{assignment.title}</td>
                        <td className="px-5 py-4 text-sm">Part {assignment.part}</td>
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
            <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
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
              <div className="space-y-6 p-6">
                {selectedAssignment.description ? (
                  <p className="text-sm text-gray-600">{selectedAssignment.description}</p>
                ) : null}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">Questions</h3>
                  {selectedQuestions.length === 0 ? (
                    <p className="text-sm text-gray-500">No questions added yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedQuestions.map((question, idx) => (
                        <div key={question.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <p className="text-sm font-semibold text-gray-900">Question {idx + 1}</p>
                          <p className="mt-2 text-sm text-gray-600">{question.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-200 p-6 text-right">
                <TextButton variant="secondary" onClick={() => setShowDetailModal(false)}>
                  Close
                </TextButton>
              </div>
            </div>
          </div>
        )}

        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
            <div className="w-full max-w-[90vw] max-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl bg-white p-6 shadow-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4 text-primary">Create Assignment</h3>
              <div className="grid gap-6 lg:grid-cols-[1fr_1.7fr] flex-1 min-h-0">
                <div className="space-y-4 overflow-y-auto pr-2">
                  <label className="w-full block text-sm font-semibold text-primary">
                    Part
                    <div className="w-full mt-2 border border-gray-300 rounded-lg overflow-hidden">
                      <select
                        value={newPart}
                        onChange={(event) => {
                          const selected = Number(event.target.value);
                          setNewPart(selected);
                          setNewQuestions(buildQuestionsForPart(selected));
                        }}
                        className="w-full p-2 outline-none bg-white"
                      >
                        <option value={1}>Part 1</option>
                        <option value={2}>Part 2</option>
                        <option value={3}>Part 3</option>
                      </select>
                    </div>
                  </label>

                  <label className="w-full block text-base font-bold text-primary">
                    Title
                    <InputField
                      className="flex-1 min-w-0 mt-2 my-3"
                      value={newTitle}
                      onChange={setNewTitle}
                      placeholder="Enter assignment title"
                    />
                  </label>

                  <label className="w-full block text-base font-bold text-primary">
                    Description
                    <TextArea
                      className="flex-1 min-w-0 mt-2 my-3"
                      value={newDescription}
                      onChange={(value) => setNewDescription(value)}
                      placeholder="Optional description"
                      rows={4}
                    />
                  </label>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">Activate assignment</span>
                    <Toggle checked={newActive} onChange={setNewActive} />
                  </div>

                  <label className="w-full block text-sm font-semibold text-primary">
                    Start Date
                    <div className="w-full mt-2 border border-gray-300 rounded-lg p-2">
                      <DatePicker
                        id="create-assignment-start-date"
                        defaultDate={newStartAt ? toLocalDate(newStartAt) : undefined}
                        onChange={handleNewStartAtChange}
                        placeholder="Select start date"
                        position="auto"
                      />
                    </div>
                  </label>

                  <label className="w-full block text-sm font-semibold text-primary">
                    Start Time
                    <input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="w-full mt-2 p-2 border border-gray-300 rounded-lg"
                    />
                  </label>

                  <label className="w-full block text-sm font-semibold text-primary">
                    Due Date
                    <div className="w-full mt-2 border border-gray-300 rounded-lg p-2">
                      <DatePicker
                        id="create-assignment-due-date"
                        defaultDate={newDueAt ? toLocalDate(newDueAt) : undefined}
                        onChange={handleNewDueAtChange}
                        placeholder="Select due date"
                        position="auto"
                      />
                    </div>
                  </label>

                  <label className="w-full block text-sm font-semibold text-primary">
                    Due Time
                    <input
                      type="time"
                      value={newDueTime}
                      onChange={(e) => setNewDueTime(e.target.value)}
                      className="w-full mt-2 p-2 border border-gray-300 rounded-lg"
                    />
                  </label>
                </div>

                <div className="max-h-[calc(100vh-12rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Questions</p>
                      <p className="text-xs text-gray-500">Edit the list on the right side.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewQuestions((prev) => [...prev, { id: crypto.randomUUID(), type: "question", content: "", order_index: prev.length }])}
                      className="text-primary text-sm"
                    >
                      Add Question
                    </button>
                  </div>

                  <div className="space-y-3">
                    {newQuestions.map((question, index) => (
                      <div key={question.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                        <div className="flex items-start gap-3">
                          <div className="text-sm font-medium text-gray-600 w-24">
                            {questionLabel(newPart, question, index)}
                          </div>
                          <div className="mx-auto p-3 text-primary outline-dashed outline-[var(--primary)] rounded-2xl flex items-center">
                            <select
                              value={question.type ?? "question"}
                              onChange={(e) => {
                                const updated = [...newQuestions];
                                updated[index] = {
                                  ...updated[index],
                                  type: e.target.value as "question" | "bullet",
                                };
                                setNewQuestions(updated);
                              }}
                              className="bg-transparent outline-none w-full"
                            >
                              <option value="question">Question</option>
                              <option value="bullet">Bullet</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <InputField
                              className="w-full"
                              value={question.content}
                              onChange={(value) => {
                                setNewQuestions((prev) => prev.map((item, idx) => idx === index ? { ...item, content: value } : item));
                              }}
                              placeholder={
                                question.type === "bullet"
                                  ? "Enter bullet point"
                                  : newPart === 2 && index === 0
                                  ? "Enter cue card title or topic"
                                  : "Enter prompt or answer guidance"
                              }
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewQuestions((prev) => prev.filter((_, idx) => idx !== index))}
                            className="text-red-500"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-gray-200 pt-4 flex justify-end gap-2">
                <TextButton variant="secondary" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </TextButton>
                <TextButton variant="primary" onClick={handleCreateAssignment}>
                  Create Assignment
                </TextButton>
              </div>
            </div>
          </div>
        )}

        {isEditOpen && editAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
            <div className="w-full max-w-[90vw] max-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl bg-white p-6 shadow-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4 text-primary">Edit Assignment</h3>
              <div className="grid gap-6 lg:grid-cols-[1fr_1.7fr] flex-1 min-h-0">
                <div className="space-y-4 overflow-y-auto pr-2">
                  <label className="w-full block text-sm font-semibold text-primary">
                    Part
                    <div className="w-full mt-2 border border-gray-300 rounded-lg overflow-hidden">
                      <select
                        value={editPart}
                        onChange={(event) => {
                          const selected = Number(event.target.value);
                          setEditPart(selected);
                          setEditQuestions(buildQuestionsForPart(selected));
                        }}
                        className="w-full p-2 outline-none bg-white"
                      >
                        <option value={1}>Part 1</option>
                        <option value={2}>Part 2</option>
                        <option value={3}>Part 3</option>
                      </select>
                    </div>
                  </label>

                  <label className="w-full block text-base font-bold text-primary">
                    Title
                    <InputField
                      className="flex-1 min-w-0 mt-2 my-3"
                      value={editTitle}
                      onChange={setEditTitle}
                      placeholder="Enter assignment title"
                    />
                  </label>

                  <label className="w-full block text-base font-bold text-primary">
                    Description
                    <TextArea
                      className="flex-1 min-w-0 mt-2 my-3"
                      value={editDescription}
                      onChange={(value) => setEditDescription(value)}
                      placeholder="Optional description"
                      rows={4}
                    />
                  </label>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">Activate assignment</span>
                    <Toggle checked={editActive} onChange={setEditActive} />
                  </div>

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

                <div className="max-h-[calc(100vh-12rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Questions</p>
                      <p className="text-xs text-gray-500">Edit the list on the right side.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditQuestions((prev) => [...prev, { id: crypto.randomUUID(), type: "question", content: "", order_index: prev.length }])}
                      className="text-primary text-sm"
                    >
                      Add Question
                    </button>
                  </div>

                  <div className="space-y-3">
                    {editQuestions.map((question, index) => (
                      <div key={question.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                        <div className="flex items-start gap-3">
                          <div className="text-sm font-medium text-gray-600 w-24">
                            {questionLabel(editPart, question, index)}
                          </div>
                          <div className="mx-auto p-3 text-primary outline-dashed outline-[var(--primary)] rounded-2xl flex items-center">
                            <select
                              value={question.type ?? "question"}
                              onChange={(e) => {
                                const updated = [...editQuestions];
                                updated[index] = {
                                  ...updated[index],
                                  type: e.target.value as "question" | "bullet",
                                };
                                setEditQuestions(updated);
                              }}
                              className="bg-transparent outline-none w-full"
                            >
                              <option value="question">Question</option>
                              <option value="bullet">Bullet</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <InputField
                              className="w-full"
                              value={question.content}
                              onChange={(value) => setEditQuestions((prev) => prev.map((item, idx) => idx === index ? { ...item, content: value } : item))}
                              placeholder={
                                question.type === "bullet"
                                  ? "Enter bullet point"
                                  : editPart === 2 && index === 0
                                  ? "Enter cue card title or topic"
                                  : "Enter prompt or answer guidance"
                              }
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditQuestions((prev) => prev.filter((_, idx) => idx !== index))}
                            className="text-red-500"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-gray-200 pt-4 flex justify-end gap-2">
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
                        </tr>
                      </thead>
                      <tbody>
                        {studentStatuses.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-5 py-4 text-sm text-gray-500">No students found in this class.</td>
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
      </div>
    </main>
  );
}
