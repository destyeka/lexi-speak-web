"use client";

import { useState, useEffect, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import TextButton from "@/components/ui/system/TextButton";
import { InputField } from "@/components/ui/system/InputField";
import { PlusIcon, UsersIcon, CopyIcon, CheckIcon, PencilIcon, TrashIcon } from "@phosphor-icons/react";

interface Class {
  id: string;
  name: string;
  description: string | null;
  join_code: string;
}

interface Student {
  id: string;
  email: string;
}

interface JoinRequest {
  id: string;
  student_id: string;
  email: string;
  requested_at: string;
}

export default function ClassPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [nameClass, setNameClass] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"students" | "approval">("students");
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkRoleAndFetch();
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const checkRoleAndFetch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error.message);
        setLoading(false);
        return;
      }

      if (data?.role !== 'guru') {
        console.warn("User is not a guru, redirecting to dashboard");
        router.push('/dashboard');
        return;
      }

      await fetchClasses();
    } catch (err) {
      console.error("Error in checkRoleAndFetch:", err);
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("No user found");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("classes")
        .select("id, name, description, join_code")
        .eq("coach_id", user.id);

      if (error) {
        console.error("Error fetching classes:", error.message);
        setLoading(false);
        return;
      }

      setClasses(data || []);
    } catch (err) {
      console.error("Unexpected error in fetchClasses:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async () => {
    if (!nameClass.trim()) {
      alert("Please enter a class name");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("No user found");
        return;
      }

      const joinCode = Math.random().toString(36).substring(2, 15);

      const { data, error } = await supabase
        .from("classes")
        .insert({
          name: nameClass,
          description: description || null,
          join_code: joinCode,
          coach_id: user.id,
          created_by: user.id,
        })
        .select();

      if (error) {
        console.error("Error creating class:", error.message);
        alert("Failed to create class: " + error.message);
        return;
      }

      setNameClass("");
      setDescription("");
      setShowCreateForm(false);
      await fetchClasses();
    } catch (err) {
      console.error("Unexpected error in handleCreateClass:", err);
      alert("An unexpected error occurred");
    }
  };

  const handleOpenEditModal = (classItem: Class, event?: MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    setEditingClass(classItem);
    setNameClass(classItem.name);
    setDescription(classItem.description || "");
    setShowEditModal(true);
  };

  const handleUpdateClass = async () => {
    if (!editingClass) return;
    if (!nameClass.trim()) {
      alert("Please enter a class name");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("classes")
        .update({
          name: nameClass,
          description: description || null,
        })
        .eq("id", editingClass.id)
        .select();

      if (error) {
        console.error("Error updating class:", error.message);
        alert("Failed to update class: " + error.message);
        return;
      }

      setEditingClass(null);
      setShowEditModal(false);
      setNameClass("");
      setDescription("");
      await fetchClasses();
    } catch (err) {
      console.error("Unexpected error in handleUpdateClass:", err);
      alert("An unexpected error occurred");
    }
  };

  const handleDeleteClass = async () => {
    if (!editingClass) return;

    const confirmed = confirm(`Hapus kelas ${editingClass.name}?`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("classes")
        .delete()
        .eq("id", editingClass.id);

      if (error) {
        console.error("Error deleting class:", error.message);
        alert("Failed to delete class: " + error.message);
        return;
      }

      setEditingClass(null);
      setShowEditModal(false);
      setNameClass("");
      setDescription("");
      await fetchClasses();
    } catch (err) {
      console.error("Unexpected error in handleDeleteClass:", err);
      alert("An unexpected error occurred");
    }
  };

  const fetchClassMembersAndRequests = async (classItem: Class) => {
    try {
      setActionLoading(true);
      setNotice(null);

      const { error: expireError } = await supabase.rpc("expire_pending_join_requests");
      if (expireError) {
        console.warn("Error expiring pending join requests:", expireError.message);
      }

      const { data: memberData, error: memberError } = await supabase
        .from("class_members")
        .select("profiles!inner(id, email)")
        .eq("class_id", classItem.id);

      if (memberError) {
        throw memberError;
      }

      const { data: requestData, error: requestError } = await supabase
        .from("class_join_requests")
        .select("id, student_id, requested_at, profiles!inner(id, email)")
        .eq("class_id", classItem.id)
        .eq("status", "pending")
        .order("requested_at", { ascending: false });

      if (requestError) {
        throw requestError;
      }

      setStudents((memberData as any[] | null)?.map((d) => d.profiles as Student) || []);
      setJoinRequests(
        (requestData as any[] | null)?.map((d) => ({
          id: d.id,
          student_id: d.student_id,
          email: d.profiles.email,
          requested_at: d.requested_at,
        })) || []
      );
    } catch (err) {
      console.error("Error fetching class members or pending requests:", err);
      alert("Failed to load students or pending requests.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewStudents = async (classItem: Class) => {
    try {
      setSelectedClass(classItem);
      setStudents([]);
      setJoinRequests([]);
      setNotice(null);
      setModalMode("students");
      setShowModal(true);
      await fetchClassMembersAndRequests(classItem);
    } catch (err) {
      console.error("Unexpected error in handleViewStudents:", err);
      alert("An unexpected error occurred");
    }
  };

  const handleViewApprovals = async (classItem: Class) => {
    try {
      setSelectedClass(classItem);
      setStudents([]);
      setJoinRequests([]);
      setNotice(null);
      setModalMode("approval");
      setShowModal(true);
      await fetchClassMembersAndRequests(classItem);
    } catch (err) {
      console.error("Unexpected error in handleViewApprovals:", err);
      alert("An unexpected error occurred");
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    if (!selectedClass) return;
    try {
      setActionLoading(true);
      await supabase.rpc("approve_join_request", { p_request_id: requestId });
      setNotice("Request approved.");
      await fetchClassMembersAndRequests(selectedClass);
    } catch (err) {
      console.error("Error approving request:", err);
      alert("Failed to approve request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveAll = async () => {
    if (!selectedClass) return;
    try {
      setActionLoading(true);
      await supabase.rpc("approve_all_join_requests", { p_class_id: selectedClass.id });
      setNotice("Semua request telah disetujui.");
      await fetchClassMembersAndRequests(selectedClass);
    } catch (err) {
      console.error("Error approving all requests:", err);
      alert("Failed to approve all requests.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    if (!selectedClass) return;
    try {
      setActionLoading(true);
      await supabase.rpc("decline_join_request", { p_request_id: requestId });
      setNotice("Request declined.");
      await fetchClassMembersAndRequests(selectedClass);
    } catch (err) {
      console.error("Error declining request:", err);
      alert("Failed to decline request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId: string, studentEmail: string) => {
    if (!selectedClass) return;
    const confirmed = confirm(`Hapus member ${studentEmail} dari ${selectedClass.name}?`);
    if (!confirmed) return;

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from("class_members")
        .delete()
        .match({ class_id: selectedClass.id, student_id: studentId });

      if (error) {
        throw error;
      }

      setNotice("Member berhasil dihapus.");
      await fetchClassMembersAndRequests(selectedClass);
    } catch (err) {
      console.error("Error removing student:", err);
      alert("Failed to remove member.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-primary font-medium">Loading classes...</p>
        </div>
      </div>
    );
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <main className="w-full bg-transparent">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            My Classes
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Manage your class and students</p>
        </div>

        {/* Create Button */}
        <div className="mb-8 flex flex-wrap items-center gap-3 justify-start">
          <TextButton
            variant="primary"
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2"
          >
            <PlusIcon weight="bold" size={20} />
            Create New Class
          </TextButton>
          <TextButton
            variant="secondary"
            onClick={() => router.push("/dashboard/coach/class/report")}
            className="flex items-center gap-2"
          >
            Class Report
          </TextButton>
        </div>

        {/* Classes */}
        {classes.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-400 bg-white p-10 text-center text-gray-700 max-w-3xl mx-auto">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Classes Yet</h2>
            <p className="text-gray-700 text-center mb-6 max-w-md mx-auto">
              Create your first class to start managing students and track their progress.
            </p>
            <TextButton
              variant="primary"
              onClick={() => setShowCreateForm(true)}
            >
              Create Your First Class
            </TextButton>
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-6">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className="group cursor-pointer"
                onClick={() => router.push(`/dashboard/coach/class/${cls.id}`)}
              >
                <div className="relative overflow-hidden rounded-[24px] border border-gray-200 bg-gradient-to-br from-white via-white to-rose-50/50 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_18px_40px_rgba(15,23,42,0.16)] w-[360px]">
                  <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />

                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <span className="mb-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                        Class Room
                      </span>
                      <h3 className="mb-1 text-2xl font-bold text-gray-900 leading-tight">
                        {cls.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {cls.description ? cls.description : "Click to view students"}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          Active
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditModal(cls, e)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white/90 text-primary/70 shadow-sm transition-colors hover:bg-primary/5 hover:text-primary"
                        title="Edit class"
                      >
                        <PencilIcon size={20} weight="regular" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewStudents(cls);
                        }}
                        className="inline-flex h-11 min-w-[150px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white/90 px-4 text-sm font-semibold text-primary/80 shadow-sm transition-colors hover:bg-primary/5 hover:text-primary"
                        title="Manage students"
                      >
                        <UsersIcon weight="regular" size={20} />
                        Manage Students
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-rose-100 bg-white/90 p-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Join Code</p>
                    <div className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2">
                      <code className="font-mono text-base font-bold tracking-[0.18em] text-gray-900">
                        {cls.join_code.toUpperCase()}
                      </code>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyCode(cls.join_code);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                        title="Copy join code"
                      >
                        {copiedCode === cls.join_code ? (
                          <>
                            <CheckIcon weight="bold" size={16} className="text-green-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <CopyIcon weight="bold" size={16} className="text-rose-500" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Form Modal */}
        {showCreateForm && isMounted && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 backdrop-blur-md p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Create New Class
              </h2>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Class Name
                </label>
                <InputField
                  value={nameClass}
                  onChange={setNameClass}
                  placeholder="Enter class name..."
                  className="bg-white text-gray-900 outline-gray-300"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Description
                </label>
                <InputField
                  value={description}
                  onChange={setDescription}
                  placeholder="Enter class description..."
                  className="bg-white text-gray-900 outline-gray-300"
                />
              </div>

              <div className="flex gap-3">
                <TextButton
                  variant="primary"
                  onClick={handleCreateClass}
                  className="flex-1"
                >
                  Create
                </TextButton>
                <TextButton
                  variant="secondary"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNameClass("");
                    setDescription("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </TextButton>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Edit Class Modal */}
        {showEditModal && editingClass && isMounted && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 backdrop-blur-md p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Edit Class
              </h2>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Class Name
                </label>
                <InputField
                  value={nameClass}
                  onChange={setNameClass}
                  placeholder="Enter class name..."
                  className="bg-white text-gray-900 outline-gray-300"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Description
                </label>
                <InputField
                  value={description}
                  onChange={setDescription}
                  placeholder="Enter class description..."
                  className="bg-white text-gray-900 outline-gray-300"
                />
              </div>

              <div className="flex gap-3 flex-col sm:flex-row">
                <TextButton
                  variant="primary"
                  onClick={handleUpdateClass}
                  className="flex-1"
                >
                  Save Changes
                </TextButton>
                <TextButton
                  variant="secondary"
                  onClick={handleDeleteClass}
                  className="flex-1 bg-red-50 text-red-700 hover:bg-red-100"
                >
                  Delete Class
                </TextButton>
              </div>

              <div className="mt-4">
                <TextButton
                  variant="secondary"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingClass(null);
                    setNameClass("");
                    setDescription("");
                  }}
                  className="w-full"
                >
                  Cancel
                </TextButton>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Students Modal */}
        {showModal && selectedClass && isMounted && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 backdrop-blur-md px-4 py-6">
            <div className="w-full max-w-[90vw] max-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-200 flex flex-col">
              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedClass ? `Manage ${selectedClass.name}` : "Manage students"}
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setModalMode("students")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${modalMode === "students" ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    Student List
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedClass && handleViewApprovals(selectedClass)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${modalMode === "approval" ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    Approval
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {notice ? (
                  <div className="rounded-2xl border border-green-100 bg-green-50 p-4 text-sm text-green-800">
                    {notice}
                  </div>
                ) : null}

                {modalMode === "approval" ? (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Pending Join Requests</h3>
                        <p className="text-sm text-gray-600">Approve atau decline setiap request di bawah ini.</p>
                      </div>
                      {joinRequests.length > 0 ? (
                        <TextButton
                          variant="primary"
                          onClick={handleApproveAll}
                          disabled={actionLoading}
                          className="whitespace-nowrap"
                        >
                          Approve All
                        </TextButton>
                      ) : null}
                    </div>
                    {joinRequests.length > 0 ? (
                      <div className="space-y-3">
                        {joinRequests.map((request) => (
                          <div key={request.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{request.email}</p>
                              <p className="text-xs text-gray-500">Requested at {new Date(request.requested_at).toLocaleString()}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <TextButton
                                variant="primary"
                                onClick={() => handleApproveRequest(request.id)}
                                disabled={actionLoading}
                              >
                                Approve
                              </TextButton>
                              <TextButton
                                variant="secondary"
                                onClick={() => handleDeclineRequest(request.id)}
                                disabled={actionLoading}
                              >
                                Decline
                              </TextButton>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="text-4xl mb-3">🕒</div>
                        <p className="text-gray-600">Tidak ada request saat ini.</p>
                      </div>
                    )}
                  </div>
                ) : students.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="text-4xl mb-3">👥</div>
                    <p className="text-gray-600">No students joined yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {students.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center gap-3 p-3 bg-tertiary rounded-lg hover:bg-tertiary/80 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-secondary to-primary flex items-center justify-center text-white font-bold">
                          {student.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {student.email}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(student.id, student.email)}
                          disabled={actionLoading}
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <TrashIcon size={18} weight="regular" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-100 p-6">
                <TextButton
                  variant="secondary"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedClass(null);
                  }}
                  className="w-full"
                >
                  Close
                </TextButton>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </main>
  );
}