"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ScoreHistoryRow = {
  id: number;
  student_id: string;
  score: number;
  speaking_attempts: number;
  unit_index: number | null;
  part_index: number | null;
  recorded_at: string;
};

const formatBand = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const normalized = value > 9.5 ? value / 10 : value;
  return Math.max(0, Math.min(9, Number(normalized.toFixed(1)))).toFixed(1);
};

export default function LearnResultPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [record, setRecord] = useState<ScoreHistoryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!id) {
        setError("Missing result id.");
        setLoading(false);
        return;
      }

      const parsedId = Number.parseInt(id, 10);
      if (!Number.isFinite(parsedId)) {
        setError("Invalid result id.");
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from("student_score_history")
        .select("id, student_id, score, speaking_attempts, unit_index, part_index, recorded_at")
        .eq("id", parsedId)
        .maybeSingle();

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setRecord((data as ScoreHistoryRow | null) ?? null);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const partLabel = useMemo(() => {
    if (!record?.part_index) return "-";
    return `Part ${record.part_index}`;
  }, [record?.part_index]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 px-4 py-10 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Learn Result</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Session result detail</h1>
          </div>
          <Link href="/dashboard/user" className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
            Back to dashboard
          </Link>
        </div>

        {loading ? (
          <div className="py-10 text-sm text-gray-500">Loading result...</div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : record ? (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                <p className="text-xs uppercase tracking-wide text-gray-500">Band Score</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{formatBand(record.score)}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                <p className="text-xs uppercase tracking-wide text-gray-500">Unit</p>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{record.unit_index ?? "-"}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                <p className="text-xs uppercase tracking-wide text-gray-500">Part</p>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{partLabel}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-xs uppercase tracking-wide text-gray-500">Speaking Attempts</p>
                <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{record.speaking_attempts}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-xs uppercase tracking-wide text-gray-500">Recorded At</p>
                <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{new Date(record.recorded_at).toLocaleString()}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              This page shows the stored score detail for the selected session. The original transcript is still reviewed inside the practice flow on <Link href="/learn" className="font-semibold underline">/learn</Link>.
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-300">
            No result record found for this id.
          </div>
        )}
      </div>
    </main>
  );
}
