import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    // Check all topics without filters
    const { data: allTopics, error: allError } = await supabase
      .from("topics")
      .select("id, part, title, is_active");

    // Check topics where is_active = true
    const { data: activeTopics, error: activeError } = await supabase
      .from("topics")
      .select("id, part, title, is_active")
      .eq("is_active", true);

    // Check topics for each part
    const { data: part1, error: part1Error } = await supabase
      .from("topics")
      .select("id, part, title, is_active")
      .eq("part", 1);

    const { data: part2, error: part2Error } = await supabase
      .from("topics")
      .select("id, part, title, is_active")
      .eq("part", 2);

    const { data: part3, error: part3Error } = await supabase
      .from("topics")
      .select("id, part, title, is_active")
      .eq("part", 3);

    return Response.json({
      all: { count: allTopics?.length || 0, error: allError?.message, data: allTopics },
      active: { count: activeTopics?.length || 0, error: activeError?.message, data: activeTopics },
      part1: { count: part1?.length || 0, error: part1Error?.message, data: part1 },
      part2: { count: part2?.length || 0, error: part2Error?.message, data: part2 },
      part3: { count: part3?.length || 0, error: part3Error?.message, data: part3 },
    });
  } catch (error) {
    return Response.json({
      error: String(error),
    });
  }
}
