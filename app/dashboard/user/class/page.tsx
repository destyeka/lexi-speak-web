"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { InputField } from "@/components/ui/system/InputField";
import TextButton from "@/components/ui/system/TextButton";
import { PlusIcon } from "@phosphor-icons/react";

interface RawClassData {
  id: string;
  name: string;
  description: string | null;
  join_code: string;
  coach_id: string;
}

interface JoinedClass {
  id: string;
  name: string;
  description: string | null;
  join_code: string;
  coach_name: string | null;
}

function getErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  if (typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
  }

  return "";
}

export default function StudentClassPage() {
  const [joinCode, setJoinCode] = useState("");
  const [joinedClasses, setJoinedClasses] = useState<JoinedClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const fetchJoinedClasses = async (studentId: string) => {
    try {
      console.log("Fetching joined classes for student:", studentId);

      const { data: membershipData, error: membershipError } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("student_id", studentId);

      console.log("Memberships fetched:", membershipData, "error:", membershipError);

      if (membershipError) {
        console.error("Error fetching joined class ids - Details:", {
          message: membershipError.message,
          code: membershipError.code,
          details: membershipError.details,
          hint: membershipError.hint,
        });
        setMessage(`Gagal memuat kelas: ${membershipError.message}`);
        return;
      }

      const classIds = (membershipData || []).map((item) => item.class_id).filter(Boolean);
      console.log("Class IDs from memberships:", classIds);

      if (classIds.length === 0) {
        console.log("No classes found for this student");
        setJoinedClasses([]);
        return;
      }

      const { data: classesData, error: classesError } = await supabase
        .from("classes")
        .select("id, name, description, join_code, coach_id")
        .in("id", classIds);

      console.log("Classes fetched:", classesData, "error:", classesError);

      if (classesError) {
        console.error("Error fetching classes - Details:", {
          message: classesError.message,
          code: classesError.code,
          details: classesError.details,
          hint: classesError.hint,
        });
        setMessage(`Gagal memuat detail kelas: ${classesError.message}`);
        return;
      }

      const coachIds = (classesData || []).map((cls: RawClassData) => cls.coach_id).filter(Boolean);
      console.log("Coach IDs extracted:", coachIds);
      interface CoachData {
        id: string;
        email: string;
      }

      let coaches: { [key: string]: string } = {};
      if (coachIds.length > 0) {
        const { data: coachesData, error: coachesError } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", coachIds);

        console.log("Coaches fetch error:", coachesError);
        console.log("Coaches data:", coachesData);

        if (!coachesError && coachesData) {
          coaches = coachesData.reduce((acc, coach: CoachData) => {
            acc[coach.id] = coach.email;
            return acc;
          }, {} as { [key: string]: string });
        }
        console.log("Coaches map:", coaches);
      }

      console.log("Setting joined classes:", classesData);
      const mappedClasses = (classesData || []).map((cls: RawClassData) => {
        const coachName = coaches[cls.coach_id] || null;
        console.log(`Class ${cls.id} (${cls.name}): coach_id=${cls.coach_id}, coach_name=${coachName}`);
        return {
          id: cls.id,
          name: cls.name,
          description: cls.description,
          join_code: cls.join_code,
          coach_name: coachName,
        };
      });
      setJoinedClasses(mappedClasses);
    } catch (err) {
      console.error("Unexpected error fetching joined classes:", err);
      setMessage("Terjadi kesalahan ketika memuat kelas");
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Error fetching profile role:", profileError.message);
          return;
        }

        if (profileData?.role !== "user") {
          router.push("/dashboard");
          return;
        }

        await fetchJoinedClasses(user.id);
      } catch (err) {
        console.error("Error initializing StudentClassPage:", err);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [router]);

  const handleJoinClass = async () => {
    const code = joinCode.trim().toLowerCase();
    if (!code) {
      setMessage("Masukkan kode kelas terlebih dahulu.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      console.log("Calling join_class_by_code with code:", code);

      const { error: joinError } = await supabase.rpc("join_class_by_code", {
        p_join_code: code,
      });

      console.log("join_class_by_code result - error:", joinError);

      if (joinError) {
        const joinErrorMessage = getErrorMessage(joinError);
        const normalizedMessage = joinErrorMessage.toLowerCase();

        console.error("Error joining class:", {
          raw: joinError,
          message: joinErrorMessage || "No error message returned",
        });

        if (normalizedMessage.includes("tidak ditemukan")) {
          setMessage("Kode kelas tidak ditemukan. Periksa kembali dan coba lagi.");
        } else if (normalizedMessage.includes("hanya akun student")) {
          setMessage("Hanya akun student yang dapat bergabung.");
        } else {
          setMessage(
            joinErrorMessage
              ? `Gagal bergabung dengan kelas: ${joinErrorMessage}`
              : "Gagal bergabung dengan kelas. Coba lagi atau hubungi admin."
          );
        }
        return;
      }

      console.log("Permintaan bergabung berhasil dikirim!");
      setJoinCode("");
      setMessage("Permintaan bergabung dikirim. Tunggu approval coach.");
      await fetchJoinedClasses(user.id);
    } catch (err) {
      console.error("Unexpected error joining class:", err);
      setMessage("Terjadi kesalahan ketika bergabung. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-primary font-medium">Memuat kelas...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="w-full bg-transparent">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Class</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Masukkan kode join untuk gabung kelas. Setelah berhasil kamu akan melihat kartu kelas di bawah.</p>
        </div>

        <div className="grid gap-6">
          <div className="rounded-3xl border border-gray-300 bg-white p-6 shadow-[0_6px_20px_rgba(15,23,42,0.08)] max-w-3xl mx-auto">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <InputField
                  value={joinCode}
                  onChange={setJoinCode}
                  placeholder="Masukkan join code..."
                  className="w-full bg-white text-gray-900 outline-gray-300"
                />
              </div>
              <TextButton
                onClick={handleJoinClass}
                disabled={submitting}
                variant="primary"
                className="w-full sm:w-auto"
              >
                <span className="inline-flex items-center gap-2">
                  <PlusIcon size={18} weight="fill" />
                  Request Join
                </span>
              </TextButton>
            </div>
            {message ? (
              <p className="mt-4 text-sm text-gray-800">{message}</p>
            ) : (
              <p className="mt-4 text-sm text-gray-600">Setelah memasukkan kode, coach akan menerima permintaanmu dan dapat approve atau decline.</p>
            )}
          </div>

          <div className="space-y-4">
            {joinedClasses.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-400 bg-white p-10 text-center text-gray-700 max-w-3xl mx-auto">
                <p className="text-lg font-medium">Belum bergabung dengan kelas apa pun.</p>
                <p className="mt-2 text-sm">Masukkan kode join kelas untuk memulai.</p>
              </div>
            ) : (
              joinedClasses.map((joinedClass) => (
                <div
                  key={joinedClass.id}
                  className="group cursor-pointer rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
                  onClick={() => router.push(`/dashboard/user/class/${joinedClass.id}`)}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                        Joined Class
                      </span>
                      <h2 className="mt-4 text-2xl font-semibold text-slate-900 line-clamp-2">{joinedClass.name}</h2>
                      <p className="mt-3 text-sm text-slate-600">{joinedClass.description || "Tidak ada deskripsi kelas."}</p>
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:items-end">
                      <div className="rounded-2xl bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">
                        Code: {joinedClass.join_code}
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                        Tap to open
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-500">
                    <span>Coach: <span className="font-medium text-slate-900">{joinedClass.coach_name || "Tidak ada coach"}</span></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
