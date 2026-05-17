import { getTopicsByPart } from "@/lib/question-fetcher";

export async function GET() {
  try {
    const topics = await getTopicsByPart(1);
    return Response.json({
      success: true,
      count: topics.length,
      topics: topics,
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: String(error),
    });
  }
}
