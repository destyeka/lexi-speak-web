import { supabase } from "@/lib/supabase";

export async function getAdminSummary() {
  const [{ count: users }, { count: attempts }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("attempts").select("*", { count: "exact", head: true }),
  ]);

  const { data: scores } = await supabase
    .from("attempts")
    .select("score");

  const avgScore =
    scores && scores.length
      ? scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length
      : 0;

  return {
    totalUsers: users || 0,
    totalAttempts: attempts || 0,
    avgScore: avgScore.toFixed(2),
  };
}

export async function getActivityTrend() {
  const { data } = await supabase
    .from("attempts")
    .select("created_at");

  const grouped: Record<string, number> = {};

  data?.forEach((d) => {
    const date = d.created_at.split("T")[0];
    grouped[date] = (grouped[date] || 0) + 1;
  });

  return Object.entries(grouped).map(([date, count]) => ({
    date,
    count,
  }));
}

export async function getScoreTrend() {
  const { data } = await supabase
    .from("attempts")
    .select("created_at, score");

  const grouped: Record<string, { total: number; count: number }> = {};

  data?.forEach((d) => {
    const date = d.created_at.split("T")[0];

    if (!grouped[date]) {
      grouped[date] = { total: 0, count: 0 };
    }

    grouped[date].total += d.score || 0;
    grouped[date].count += 1;
  });

  return Object.entries(grouped).map(([date, val]) => ({
    date,
    avg: val.total / val.count,
  }));
}