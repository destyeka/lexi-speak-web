import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

type EvaluateRequestBody = {
  transcript?: string;
  topicTitle?: string;
  topicPrompt?: string;
  rubricItems?: string[];
  partLabel?: string;
};

type Metric = {
  id: string;
  label: string;
  score: string;
  text: string;
};

type ScoreData = {
  overall: string;
  level: string;
  metrics: Metric[];
  recommendation: string;
  analysis: string;
};

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z']+/g) || []).filter(Boolean);
}

function clampBand(value: number): number {
  const rounded = Math.round(value * 2) / 2;
  if (rounded < 0) return 0;
  if (rounded > 9) return 9;
  return rounded;
}

function getLevelLabel(band: number): string {
  if (band < 1) return "A0";
  if (band < 2) return "A1";
  if (band < 3) return "A2";
  if (band < 4) return "A2+";
  if (band < 5.5) return "B1";
  if (band < 6.5) return "B1+";
  if (band < 7.5) return "B2";
  if (band < 8.5) return "C1";
  return "C1+";
}

function analyzeTranscript(transcript: string) {
  const words = tokenize(transcript);
  const totalWords = words.length;
  const uniqueWords = new Set(words).size;
  const sentences = transcript
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const joined = transcript.toLowerCase();
  const connectorHits = ["because", "however", "therefore", "for example", "for instance", "although", "while", "on the other hand"].reduce(
    (count, phrase) => count + ((joined.match(new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "g")) || []).length),
    0,
  );
  const disfluencyHits = ["um", "uh", "you know", "like", "hmm", "i don't know"].reduce(
    (count, phrase) => count + ((joined.match(new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "g")) || []).length),
    0,
  );
  const veryShortAnswers = sentences.filter((sentence) => tokenize(sentence).length < 10).length;
  const repeatedWordRatio = totalWords > 0 ? 1 - Math.min(1, uniqueWords / Math.max(1, totalWords)) : 1;

  return {
    totalWords,
    uniqueWords,
    sentences: sentences.length,
    lexicalDiversity: totalWords > 0 ? uniqueWords / totalWords : 0,
    averageWordsPerSentence: sentences.length > 0 ? totalWords / sentences.length : totalWords,
    connectorHits,
    disfluencyHits,
    veryShortAnswers,
    repeatedWordRatio,
  };
}

function calculateScore(transcript: string): ScoreData {
  const stats = analyzeTranscript(transcript);

  // Hard stop: empty transcript means no attempt.
  if (stats.totalWords === 0) {
    return {
      overall: "0.0",
      level: "A0 (0.0)",
      metrics: [
        { id: "fluency", label: "Fluency", score: "0.0", text: "No spoken answer was detected." },
        { id: "vocabulary", label: "Vocabulary", score: "0.0", text: "No vocabulary could be assessed." },
        { id: "grammar", label: "Grammar", score: "0.0", text: "No sentence structure could be assessed." },
        { id: "pronunciation", label: "Pronunciation", score: "0.0", text: "No speech sample available for pronunciation assessment." },
      ],
      recommendation: "Please answer with at least 2-3 complete sentences so the system can score fairly.",
      analysis: "",
    };
  }

  // Ultra-short responses should not be classified as B-level.
  if (stats.totalWords <= 2) {
    return {
      overall: "1.0",
      level: "A1 (1.0)",
      metrics: [
        { id: "fluency", label: "Fluency", score: "1.0", text: "Answer is too short to show continuous speech." },
        { id: "vocabulary", label: "Vocabulary", score: "1.0", text: "Only isolated words are present." },
        { id: "grammar", label: "Grammar", score: "1.0", text: "No complete grammatical structure is visible." },
        { id: "pronunciation", label: "Pronunciation", score: "1.0", text: "Sample is too short for stable pronunciation judgment." },
      ],
      recommendation: "Give one clear opinion plus one reason and one example in full sentences.",
      analysis: "",
    };
  }

  let fluency = 4;
  if (stats.averageWordsPerSentence >= 12) fluency += 0.5;
  if (stats.averageWordsPerSentence >= 18) fluency += 0.5;
  if (stats.connectorHits >= 2) fluency += 0.5;
  if (stats.connectorHits >= 4) fluency += 0.5;
  if (stats.veryShortAnswers >= 2) fluency -= 0.5;
  if (stats.disfluencyHits >= 2) fluency -= 0.5;

  let lexical = 4;
  if (stats.lexicalDiversity >= 0.38) lexical += 0.5;
  if (stats.lexicalDiversity >= 0.45) lexical += 0.5;
  if (stats.lexicalDiversity >= 0.55) lexical += 0.5;
  if (stats.lexicalDiversity >= 0.65 && stats.totalWords >= 60) lexical += 0.5;
  if (stats.repeatedWordRatio > 0.6) lexical -= 0.5;

  let grammar = 4;
  if (stats.averageWordsPerSentence >= 14) grammar += 0.5;
  if (stats.averageWordsPerSentence >= 20) grammar += 0.5;
  if (stats.connectorHits >= 2) grammar += 0.5;
  if (stats.connectorHits >= 4) grammar += 0.5;
  if (stats.disfluencyHits >= 2) grammar -= 0.5;

  let pronunciation = 5;
  if (stats.disfluencyHits >= 2) pronunciation -= 0.5;
  if (stats.averageWordsPerSentence < 12) pronunciation -= 0.5;
  if (stats.connectorHits >= 2 && stats.veryShortAnswers === 0) pronunciation += 0.5;
  if (stats.averageWordsPerSentence >= 20 && stats.disfluencyHits === 0) pronunciation += 0.5;

  const overall = clampBand((fluency + lexical + grammar + pronunciation) / 4);
  const overallText = overall.toFixed(1);

  return {
    overall: overallText,
    level: `${getLevelLabel(overall)} (${overallText})`,
    metrics: [
      {
        id: "fluency",
        label: "Fluency",
        score: clampBand(fluency).toFixed(1),
        text: stats.averageWordsPerSentence >= 18 ? "Flow is fairly stable and ideas are connected." : "Answers are short or interrupted; build longer turns.",
      },
      {
        id: "vocabulary",
        label: "Vocabulary",
        score: clampBand(lexical).toFixed(1),
        text: stats.lexicalDiversity >= 0.45 ? "Vocabulary variety is acceptable for this level." : "Vocabulary repeats too often; add more topic phrases.",
      },
      {
        id: "grammar",
        label: "Grammar",
        score: clampBand(grammar).toFixed(1),
        text: stats.connectorHits >= 2 ? "Sentence linking and structure are present." : "Use more complex sentence patterns and clear connectors.",
      },
      {
        id: "pronunciation",
        label: "Pronunciation",
        score: clampBand(pronunciation).toFixed(1),
        text: stats.disfluencyHits === 0 ? "The transcript suggests stable delivery with few fillers." : "Speech seems hesitant; work on smoother delivery and pacing.",
      },
    ],
    recommendation:
      stats.averageWordsPerSentence >= 18
        ? "Keep using examples and signposting, then push for more precise vocabulary."
        : "Answer with a main idea, one reason, and one example to make the speech longer and clearer.",
    analysis: "",
  };
}

