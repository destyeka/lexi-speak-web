import { supabase } from "@/lib/supabase";

export type TopicDetail = {
  id: string;
  type: "question" | "bullet" | string;
  content: string;
  prompt?: string | null;
  rubric?: string | null;
  order_index: number;
};

export type Topic = {
  id: string;
  unit_id?: string;
  topic_code?: string;
  part: number;
  title: string;
  prompt?: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  details: TopicDetail[];
};

export interface AssignmentQuestion {
  id: string;
  assignment_id?: string;
  type?: "question" | "bullet" | string;
  content: string;
  prompt?: string | null;
  order_index: number;
  rubric?: string | null;
}

export interface AssignmentRecord {
  id: string;
  class_id: string;
  part: number;
  title: string;
  prompt?: string | null;
  description?: string | null;
  start_at: string | null;
  due_at: string | null;
  is_active: boolean;
  created_at: string | null;
};

/**
 * Fetch all active topics for a specific IELTS part
 */
export async function getTopicsByPart(part: number): Promise<Topic[]> {
  try {
    const { data: topics, error } = await supabase
      .from("topics")
      .select(
        `
        id,
        part,
        title,
        prompt,
        is_active,
        created_at,
        topic_details (
          id,
          type,
          content,
          rubric,
          order_index
        )
      `,
      )
      .eq("part", part)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching topics:", error);
      return [];
    }

    // Sort details by order_index
    return (
      topics?.map((topic) => ({
        ...topic,
        details: (() => {
          const details: TopicDetail[] = ((topic.topic_details as TopicDetail[] | undefined) || []).slice();
          details.sort((a: TopicDetail, b: TopicDetail) => (a.order_index || 0) - (b.order_index || 0));
          return details;
        })(),
      })) || []
    );
  } catch (error) {
    console.error("Error fetching topics by part:", error);
    return [];
  }
}

export async function getAssignmentQuestions(assignmentId: string): Promise<AssignmentQuestion[]> {
  try {
    const { data, error } = await supabase
      .from("assignment_questions")
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("order_index", { ascending: true });

    if (error) {
      console.error("Error fetching assignment questions:", error);
      return [];
    }

    return (data as AssignmentQuestion[]) || [];
  } catch (error) {
    console.error("Error fetching assignment questions:", error);
    return [];
  }
}

export async function getAssignmentTopics(assignmentId: string): Promise<Topic[]> {
  try {
    const { data: assignment, error: assignmentError } = await supabase
      .from("assignments")
      .select("id, part, title, description, is_active, created_at")
      .eq("id", assignmentId)
      .maybeSingle();

    if (assignmentError) {
      console.error("Error fetching assignment:", assignmentError);
      return [];
    }

    if (!assignment) {
      return [];
    }

    const questions = await getAssignmentQuestions(assignmentId);
    const details: TopicDetail[] = questions.map((question) => ({
      id: question.id,
      type: question.type || "question",
      content: question.content,
      prompt: question.prompt ?? null,
      rubric: question.rubric ?? null,
      order_index: question.order_index,
    }));

    const assignmentPrompt = assignment.description?.trim() ||
      details.find((d) => d.type === "question" && d.prompt && d.prompt.trim().length > 0)?.prompt?.trim() ||
      "";

    return [
      {
        id: assignment.id,
        part: assignment.part,
        title: assignment.title,
        prompt: assignmentPrompt,
        description: assignment.description ?? null,
        is_active: assignment.is_active,
        created_at: assignment.created_at || new Date().toISOString(),
        details,
      },
    ];
  } catch (error) {
    console.error("Error fetching assignment topics:", error);
    return [];
  }
}

/**
 * Get questions from a topic (filter by type='question')
 */
export function getQuestionsFromTopic(topic: Topic): string[] {
  return topic.details
    .filter((detail) => detail.type === "question")
    .map((detail) => detail.content);
}

/**
 * Get bullets from a topic (filter by type='bullet')
 */
export function getBulletsFromTopic(topic: Topic): string[] {
  return topic.details
    .filter((detail) => detail.type === "bullet")
    .map((detail) => detail.content);
}

/**
 * Get random topic from part
 */
export async function getRandomTopicFromPart(part: number): Promise<Topic | null> {
  const topics = await getTopicsByPart(part);
  if (topics.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * topics.length);
  return topics[randomIndex];
}

/**
 * Get multiple random topics from part (for Part 1 style with multiple topics)
 */
