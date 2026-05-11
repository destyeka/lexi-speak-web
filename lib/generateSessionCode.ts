import { supabase } from "@/lib/supabase";

type Params = {
  session: "practice" | "test";
  category: string;
  categoryCode: string;
};

export async function generateSessionCode({
  session,
  category,
  categoryCode,
}: Params) {

  const mode =
    session === "test"
      ? "TS"
      : "PT";

  const { data } = await supabase
    .from("session_units")
    .select("seq")
    .eq("type", session)
    .eq("category_code", categoryCode)
    .order("seq", { ascending: false })
    .limit(1);

  const nextSeq =
    (data?.[0]?.seq || 0) + 1;

  const seqFormatted =
    String(nextSeq).padStart(4, "0");

  const sessionCode =
    `${mode}${categoryCode}-${seqFormatted}`;

  return {
    sessionCode,
    seq: nextSeq,
    categoryCode,
  };
}