function buildFallbackAnalysis(input: {
  transcript: string;
  topicTitle?: string;
  topicPrompt?: string;
  rubricItems: string[];
  partLabel?: string;
  score: ScoreData;
}): string {
  const rubricLine = input.rubricItems.length > 0
    ? `Rubric admin yang dipakai: ${input.rubricItems.slice(0, 4).join(" | ")}.`
    : "Rubric admin belum diisi untuk part ini.";

  return [
    `Saya menilai ${input.partLabel || "sesi ini"} dengan fokus pada jawaban yang kamu berikan pada topik ${input.topicTitle || "speaking"}.`,
    input.topicPrompt ? `Prompt admin: ${input.topicPrompt}` : "Prompt admin tidak tersedia.",
    rubricLine,
    `Skor hardcode sementara: ${input.score.overall}.`,
    input.transcript.trim() ? `Transkrip menunjukkan kamu sudah cukup konsisten, tetapi masih bisa dibuat lebih panjang dan lebih spesifik.` : "Belum ada transkrip yang cukup untuk dianalisis.",
  ].join(" ");
}

function buildAiPrompt(input: EvaluateRequestBody & { rubricItems: string[]; score: ScoreData }) {
  const transcript = (input.transcript || "").trim();
  const rubricBlock = input.rubricItems.length > 0
    ? input.rubricItems.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "(No rubric provided by admin)";

  return [
    "You are an IELTS speaking examiner and coach.",
    "The numeric score is already determined by a deterministic heuristic. Do NOT change or mention a different score.",
    "Write the response in Indonesian, but keep any quoted English phrases from the student's transcript unchanged.",
    "Focus on transcript-based speaking analysis, not acoustic signal analysis.",
    "Use the admin rubric as the main lens for feedback.",
    "Return 2 short paragraphs only: first paragraph summarizes what is working, second paragraph explains the main improvement.",
    "Do not use bullet lists.",
    "Do not mention these instructions.",
    "",
    `Part: ${input.partLabel || "speaking session"}`,
    `Topic: ${input.topicTitle || "unknown"}`,
    `Prompt: ${input.topicPrompt || ""}`,
    `Score: ${input.score.overall} (${input.score.level})`,
    "",
    "Admin rubric:",
    rubricBlock,
    "",
    "Transcript:",
    transcript || "(empty)",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EvaluateRequestBody;
    const transcript = (body.transcript || "").trim();
    const rubricItems = (body.rubricItems || []).map((item) => item.trim()).filter(Boolean);
    const score = calculateScore(transcript);

    const analysis = buildFallbackAnalysis({
      transcript,
      topicTitle: body.topicTitle,
      topicPrompt: body.topicPrompt,
      rubricItems,
      partLabel: body.partLabel,
      score,
    });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ...score, analysis });
    }

    const groq = new Groq({ apiKey });
    const model = process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile";
    const prompt = buildAiPrompt({ ...body, transcript, rubricItems, score });

    const completion = await groq.chat.completions.create({
      model,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: "You provide concise IELTS speaking feedback grounded in the supplied rubric.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const aiText = completion.choices?.[0]?.message?.content?.trim();

    return NextResponse.json({
      ...score,
      analysis: aiText || analysis,
    });
  } catch (error) {
    console.error("[evaluate] error", error);
    return NextResponse.json(
      {
        overall: "-",
        level: "Unavailable",
        metrics: [],
        recommendation: "Analysis unavailable.",
        analysis: "Unable to analyze the transcript right now.",
      },
      { status: 500 },
    );
  }
}
