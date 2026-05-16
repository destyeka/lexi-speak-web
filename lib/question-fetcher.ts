import { supabase } from "@/lib/supabase";

export type TopicDetail = {
  id: string;
  type: "question" | "bullet";
  content: string;
  order_index: number;
};

export type Topic = {
  id: string;
  part: number;
  title: string;
  prompt?: string;
  is_active: boolean;
  created_at: string;
  details: TopicDetail[];
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
        details: (topic.topic_details || []).sort(
          (a, b) => (a.order_index || 0) - (b.order_index || 0),
        ),
      })) || []
    );
  } catch (error) {
    console.error("Error fetching topics by part:", error);
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