export async function getRandomTopicsFromPart(
  part: number,
  count: number = 2,
): Promise<Topic[]> {
  const topics = await getTopicsByPart(part);
  if (topics.length === 0) return [];

  // Fisher-Yates shuffle
  const shuffled = [...topics];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Get topics by unit identifier. The unitId may be a numeric part ("1", "2")
 * or a UUID for a unit record. This helper tries to be tolerant and will
 * delegate to `getTopicsByPart` when `unitId` looks like a small integer.
 */
export async function getTopicsByUnit(
  unitId: string | null,
  mode: "learn" | "test" | null = null,
): Promise<Topic[]> {
  if (!unitId) return [];

  // If unitId is numeric, treat it as dashboard unit index and resolve via session_units.
  const asNum = parseInt(unitId, 10);
  if (!isNaN(asNum) && String(asNum) === unitId) {
    try {
      const sessionType = mode === "test" ? "test" : "practice";
      const normalizeTopics = (topics: any[]): Topic[] => {
        return (
          topics?.map((topic) => ({
            ...topic,
            details: (() => {
              const details: TopicDetail[] = ((topic.topic_details as TopicDetail[] | undefined) || []).slice();
              details.sort((a: TopicDetail, b: TopicDetail) => (a.order_index || 0) - (b.order_index || 0));
              return details;
            })(),
          })) || []
        );
      };

      const pickBestUnitTopics = (topics: Topic[]): Topic[] => {
        if (!topics.length) return [];
        const groups = new Map<string, Topic[]>();
        for (const topic of topics) {
          const key = topic.unit_id || "";
          if (!key) continue;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(topic);
        }
        if (!groups.size) return topics;

        const ranked = Array.from(groups.entries())
          .map(([unit, rows]) => {
            const parts = new Set(rows.map((r) => r.part));
            const hasPart2 = parts.has(2);
            const latest = Math.max(
              ...rows.map((r) => new Date(r.created_at || 0).getTime() || 0),
            );
            return { unit, rows, partCount: parts.size, hasPart2, latest };
          })
          .sort((a, b) => {
            if (a.hasPart2 !== b.hasPart2) return a.hasPart2 ? -1 : 1;
            if (a.partCount !== b.partCount) return b.partCount - a.partCount;
            return b.latest - a.latest;
          });

        return ranked[0].rows.sort((a, b) => a.part - b.part);
      };

      const fetchTopicsByTopicCodePattern = async (): Promise<Topic[]> => {
        const seqFormatted = String(asNum).padStart(4, "0");
        const modePrefix = sessionType === "test" ? "TS" : "PT";

        const { data: topicRows, error: topicRowsError } = await supabase
          .from("topics")
          .select(
            `
            id,
            unit_id,
            topic_code,
            part,
            title,
            prompt,
            is_active,
            created_at,
            topic_details (
              id,
              type,
              content,
              rubric,
              order_index
            )
          `,
          )
          .eq("session", sessionType)
          .eq("is_active", true)
          .ilike("topic_code", `${modePrefix}%-${seqFormatted}-P%`)
          .order("created_at", { ascending: false });

        if (topicRowsError) {
          console.error("Error resolving topics by topic_code pattern:", topicRowsError);
          return [];
        }

        return pickBestUnitTopics(normalizeTopics(topicRows || []));
      };

      const fetchTopicsByUnitId = async (resolvedUnitId: string): Promise<Topic[]> => {
        const { data: topics, error } = await supabase
          .from("topics")
          .select(
            `
            id,
            unit_id,
            topic_code,
            part,
            title,
            prompt,
            is_active,
            created_at,
            topic_details (
              id,
              type,
              content,
              rubric,
              order_index
            )
          `,
          )
          .eq("unit_id", resolvedUnitId)
          .eq("is_active", true)
          .order("part", { ascending: true });

        if (error) {
          console.error("Error fetching topics by resolved unit:", error);
          return [];
        }

        return normalizeTopics(topics || []);
      };

      const { data: unitRows, error: unitError } = await supabase
        .from("session_units")
        .select("id, type, seq, is_active, created_at")
        .eq("seq", asNum)
        .eq("type", sessionType)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (unitError) {
        console.error("Error resolving session unit by index:", unitError);
        return [];
      }

      const indexedUnitId = unitRows?.[0]?.id as string | undefined;
      let resolvedUnitId = indexedUnitId;

      // Fallback when mode does not match available unit type.
      if (!resolvedUnitId) {
        const { data: fallbackUnits, error: fallbackUnitError } = await supabase
          .from("session_units")
          .select("id, seq, is_active, created_at")
          .eq("seq", asNum)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1);

        if (fallbackUnitError) {
          console.error("Error resolving fallback session unit by index:", fallbackUnitError);
          return [];
        }

        resolvedUnitId = fallbackUnits?.[0]?.id as string | undefined;
      }

      if (!resolvedUnitId) {
        return await fetchTopicsByTopicCodePattern();
      }

      let resolvedTopics = await fetchTopicsByUnitId(resolvedUnitId);
      const hasPart2 = resolvedTopics.some((topic) => topic.part === 2);

      // If indexed unit exists but content is incomplete, use latest active unit for that mode.
      if (indexedUnitId && (!resolvedTopics.length || !hasPart2)) {
        const { data: latestUnits, error: latestUnitError } = await supabase
          .from("session_units")
          .select("id")
          .eq("type", sessionType)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!latestUnitError) {
          const latestUnitId = latestUnits?.[0]?.id as string | undefined;
          if (latestUnitId && latestUnitId !== indexedUnitId) {
            const latestTopics = await fetchTopicsByUnitId(latestUnitId);
            if (latestTopics.some((topic) => topic.part === 2)) {
              resolvedTopics = latestTopics;
            }
          }
        }
      }

      if (!resolvedTopics.length || !resolvedTopics.some((topic) => topic.part === 2)) {
        const byPattern = await fetchTopicsByTopicCodePattern();
        if (byPattern.length) resolvedTopics = byPattern;
      }

      return resolvedTopics;
    } catch (error) {
      console.error("Error resolving topics by unit index:", error);
      return [];
    }
  }

  try {
    const { data: topics, error } = await supabase
      .from("topics")
      .select(
        `
        id,
        unit_id,
        part,
        title,
        prompt,
        is_active,
        created_at,
        topic_details (
          id,
          type,
          content,
          order_index
        )
      `,
      )
      .eq("unit_id", unitId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching topics by unit:", error);
      return [];
    }

    return (
      topics?.map((topic) => ({
        ...topic,
        details: (topic.topic_details || []).sort(
          (a, b) => (a.order_index || 0) - (b.order_index || 0),
        ),
      })) || []
    );
  } catch (error) {
    console.error("Error fetching topics by unit:", error);
    return [];
  }
}
