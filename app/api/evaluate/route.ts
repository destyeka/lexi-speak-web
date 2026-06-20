import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
  const rounded = Math.round(value * 2) / 2; // Pembulatan standar IELTS (kelipatan 0.5)
  if (rounded < 0) return 0;
  if (rounded > 9) return 9;
  return rounded;
}

function getLevelLabel(band: number): string {
  if (band < 4.0) return "A1/A2 (Basic)";
  if (band < 5.5) return "B1 (Intermediate)";
  if (band < 6.5) return "B1+ (Highly Intermediate)";
  if (band < 7.5) return "B2 (Vantage/Upper)";
  if (band < 8.5) return "C1 (Advanced)";
  return "C2 (Mastery)";
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

  // Indikator Penanda Wacana & Konjungsi (IELTS Connectives & Discourse Markers)
  const advancedConnectors = ["however", "therefore", "nevertheless", "consequently", "furthermore", "on the other hand", "although", "whereas"].reduce(
    (count, w) => count + ((joined.match(new RegExp(`\\b${w}\\b`, "g")) || []).length), 0
  );

  const simpleConnectors = ["and", "but", "because", "so", "then"].reduce(
    (count, w) => count + ((joined.match(new RegExp(`\\b${w}\\b`, "g")) || []).length), 0
  );

  // Deteksi Jeda Gagap Alami (Hanya um, uh, hmm yang dihitung sebagai gejala penundaan bahasa)
  const hesitationHits = ["um", "uh", "hmm"].reduce(
    (count, w) => count + ((joined.match(new RegExp(`\\b${w}\\b`, "g")) || []).length), 0
  );

  const longSentences = sentences.filter((s) => tokenize(s).length >= 12).length;
  const simpleSentences = sentences.filter((s) => tokenize(s).length > 0 && tokenize(s).length < 7).length;
  const repeatedWordRatio = totalWords > 0 ? 1 - (uniqueWords / totalWords) : 1;

  return {
    totalWords,
    uniqueWords,
    sentencesCount: sentences.length,
    lexicalDiversity: totalWords > 0 ? uniqueWords / totalWords : 0,
    averageSentenceLength: sentences.length > 0 ? totalWords / sentences.length : totalWords,
    advancedConnectors,
    simpleConnectors,
    hesitationHits,
    longSentences,
    simpleSentences,
    repeatedWordRatio,
  };
}

