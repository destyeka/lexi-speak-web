"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface ScoreHistoryRow {
  id: number;
  score: number;
  part_index: number | null;
  unit_index: number | null;
  metrics: any;
  analysis: any;
  notes: string | null;
}

function formatBand(score: number | string | undefined): string {
  if (score === undefined || score === null) return "-";
  const num = Number(score);
  return isNaN(num) ? "-" : num.toFixed(1);
}

export default function LearnResultPage() {
  const searchParams = useSearchParams();
  const queryId = searchParams.get("id") || searchParams.get("assignmentId");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePart, setActivePart] = useState<string>("part1");
  
  // Menampung data tiap part secara dinamis dari database
  const [partsData, setPartsData] = useState<{
    overallScore: number | null;
    part1: ScoreHistoryRow | null;
    part2: ScoreHistoryRow | null;
    part3: ScoreHistoryRow | null;
  }>({
    overallScore: null,
    part1: null,
    part2: null,
    part3: null
  });

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (!queryId) {
        setError("Missing session or assignment ID.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(queryId);
      let targetRow: ScoreHistoryRow | null = null;

      // 1. Ambil baris utama tempat user mengklik detail
      if (!isUUID) {
        const { data, error: dbError } = await supabase
          .from("student_score_history")
          .select("id, score, part_index, unit_index, metrics, analysis, notes")
          .eq("id", Number(queryId))
          .single();

        if (dbError) {
          setError(dbError.message);
          setLoading(false);
          return;
        }
        targetRow = data;
      } else {
        const { data, error: dbError } = await supabase
          .from("assignment_submissions")
          .select("id, score, part_index, unit_index, metrics, analysis, notes")
          .eq("assignment_id", queryId)
          .limit(1);

        if (dbError) {
          setError(dbError.message);
          setLoading(false);
          return;
        }
        if (data && data.length > 0) targetRow = data[0] as any;
      }

      if (cancelled) return;
      if (!targetRow) {
        setError("Data hasil evaluasi tidak ditemukan.");
        setLoading(false);
        return;
      }

      // 2. Jika baris yang diklik adalah Summary Akhir (part_index nya null/empty)
      if (targetRow.part_index === null && targetRow.unit_index) {
        // Tarik data history latihan untuk part 1, 2, dan 3 pada unit_index yang sama
        const { data: historyRows, error: historyError } = await supabase
          .from("student_score_history")
          .select("id, score, part_index, unit_index, metrics, analysis,notes")
          .eq("unit_index", targetRow.unit_index)
          .order("id", { ascending: false });

if (historyError) {
          setError(historyError.message);
          setLoading(false);
          return;
        }

        const resolvedParts = {
          overallScore: targetRow.score,
          part1: null as ScoreHistoryRow | null,
          part2: null as ScoreHistoryRow | null,
          part3: null as ScoreHistoryRow | null,
        };

        (historyRows || []).forEach((row) => {
          if (row.part_index === 1 && !resolvedParts.part1) resolvedParts.part1 = row as any;
          if (row.part_index === 2 && !resolvedParts.part2) resolvedParts.part2 = row as any;
          if (row.part_index === 3 && !resolvedParts.part3) resolvedParts.part3 = row as any;
        });

        setPartsData(resolvedParts);
        // Set tab aktif otomatis ke part pertama yang ada datanya
        if (resolvedParts.part1) setActivePart("part1");
        else if (resolvedParts.part2) setActivePart("part2");
        else if (resolvedParts.part3) setActivePart("part3");
      } else {
        // 3. Jika tunggal per-part
        const partKey = `part${targetRow.part_index || 1}`;
        setPartsData({
          overallScore: targetRow.score,
          part1: partKey === "part1" ? targetRow : null,
          part2: partKey === "part2" ? targetRow : null,
          part3: partKey === "part3" ? targetRow : null,
        });
        setActivePart(partKey);
      }

      setLoading(false);
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [queryId]);

  // Helper fungsi untuk mem-parse objek bersarang dengan aman
  const parseJsonField = (field: any) => {
    if (!field) return null;
    let temp = field;
    while (typeof temp === "string") {
      try {
        temp = JSON.parse(temp);
      } catch {
        break;
      }
    }
    return temp;
  };

  // Mengambil data spesifik dari part yang sedang aktif di tab UI
  const activePartPayload = useMemo(() => {
    const activeRow = partsData[activePart as keyof typeof partsData] as ScoreHistoryRow | null;
    if (!activeRow) return null;

  return {
      score: activeRow.score,
      notes: activeRow.notes, // 🌟 Amankan kolom notes langsung dari raw table row
      metrics: parseJsonField(activeRow.metrics),
      analysis: parseJsonField(activeRow.analysis),
    };
  }, [partsData, activePart]);

  // 💡 1. REKOMENDASI UTAMA BERDASARKAN HASIL EVALUASI AI ASLI
const aiRecommendationText = useMemo(() => {
    if (!activePartPayload) return "Tidak ada data rekomendasi untuk part ini.";
    
    // Utamakan ambil dari kolom 'notes' tabel database yang terisi string rekomendasi AI
    if (activePartPayload.notes && activePartPayload.notes !== "NULL") {
      return activePartPayload.notes;
    }

    const data = activePartPayload.analysis || activePartPayload.metrics || activePartPayload;
    return data.recommendation || data.suggestion || data.notes || "Evaluasi lengkap tersedia di dashboard.";
  }, [activePartPayload]);

  // 🧠 2. AI SUMMARY DESKRIPSI ASLI DARI DATABASE
const aiSummaryText = useMemo(() => {
    if (!activePartPayload) return "Tidak ada data ringkasan evaluasi untuk part ini di database.";
    
    // Ambil data analisis mendalam
    const data = activePartPayload.analysis || activePartPayload;
    
    // 🌟 SELESAI: Utamakan membaca data.text tempat ulasan panjang Groq lu disimpan!
    const finalSummary = data.text || data.analysis || data.feedback || data.summary;
    
    if (finalSummary && finalSummary !== "No description available") {
      return finalSummary;
    }
    
    return "Deskripsi evaluasi lengkap berhasil direkam di database.";
  }, [activePartPayload]);

  // 📊 3. KRITERIA BREAKDOWN (Lexical, Grammar, Fluency, Pronunciation) YANG VALID
const partMetricsDetail = useMemo(() => {
    if (!activePartPayload) return [];

    const dbMetrics = activePartPayload.metrics || activePartPayload.analysis?.metrics;

    if (Array.isArray(dbMetrics) && dbMetrics.length > 0) {
      return dbMetrics.map((m: any) => {
        // Mendukung format output lama ("label") maupun format baru database lu ("id")
        const labelName = m.label || m.id || "Component";
        // Ubah string pertama jadi huruf kapital biar cantik di UI (contoh: fluency -> Fluency)
        const formattedLabel = labelName.charAt(0).toUpperCase() + labelName.slice(1);
        
        return {
          label: formattedLabel,
          score: m.score !== undefined ? Number(m.score) : Number(activePartPayload.score),
          text: m.text || m.description || "Ulasan mendalam komponen nilai terekam dengan baik.",
        };
      });
    }

    return [];
  }, [activePartPayload]);

  // Mengambil skor tiap tombol tab di atas secara dinamis
  const tabScores = useMemo(() => {
    return {
      part1: partsData.part1?.score ?? null,
      part2: partsData.part2?.score ?? null,
      part3: partsData.part3?.score ?? null,
    };
  }, [partsData]);

return (
    <main className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 px-4 py-8 font-plus-jakarta-sans antialiased dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-gray-150 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.02]">
        
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3 dark:border-gray-800">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C95B5B]">Result</p>
            <h1 className="mt-1 text-xl font-bold text-gray-900 dark:text-white">Result Detail</h1>
          </div>
          <Link href="/dashboard/user" className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors">
            Back to dashboard
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-xs text-gray-400 text-center">Memuat riwayat evaluasi lengkap...</div>
        ) : error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>
        ) : (
          <div className="mt-5 space-y-5">
            
            {/* Score Overview */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-white/[0.01]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Overall Band Score</p>
                <p className="mt-1 text-4xl font-black text-[#C95B5B]">
                  {formatBand(partsData.overallScore ?? "-")}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-white/[0.01]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Session Type</p>
                <p className="mt-3 text-base font-bold text-gray-800 dark:text-gray-200">
                  {partsData.part1 && partsData.part2 && partsData.part3 ? "Full IELTS Mock Test" : "Single Part Practice"}
                </p>
              </div>
            </div>

            {/* Area Detail Per Tab */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">Hasil Analisis Speaking</h2>
              
              {/* Tab Switcher */}
              <div className="flex p-0.5 bg-gray-100 rounded-xl space-x-1 dark:bg-gray-800">
                {(["part1", "part2", "part3"] as const).map((part) => (
                  <button
                    key={part}
                    type="button"
                    onClick={() => setActivePart(part)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      activePart === part
                        ? "bg-white text-[#C95B5B] shadow-sm dark:bg-gray-900"
                        : "text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
                    }`}
                  >
                    <span className="uppercase">{part.replace("part", "Part ")}</span>
                    <span className="px-1.5 py-0.5 bg-red-50 text-[10px] rounded font-bold text-[#C95B5B] dark:bg-red-950/40">
                      {formatBand(tabScores[part] ?? "-")}
                    </span>
                  </button>
                ))}
              </div>

              {activePartPayload ? (
                <div className="space-y-4">
                  {/* Recommendation */}
                  <div className="rounded-xl border border-amber p-4 bg-white dark:border-[#C95B5B] dark:bg-white">
                    <p className="text-[10px] font-bold text-[#C95B5B] uppercase tracking-widest dark:text-red-400">
                      Recommendation ({activePart.toUpperCase()})
                    </p>
                    <p className="mt-1.5 text-xs font-semibold text-gray-800 leading-relaxed dark:text-gray-200">
                      {aiRecommendationText}
                    </p>
                  </div>

                  {/* AI Summary */}
                  <div className="rounded-xl border border-amber p-4 bg-white dark:border-[#C95B5B] dark:bg-white">
                    <p className="text-[10px] font-bold text-[#C95B5B] uppercase tracking-widest dark:text-red-400">
                      AI Summary ({activePart.toUpperCase()})
                    </p>
                    <p className="mt-1.5 text-xs text-gray-700 leading-relaxed font-medium text-justify whitespace-pre-line dark:text-gray-300">
                      {aiSummaryText}
                    </p>
                  </div>

                  {/* Breakdown Metrics */}
                  <div className="rounded-xl border border-gray-150 p-4 bg-white space-y-4 dark:border-gray-800 dark:bg-transparent">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Metrics Breakdown ({activePart.toUpperCase().replace("PART", "Part ")})
                    </p>

                    {partMetricsDetail.length > 0 ? (
                      <div className="space-y-3.5">
                        {partMetricsDetail.map((item: any, idx: number) => (
                          <div key={idx} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0 flex justify-between items-start gap-4 dark:border-gray-800">
                            <div className="space-y-0.5">
                              <span className="text-[11px] font-bold text-[#C95B5B] uppercase tracking-wide">
                                {item.label}
                              </span>
                              <p className="text-xs text-gray-600 leading-relaxed font-medium dark:text-gray-400">
                                {item.text}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 bg-red-50 text-[#C95B5B] font-bold rounded text-xs whitespace-nowrap dark:bg-red-950/30">
                              {formatBand(item.score)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 text-center py-4 italic">
                        Tidak ada breakdown komponen nilai yang disimpan untuk part ini.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-xs text-gray-400">
                  Data pengerjaan untuk {activePart.toUpperCase()} tidak ditemukan pada unit test ini.
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </main>
  );
}