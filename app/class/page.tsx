"use client";
import React, { useState } from "react";
import { AnalysisCard } from "@/components/ui/system/AnalysisCard";
import { supabase } from "@/lib/supabase";

export default function CoachClassPage() {
  const [partIndex, setPartIndex] = useState<number>(1);
  const [overall, setOverall] = useState<string>("7");
  const [lexical, setLexical] = useState<string>("7");
  const [grammar, setGrammar] = useState<string>("7");
  const [pronunciation, setPronunciation] = useState<string>("7");
  const [fluency, setFluency] = useState<string>("7");
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);

  const metrics = [
    { id: `lex-${Date.now()}`, label: "Lexical", score: String(lexical), text: "" },
    { id: `gram-${Date.now()}`, label: "Grammar", score: String(grammar), text: "" },
    { id: `pron-${Date.now()}`, label: "Pronunciation", score: String(pronunciation), text: "" },
    { id: `flu-${Date.now()}`, label: "Fluency", score: String(fluency), text: "" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    const latestScore = Number(overall);
    const progressPercent = Number(Math.max(0, Math.min(100, (latestScore / 9) * 100)).toFixed(1));

    const metricPayload = metrics.map((m) => ({ id: m.id, label: m.label, score: Number(m.score), text: m.text }));

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setStatus("no-auth");
      return;
    }

    try {
      const res = await fetch("/api/student-practice-progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          latest_score: latestScore,
          progress_percent: progressPercent,
          speaking_attempts: 1,
          last_activity_at: new Date().toISOString(),
          last_unit_index: null,
          last_part_index: partIndex,
          notes: notes || null,
          metrics: metricPayload,
        }),
      });
      if (!res.ok) throw new Error("save-failed");
      setStatus("saved");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Coach — Class Session (manual input)</h1>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700">Part</label>
          <select value={partIndex} onChange={(e) => setPartIndex(Number(e.target.value))} className="mt-1 rounded border-gray-200">
            <option value={1}>Part 1</option>
            <option value={2}>Part 2</option>
            <option value={3}>Part 3</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Overall score (0-9)</label>
          <input value={overall} onChange={(e) => setOverall(e.target.value)} className="mt-1 rounded border-gray-200" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Lexical</label>
            <input value={lexical} onChange={(e) => setLexical(e.target.value)} className="mt-1 rounded border-gray-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Grammar</label>
            <input value={grammar} onChange={(e) => setGrammar(e.target.value)} className="mt-1 rounded border-gray-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Pronunciation</label>
            <input value={pronunciation} onChange={(e) => setPronunciation(e.target.value)} className="mt-1 rounded border-gray-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fluency</label>
            <input value={fluency} onChange={(e) => setFluency(e.target.value)} className="mt-1 rounded border-gray-200" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Notes / Recommendation</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 rounded border-gray-200 w-full" rows={3} />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="px-4 py-2 bg-primary text-white rounded">Save</button>
          {status === 'saving' && <span>Saving…</span>}
          {status === 'saved' && <span className="text-green-600">Saved</span>}
          {status === 'error' && <span className="text-red-600">Error saving</span>}
          {status === 'no-auth' && <span className="text-yellow-600">Not signed in</span>}
        </div>
      </form>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Preview</h2>
        <AnalysisCard
          title={`Coach input — Part ${partIndex}`}
          overallScore={overall}
          level={""}
          metrics={metrics}
          partBreakdown={[{ label: `Part ${partIndex}`, score: overall, components: metrics }]}
        />
      </div>
    </div>
  );
}