function calculateScore(transcript: string): ScoreData {
  const stats = analyzeTranscript(transcript);
  const wordCount = stats.totalWords;

  // BAND 0 - 2: Tidak ada usaha atau komunikasi tidak dimungkinkan
  if (wordCount === 0) {
    return {
      overall: "0.0", level: "Band 0",
      metrics: [
        { id: "fluency", label: "Fluency & Coherence", score: "0.0", text: "Tidak tampak bahasa yang dapat dinilai (Band 0)." },
        { id: "vocabulary", label: "Lexical Resource", score: "0.0", text: "Tidak tampak bahasa yang dapat dinilai (Band 0)." },
        { id: "grammar", label: "Grammar Range & Accuracy", score: "0.0", text: "Tidak tampak bahasa yang dapat dinilai (Band 0)." },
        { id: "pronunciation", label: "Pronunciation", score: "0.0", text: "Tidak tampak bahasa yang dapat dinilai (Band 0)." }
      ],
      recommendation: "Silakan berikan jawaban suara lisan untuk memulai proses penilaian.", analysis: ""
    };
  }
  if (wordCount <= 4) {
    return {
      overall: "2.0", level: "Band 2",
      metrics: [
        { id: "fluency", label: "Fluency & Coherence", score: "2.0", text: "Jeda sangat lama sebelum pengucapan sebagian besar kata; komunikasi jarang terjadi." },
        { id: "vocabulary", label: "Lexical Resource", score: "2.0", text: "Hanya menghasilkan kata-kata terpisah atau pengucapan hafalan." },
        { id: "grammar", label: "Grammar Range & Accuracy", score: "2.0", text: "Tidak dapat memproduksi bentuk kalimat dasar." },
        { id: "pronunciation", label: "Pronunciation", score: "2.0", text: "Pidato atau artikulasi kata sering kali tidak dapat dipahami." }
      ],
      recommendation: "Cobalah untuk menyusun minimal satu kalimat utuh yang terdiri dari subjek dan kata kerja.", analysis: ""
    };
  }

  // =========================================================
  // LOGIKA PENILAIAN BERDASARKAN KRITERIA INDIKATOR IELTS
  // =========================================================

  let fluency = 3.0;
  let lexical = 3.0;
  let grammar = 3.0;
  let pronunciation = 3.0;

  // --- 1. EVALUASI FLUENCY & COHERENCE ---
  if (wordCount >= 90 && stats.advancedConnectors >= 3 && stats.hesitationHits <= 2) {
    fluency = 8.5; // Dekat ke Band 9: Berbicara lancar, repetisi jarang, fitur kohesif tepat.
  } else if (wordCount >= 65 && stats.advancedConnectors >= 2 && stats.hesitationHits <= 4) {
    fluency = 7.0; // Band 7: Berbicara panjang lebar tanpa susah payah, menggunakan penanda wacana fleksibel.
  } else if (wordCount >= 35 && stats.simpleConnectors >= 3) {
    fluency = 6.0; // Band 6: Mampu berbicara panjang lebar, namun ada kalanya kehilangan koherensi atau terjadi repetisi.
  } else if (wordCount >= 15) {
    fluency = 5.0; // Band 5: Biasanya menjaga alur bicara, tapi sering melambat; penanda wacana berlebihan/monoton.
  } else {
    fluency = 4.0; // Band 4: Menautkan kalimat dasar secara repetitif, tidak dapat merespons tanpa jeda yang terlihat.
  }

  // --- 2. EVALUASI LEXICAL RESOURCE ---
  if (stats.lexicalDiversity >= 0.65 && wordCount >= 60) {
    lexical = 8.5; // Band 8/9: Fleksibilitas dan presisi penuh, kaya akan kosakata idiomatik alami.
  } else if (stats.lexicalDiversity >= 0.52 && wordCount >= 40) {
    lexical = 7.0; // Band 7: Membahas berbagai topik secara fleksibel, menggunakan kosakata kurang umum/kolokasi.
  } else if (stats.lexicalDiversity >= 0.42) {
    lexical = 6.0; // Band 6: Kosakata cukup luas untuk membahas topik panjang lebar, makna jelas meski ada salah pilih kata.
  } else if (stats.lexicalDiversity >= 0.30) {
    lexical = 5.0; // Band 5: Mampu bicara topik familiar, fleksibilitas terbatas, sering salah pilih kata.
  } else {
    lexical = 4.0; // Band 4: Hanya menyampaikan makna mendasar pada topik familiar, jarang mengupayakan parafrasa.
  }

  // --- 3. EVALUASI GRAMMAR RANGE & ACCURACY ---
  if (stats.longSentences >= 4 && stats.simpleSentences <= 1) {
    grammar = 8.5; // Band 8/9: Berbagai struktur kompleks digunakan secara alami, konsisten akurat.
  } else if (stats.longSentences >= 2 && stats.advancedConnectors >= 1) {
    grammar = 7.0; // Band 7: Menggunakan berbagai struktur kompleks dengan fleksibilitas yang cukup baik.
  } else if (stats.longSentences >= 1 || stats.averageSentenceLength >= 10) {
    grammar = 6.0; // Band 6: Campuran struktur sederhana dan kompleks, kesalahan jarang mengganggu pemahaman.
  } else if (stats.simpleSentences >= 2) {
    grammar = 5.0; // Band 5: Kalimat dasar akurat, struktur kompleks sangat terbatas dan biasanya berisi kesalahan.
  } else {
    grammar = 4.0; // Band 4: Membuat kalimat dasar tapi jarang menggunakan struktur anak kalimat; sering salah.
  }

  // --- 4. EVALUASI PRONUNCIATION (Estimasi Alur) ---
  if (stats.hesitationHits === 0 && wordCount >= 50) pronunciation = 8.5;
  else if (stats.hesitationHits <= 2) pronunciation = 7.0;
  else if (stats.hesitationHits <= 5) pronunciation = 6.0;
  else if (stats.hesitationHits <= 8) pronunciation = 5.0;
  else pronunciation = 4.0;

  // Hitung Nilai Akhir
  const overall = clampBand((fluency + lexical + grammar + pronunciation) / 4);
  const overallText = overall.toFixed(1);

  // Pemetaan Teks Keterangan Dinamis Berdasarkan Band Hasil Mengikuti Aturan Rubrik Anda
  const getMetricText = (id: string, score: number) => {
    if (id === "fluency") {
      if (score >= 8.0) return "Berbicara lancar dengan repetisi jarang; keraguan berbasis konten bukan mencari kata. Koheren dan tepat.";
      if (score >= 7.0) return "Berbicara panjang lebar tanpa susah payah. Menggunakan serangkaian partikel penghubung dengan baik.";
      if (score >= 6.0) return "Rela berbicara panjang lebar; terkadang kehilangan koherensi akibat repetisi atau koreksi diri sesekali.";
      if (score >= 5.0) return "Biasanya menjaga alur bicara, tetapi menggunakan repetisi/pelambatan untuk mempertahankan penuturan.";
      return "Tidak dapat merespons tanpa jeda terlihat; menautkan kalimat dasar namun menggunakan konjungsi sederhana secara repetitif.";
    }
    if (id === "vocabulary") {
      if (score >= 8.0) return "Kosakata fleksibel dengan presisi penuh; penggunaan bahasa idiomatik secara alami dan akurat.";
      if (score >= 7.0) return "Menggunakan kosakata secara fleksibel untuk berbagai topik; menunjukkan kesadaran akan gaya bahasa dan kolokasi.";
      if (score >= 6.0) return "Kosakata cukup luas untuk membuat makna jelas; umumnya sukses melakukan parafrasa.";
      return "Kosakata terbatas; berusaha melakukan parafrasa tetapi tidak selalu konsisten dan sering salah dalam pemilihan kata.";
    }
    if (id === "grammar") {
      if (score >= 8.0) return "Menggunakan berbagai struktur kompleks secara alami dan tepat; kalimat akurat secara konsisten.";
      if (score >= 7.0) return "Menggunakan berbagai struktur kompleks dengan fleksibilitas baik; sering membuat kalimat bebas kesalahan.";
      if (score >= 6.0) return "Menggunakan campuran struktur sederhana dan kompleks; kesalahan pada struktur kompleks jarang mengganggu pemahaman.";
      return "Menghasilkan kalimat dasar dengan akurasi wajar; struktur kompleks terbatas dan biasanya mengandung kesalahan.";
    }
    return score >= 7.0 ? "Mudah dipahami di seluruh penuturan; pengaruh aksen lokal sangat minimal pada kejelasan." : "Secara umum dapat dipahami, meski salah pelafalan pada kata atau bunyi tertentu terkadang mengurangi kejelasan.";
  };

  return {
    overall: overallText,
    level: `Band ${overallText} - ${getLevelLabel(overall)}`,
    metrics: [
      { id: "fluency", label: "Fluency & Coherence", score: clampBand(fluency).toFixed(1), text: getMetricText("fluency", fluency) },
      { id: "vocabulary", label: "Lexical Resource", score: clampBand(lexical).toFixed(1), text: getMetricText("vocabulary", lexical) },
      { id: "grammar", label: "Grammar Range & Accuracy", score: clampBand(grammar).toFixed(1), text: getMetricText("grammar", grammar) },
      { id: "pronunciation", label: "Pronunciation", score: clampBand(pronunciation).toFixed(1), text: getMetricText("pronunciation", pronunciation) }
    ],
    recommendation: overall >= 7.0
      ? "Luar biasa! Pertahankan penggunaan struktur kompleks ini dan tingkatkan variasi ekspresi idiomatik tingkat lanjut."
      : "Untuk menaikkan band, fokuslah pada penggunaan kata penghubung transisi (seperti 'however', 'consequently') dan hindari mengulang kata yang sama.",
    analysis: ""
  };
}

function buildAiPrompt(input: EvaluateRequestBody & { rubricItems: string[]; score: ScoreData }) {
  const transcript = (input.transcript || "").trim();
  return [
    "You are an official IELTS Speaking Examiner.",
    `The candidate has achieved a deterministic baseline score of Band ${input.score.overall} based on mathematical linguistic density. Your evaluation must completely align with this band level.`,
    "Write your feedback in Indonesian, but keep any raw English words or phrases quoted directly from the transcript unchanged.",
    "Structure your response into exactly 2 short paragraphs (no bullet points, no numbered lists):",
    "1. Paragraph 1: State what the student achieved well according to the IELTS criteria matching their band.",
    "2. Paragraph 2: Give tactical, actionable advice on how they can improve their vocabulary or grammar connectivity to cross into the next higher band.",
    "",
    `Target Band Level: ${input.score.overall}`,
    `Topic: ${input.topicTitle || "General Speaking"}`,
    `Prompt: ${input.topicPrompt || ""}`,
    `Transcript Data: "${transcript}"`,
  ].join("\n");
}

type LlmSetting = {
  provider_name: string;
  base_url: string;
  api_key: string;
  model_name: string;
};

async function getActiveLlmSetting(): Promise<LlmSetting | null> {
  const { data, error } = await supabaseAdmin
    .from("llm_settings")
    .select("provider_name, base_url, api_key, model_name")
    .eq("is_active", true)
    .maybeSingle();

  console.log("[evaluate] raw llm setting data:", data);
  console.log("[evaluate] raw llm setting error:", error);

  if (error) {
    console.error("[evaluate] failed to load llm setting", error);
    return null;
  }

  return data as LlmSetting | null;
}

async function callOpenAiCompatibleLlm({
  setting,
  model,
  temperature,
  messages,
}: {
  setting: LlmSetting;
  model: string;
  temperature: number;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}) {
  const response = await fetch(setting.base_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${setting.api_key}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "LLM provider request failed.");
  }

  return data?.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EvaluateRequestBody;
    const transcript = (body.transcript || "").trim();
    const rubricItems = (body.rubricItems || []).map((item) => item.trim()).filter(Boolean);

    const llmSetting = await getActiveLlmSetting();

    if (!llmSetting?.api_key || !llmSetting?.base_url || !llmSetting?.model_name) {
      const score = calculateScore(transcript);

      return NextResponse.json({
        ...score,
        analysis: "Analisis AI tidak tersedia karena belum ada LLM API aktif di Admin Dashboard.",
      });
    }

    const model = llmSetting.model_name;

    // =========================================================
    // 🛠️ LANGKAH 1: AI SANITY CHECK (Mikir apakah transkripnya nyambung/valid)
    // =========================================================
    const sanityResult = (
      await callOpenAiCompatibleLlm({
        setting: llmSetting,
        model,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "You are a strict data validation assistant. Analyze the user's English speaking transcript. Determine if the text consists of valid English attempts to communicate, or if it is completely invalid spam/nonsense/trolling (e.g., repeating the same sound like 'meow meow', 'woof woof', single characters like 'aaaaa', or completely random gibberish). Respond with EXACTLY one word: 'VALID' or 'INVALID'.",
          },
          {
            role: "user",
            content: `Transcript to analyze: "${transcript}"`,
          },
        ],
      })
    ).trim().toUpperCase();

    // 🛠️ LANGKAH 2: JIKA AI MENILAI JAWABAN ADALAH SAMPAH / 'INVALID'
    if (sanityResult === "INVALID") {
      return NextResponse.json({
        overall: "1.0",
        level: "Band 1.0 - Non User",
        metrics: [
          { id: "fluency", label: "Fluency & Coherence", score: "1.0", text: "Ucapan tidak bermakna atau hanya berupa pengulangan suara non-bahasa." },
          { id: "vocabulary", label: "Lexical Resource", score: "1.0", text: "Tidak ada kosakata bahasa Inggris nyata yang digunakan untuk menyampaikan makna." },
          { id: "grammar", label: "Grammar Range & Accuracy", score: "1.0", text: "Tidak ada struktur tata bahasa atau kalimat yang dapat dinilai." },
          { id: "pronunciation", label: "Pronunciation", score: "1.0", text: "Sampel suara tidak valid untuk analisis pelafalan bahasa." }
        ],
        recommendation: "Mohon berbicara menggunakan kata atau kalimat bahasa Inggris yang relevan dengan topik agar sistem dapat memberikan penilaian.",
        analysis: "Sistem mendeteksi bahwa input yang Anda berikan bukan merupakan upaya menjawab soal (seperti suara hewan, ketikan acak, atau manipulasi mikrofon). Silakan coba lagi dengan memberikan jawaban lisan yang jujur."
      });
    }

    // =========================================================
    // LANGKAH 3: JIKA VALID, JALANKAN KALKULATOR DAN PROMPT FEEDBACK SEPERTI BIASA
    // =========================================================
    const score = calculateScore(transcript);
    const prompt = buildAiPrompt({ ...body, transcript, rubricItems, score });

    const aiText = await callOpenAiCompatibleLlm({
      setting: llmSetting,
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You provide official, professional, and constructive IELTS speaking feedback in Indonesian.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return NextResponse.json({
      ...score,
      analysis: aiText || "Berhasil mengevaluasi performa menggunakan matriks heuristik lokal."
    });

  } catch (error) {
    console.error("[evaluate] error", error);
    return NextResponse.json(
      { overall: "-", level: "Unavailable", metrics: [], recommendation: "Error occurred.", analysis: "Gagal memproses transkrip." },
      { status: 500 }
    );
  }
}