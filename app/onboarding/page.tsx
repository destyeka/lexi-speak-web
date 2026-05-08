"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const GOALS = ["Speak more fluently", "Increase band score", "Interview practice", "Exam preparation"];
const SPEAKING_LEVELS = [
  "A1 (Beginner)",
  "A2 (Elementary)",
  "B1 (Intermediate)",
  "B2 (Upper-Intermediate)",
  "C1 (Advanced)",
  "C2 (Proficient)",
];
const TARGET_TIMES = ["1 week", "2 weeks", "1 month", "3 months"];

const WIZARD_STEPS = ["Start", "Learning goal", "Speaking level", "Target timeline", "Nickname", "Start speaking now"];
const PART_RESPONSE_TIME_LIMIT_SECONDS = 20;
const SESSION_TIME_LIMIT_SECONDS = 20 * 60;
const SPEAKING_CARD_COUNT = 3;

const IELTS_RUBRIC = {
  fluencyAndCoherence: {
    9: "Fluent with only very occasional repetition or self-correction. Any hesitation used only to prepare content. Speech situationally appropriate and fully coherent. Topic development fully coherent and appropriately extended.",
    8: "Fluent with only very occasional repetition or self-correction. Hesitation may occasionally be used to find words/grammar. Topic development coherent, appropriate and relevant.",
    7: "Able to keep going and readily produce long turns without noticeable effort. Some hesitation/repetition/self-correction. Occasional problems accessing appropriate language. Topic development coherent, appropriate and relevant.",
    6: "Able to keep going and demonstrates willingness to produce long turns. Coherence may be lost due to hesitation/repetition/self-correction. Uses range of spoken discourse markers. Topic development relevant but not always appropriate.",
    5: "Able to keep going but relies on repetition and self-correction. Hesitation associated with mid-sentence searches. Overuse of certain discourse markers. Complex speech usually causes disfluency.",
    4: "Usually able to keep going but relies on repetition and self-correction. Hesitations often associated with mid-sentence searches for fairly basic lexis and grammar. Overuse of certain discourse markers or cohesive features. Simple speech may be produced fluently; more complex speech usually causes disfluency. Some breakdowns in coherence.",
    3: "Limited ability to keep going. Frequent pauses and hesitations. Limited ability to link simple sentences and go beyond simple responses.",
    2: "Long pauses before nearly every word. Isolated words may be recognisable but speech is of virtually no communicative significance.",
    1: "Speech is totally incoherent.",
    0: "Did not attend.",
  },
  lexicalResource: {
    9: "Total flexibility and precise use in all contexts. Sustained use of accurate and idiomatic language.",
    8: "Wide resource, readily and flexibly used to discuss all topics and convey precise meaning. Skillful use of less common and idiomatic items despite occasional inaccuracies in word choice and collocation.",
    7: "Resource flexibly used to discuss variety of topics. Some ability to use less common and idiomatic items. An awareness of style and collocation is evident though inaccuracies occur.",
    6: "Resource sufficient to discuss topics at length. Vocabulary use may be inappropriate but meaning is clear. Generally able to paraphrase successfully. Effective use of paraphrase as required.",
    5: "Resource sufficient to discuss familiar and unfamiliar topics but limited flexibility. Vocabulary may be inappropriate or errors in word choice. Attempts paraphrase but not always with success.",
    4: "Resource sufficient for familiar topics but only basic meaning conveyed on unfamiliar topics. Vocabulary inadequate for unfamiliar topics. Frequent inappropriateness and errors in word choice. Rarely attempts paraphrase.",
    3: "Resource limited to simple vocabulary used primarily to convey personal information. Vocabulary inadequate for unfamiliar topics.",
    2: "Very limited resource. Utterances consist of isolated words or memorised utterances. Little communication possible without support of mime or gesture.",
    1: "No resource; a few isolated words.",
    0: "Did not attend.",
  },
  grammaticalRangeAndAccuracy: {
    9: "Structures are precise and accurate at all times, apart from 'mistakes' characteristic of native speaker speech. These do not impede communication.",
    8: "Wide range of structures, flexibly used. The majority of sentences are error free. Occasional inappropriateness and non-systematic errors occur. A few basic errors may persist.",
    7: "A range of structures is used flexibly and accurately. Error-free sentences are frequent. Both simple and complex sentences are used effectively, despite some errors. A few basic errors persist.",
    6: "A range of structures is used with some flexibility and accuracy. Error-free sentences are frequent. Both simple and complex sentences are used effectively despite errors and some over-use of certain patterns. A few basic errors may persist, and some non-systematic errors occur.",
    5: "Basic sentence forms are fairly well controlled for accuracy. Complex structures are attempted but these are limited in range, nearly always contain errors and may lead to the need for reformulation.",
    4: "Can produce basic sentence forms and some short complex structures, but these are rarely well-controlled and usually contain errors. Subordinate clauses are rare and attempts at them are often unsuccessful.",
    3: "Can produce basic sentence forms and some short complex structures, but these are rarely well-controlled and usually contain errors. Subordinate clauses are rare and attempts at them are often unsuccessful. Basic sentence forms are attempted but these are rarely well-controlled. Errors in both complex structures and some basic structures.",
    2: "No evidence of basic sentence forms. Grammatical errors are numerous except in apparently memorised utterances.",
    1: "No rateable language unless memorised.",
    0: "Did not attend.",
  },
  pronunciation: {
    9: "Uses a full range of phonological features to convey precise and/or subtle meaning. Flexible use of features of connected speech is sustained throughout. Can be effortlessly understood. Accent has no effect on intelligibility.",
    8: "Uses a wide range of phonological features to convey precise and/or subtle meaning. Can sustain appropriate rhythm, stress and intonation throughout longer stretches of speech. Flexible use of features of connected speech is sustained throughout, despite occasional lapses. Can be easily understood throughout. Accent has minimal effect on intelligibility.",
    7: "Displays all the positive features of band 6 and some features of band 8. Control of phonological features is consistent and secure. Appropriate stress, intonation and connected speech patterns are used with some flexibility. Can be easily understood throughout, though with occasional difficulty caused by intonation or stress. Accent has minimal effect on intelligibility.",
    6: "Uses a range of phonological features, but control is variable. Chunking is generally appropriate but rhythm may be affected. Some effective use of intonation and stress to convey meaning. Can be generally understood throughout, but with some difficulty caused by intonation or stress. Individual words or phonemes may be mispronounced but this causes only occasional lack of clarity. Can generally be understood throughout without much effort.",
    5: "Uses a range of phonological features, but control is variable. Chunking is generally appropriate but rhythm may be affected by a lack of stress-timing and/or a rapid speech rate. Some effective use of intonation and stress, but this is not sustained. Individual words or phonemes may be mispronounced causing occasional lack of clarity. Understanding requires some effort and there may be patches of speech that cannot be understood.",
    4: "Uses some acceptable phonological features, but the range is limited and control is generally poor. Chunking may be imprecise, affecting rhythm and/or affecting general intelligibility. Attempts to use stress and intonation but the effect is limited. Individual words and phonemes are frequently mispronounced, causing lack of clarity and effort required for understanding and there may be patches of speech that cannot be understood.",
    3: "Uses some acceptable phonological features but range is limited. Chunking may be generally appropriate but is not always clear. Rhythm and intonation patterns are attempted but these are rarely sustained or secure. Stress patterns may affect intelligibility. Individual words or phonemes are frequently mispronounced. Understanding requires considerable effort and there may be substantial patches of speech that cannot be understood.",
    2: "Uses few acceptable phonological features. There may be frequent pauses and erratic chunking, rhythm and intonation patterns. Stress patterns are rarely accurate. Individual words or phonemes are mainly mispronounced. Overall problems with delivery impair attempts at connected speech. Understanding requires considerable effort and there may be substantial patches of speech that cannot be understood.",
    1: "Uses few or no recognisable phonological features. Delivery is so impaired that communication is not possible.",
    0: "Did not attend.",
  },
};

const IELTS_RUBRIC_TEXT = Object.entries(IELTS_RUBRIC)
  .map(
    ([criterion, scores]) =>
      `## ${criterion.replace(/([A-Z])/g, " $1").trim()}\n` +
      Object.entries(scores)
        .map(([band, description]) => `**Band ${band}**: ${description}`)
        .join("\n"),
  )
  .join("\n\n");

// Part 1 Topics with questions
const PART_1_TOPICS = [
  {
    topic: "Your home town or village",
    questions: [
      "What kind of place is it?",
      "What's the most interesting part of your town/village?",
      "What kind of jobs do the people in your town/village do?",
      "Would you say it's a good place to live? (Why?)",
    ],
  },
  {
    topic: "Your accommodation",
    questions: [
      "Tell me about the kind of accommodation you live in.",
      "How long have you lived there?",
      "What do you like about living there?",
      "What sort of accommodation would you most like to live in?",
    ],
  },
  {
    topic: "Your work or studies",
    questions: [
      "What do you do? (job or studies)",
      "How long have you been doing it?",
      "What do you like/dislike about it?",
      "Would you like to do something different in the future?",
    ],
  },
  {
    topic: "Your hobbies and interests",
    questions: [
      "What hobbies or interests do you have?",
      "How often do you do this activity?",
      "Why do you enjoy it?",
      "How did you get interested in this hobby?",
    ],
  },
];

const UNIT_PART_1_TOPIC_INDEX = [0, 1] as const;

const STEP_COPY = [
  {
    title: "Start",
    ai: "Hi! I will help you set up your speaking practice step by step.",
    subtitle: "Reply like a chat. If none of the options fits, choose Other and type your own answer.",
  },
  {
    title: "Learning goal",
    ai: "What is your learning goal?",
    subtitle: "Choose the goal that best matches your current need.",
    options: GOALS,
    otherLabel: "Other / type your own",
  },
  {
    title: "Speaking level",
    ai: "What is your current speaking level?",
    subtitle: "This helps keep prompts at the right difficulty.",
    options: SPEAKING_LEVELS,
    otherLabel: "Other / different level",
  },
  {
    title: "Target timeline",
    ai: "When do you want to see progress?",
    subtitle: "This helps set your practice pace and session intensity.",
    options: TARGET_TIMES,
    otherLabel: "Other / custom timeline",
  },
  {
    title: "Nickname",
    ai: "What should I call you?",
    subtitle: "Optional, but it makes the onboarding feel more personal.",
  },
  {
    title: "Start speaking now",
    ai: "Everything is ready. I have summarized your setup.",
    subtitle: "Click the button below to start your first speaking session.",
  },
];

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

type SpeechTarget = "other" | "nickname";

type SpeakingCard = {
  id: string | number;
  title: string;
  promptText: string;
};

type CriterionAnalysis = {
  label: string;
  score: number;
  feedback: string;
  nextStep: string;
};

type PersonalizedInsight = {
  strengths: string[];
  focusAreas: string[];
  goalAlignedTips: string[];
  levelComparison: string;
  timelineAdvice: string;
};

type SpeakingAnalysis = {
  overallScore: number;
  summary: string;
  criteria: CriterionAnalysis[];
  personalizedInsight?: PersonalizedInsight;
};

type BandRange = {
  min: number;
  max: number;
};

type VoicePreference = "female" | "male";

// IELTS speaking band is discrete integer 0-9.
const clampScore = (value: number) => Math.max(0, Math.min(9, Math.round(Number(value))));
const LM_STUDIO_BASE_URL = process.env.NEXT_PUBLIC_LM_STUDIO_BASE_URL ?? "http://127.0.0.1:1234";
const ONBOARDING_COMPLETED_KEY = "ielts_onboarding_completed";

const calibrateAnalysisByLength = (answer: string, analysis: SpeakingAnalysis): SpeakingAnalysis => {
  // Since model now uses official IELTS rubric, calibration is minimal
  // Only adjust for extremely short responses that violate rubric assumptions
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  // Per IELTS rubric:
  // Band 3-4: "Limited ability to link sentences" or "Usually able to keep going" typically need 10+ words
  // Band 5+: Longer, more coherent turns typically 15+ words
  
  let penalty = 0;
  let maxBand = 9;
  let shouldUpdateSummary = false;

  if (wordCount < 5) {
    // Extremely short response should not score beyond low bands.
    penalty = 1;
    maxBand = 3;
    shouldUpdateSummary = true;
  } else if (wordCount < 10) {
    // Short response can still be rated, but capped to mid band.
    penalty = 0;
    maxBand = 5;
    shouldUpdateSummary = true;
  }
  // 10+ words: trust the model's rubric-based scoring.

  const adjustedCriteria = analysis.criteria.map((item) => {
    return {
      ...item,
      score: clampScore(Math.min(item.score - penalty, maxBand)),
    };
  });

  const adjustedOverall = clampScore(
    adjustedCriteria.reduce((acc, item) => acc + item.score, 0) / adjustedCriteria.length,
  );

  const adjustedSummary = shouldUpdateSummary
    ? analysis.summary.includes("too short")
      ? analysis.summary
      : `${analysis.summary} Note: Response length may limit band potential.`
    : analysis.summary;

  return {
    overallScore: adjustedOverall,
    summary: adjustedSummary,
    criteria: adjustedCriteria,
    personalizedInsight: analysis.personalizedInsight,
  };
};

const calibrateAnalysisByRelevance = (
  answer: string,
  promptText: string,
  analysis: SpeakingAnalysis,
): SpeakingAnalysis => {
  const toTokens = (text: string) =>
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2);

  const promptTokens = new Set(toTokens(promptText));
  const answerTokens = toTokens(answer);
  if (answerTokens.length === 0 || promptTokens.size === 0) return analysis;

  const overlapCount = answerTokens.filter((token) => promptTokens.has(token)).length;
  const overlapRatio = overlapCount / answerTokens.length;

  // Penalize answers that are likely off-topic compared to the prompt context.
  if (overlapRatio >= 0.12) return analysis;

  const adjustedCriteria = analysis.criteria.map((item) => ({
    ...item,
    score: clampScore(Math.min(item.score - 2, 5)),
  }));

  const adjustedOverall = clampScore(
    adjustedCriteria.reduce((acc, item) => acc + item.score, 0) / adjustedCriteria.length,
  );

  return {
    ...analysis,
    overallScore: adjustedOverall,
    summary:
      "Your response appears partially off-topic for the question. Stay focused on the exact prompt to improve band accuracy.",
    criteria: adjustedCriteria,
  };
};

const buildFallbackAnalysis = (answer: string): SpeakingAnalysis => {
  // Fallback scoring aligned with IELTS Band Descriptors
  const normalized = answer.trim();
  if (!normalized) {
    return {
      overallScore: 0,
      summary: "No answer available for analysis yet.",
      criteria: [
        {
          label: "Fluency and Coherence",
          score: 0,
          feedback: "No speaking output yet (Band 0).",
          nextStep: "Record an answer with at least 3-4 sentences.",
        },
        {
          label: "Lexical Resource",
          score: 0,
          feedback: "Vocabulary cannot be evaluated yet (Band 0).",
          nextStep: "Use verbs, adjectives, and connectors in your answer.",
        },
        {
          label: "Grammatical Range and Accuracy",
          score: 0,
          feedback: "Sentence structure cannot be evaluated yet (Band 0).",
          nextStep: "Use a mix of present, past, and simple complex sentences.",
        },
        {
          label: "Pronunciation",
          score: 0,
          feedback: "No speaking signal to evaluate yet (Band 0).",
          nextStep: "Repeat your answer with clearer pronunciation and steady pacing.",
        },
      ],
    };
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const uniqueWords = new Set(words.map((word) => word.toLowerCase().replace(/[^a-z']/g, ""))).size;
  const uniqueRatio = wordCount > 0 ? uniqueWords / wordCount : 0;
  const sentenceCount = normalized
    .split(/[.!?]+/)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
  const connectors = ["because", "however", "therefore", "while", "although", "so", "but", "then"];
  const connectorHits = words.filter((word) => connectors.includes(word.toLowerCase().replace(/[^a-z']/g, ""))).length;
  const fillerWords = ["umm", "uh", "like", "you know", "eee", "anu"];
  const loweredText = normalized.toLowerCase();
  const fillerHits = fillerWords.reduce((acc, token) => acc + (loweredText.match(new RegExp(token, "g")) || []).length, 0);
  const punctuationHits = (normalized.match(/[,.!?]/g) || []).length;

  // IELTS Band Descriptors mapping (0-9):
  // Band 1: Speech is totally incoherent
  // Band 2: Long pauses before nearly every word; isolated words
  // Band 3: Limited ability to keep going; limited linking
  // Band 4: Usually able to keep going; relies on repetition; hesitation for basic lexis
  // Band 5: Able to keep going but relies on repetition; mid-sentence searches; overuse of markers
  // Band 6: Willingness to produce long turns; occasional coherence loss; range of discourse markers
  // Band 7: Readily produce long turns without noticeable effort; some hesitation; occasional language gaps
  // Band 8: Fluent with only very occasional repetition/self-correction
  // Band 9: Fluent; no noticeable hesitation; accurate and idiomatic use

  // Fluency and Coherence (per rubric)
  const fluencyScore = clampScore(
    wordCount < 3 ? 1 :           // Band 1: incoherent
    wordCount < 5 ? 2 :           // Band 2: isolated words, long pauses
    sentenceCount < 1 ? 2.5 :     // Barely complete thoughts
    wordCount < 15 ? 3 :          // Band 3: limited ability to keep going
    sentenceCount < 2 ? 4 :       // Band 4: can produce some output but minimal linking
    connectorHits === 0 && fillerHits > 2 ? 4.5 : // Band 4-5 boundary: disfluent
    connectorHits < 2 && fillerHits > 1 ? 5 :    // Band 5: relies on repetition
    sentenceCount >= 2 && connectorHits >= 1 && fillerHits <= 2 ? 6 :  // Band 6: basic coherence
    wordCount >= 40 && connectorHits >= 2 && fillerHits <= 1 ? 7 :     // Band 7: coherent longer turns
    wordCount >= 60 && fillerHits === 0 ? 8 :    // Band 8: fluent
    9                                             // Band 9: excellent (rare)
  );

  // Lexical Resource (per rubric)
  const lexicalScore = clampScore(
    wordCount < 3 ? 1 :           // Band 1: no resource
    wordCount < 5 ? 2 :           // Band 2: isolated words, memorized
    uniqueRatio < 0.4 ? 3 :       // Band 3: very limited, mainly personal info
    uniqueRatio < 0.5 ? 4 :       // Band 4: sufficient for familiar topics, errors in unfamiliar
    uniqueRatio < 0.6 ? 5 :       // Band 5: limited flexibility, inappropriate word choice
    uniqueRatio < 0.7 ? 6 :       // Band 6: sufficient resource, can paraphrase, some errors
    uniqueRatio < 0.8 ? 7 :       // Band 7: good flexibility, less common items used
    wordCount >= 50 && uniqueRatio >= 0.75 ? 8 : // Band 8: wide resource, flexible
    9                                             // Band 9: total flexibility, precise use
  );

  // Grammatical Range and Accuracy (per rubric)
  const grammarScore = clampScore(
    wordCount < 3 ? 1 :           // Band 1: no rateable language
    wordCount < 5 ? 2 :           // Band 2: no evidence of basic forms
    sentenceCount < 1 ? 2 :       // Can't form even 1 complete sentence
    wordCount < 15 ? 3 :          // Band 3: limited range, errors in both complex and basic
    sentenceCount < 2 ? 4 :       // Band 4: basic forms OK, complex rarely used
    punctuationHits === 0 ? 4.5 : // Band 4-5: minimal punctuation/accuracy
    sentenceCount >= 2 && punctuationHits >= 1 ? 5 : // Band 5: basic controlled, complex errors
    sentenceCount >= 3 && wordCount >= 35 ? 6 :      // Band 6: range with flexibility, some errors
    wordCount >= 50 && sentenceCount >= 4 ? 7 :      // Band 7: good range, error-free frequent
    wordCount >= 70 && punctuationHits >= 5 ? 8 :    // Band 8: wide range, mostly error-free
    9                                                 // Band 9: precise, accurate structures
  );

  // Pronunciation (from transcript signals - text-based heuristics)
  const pronunciationScore = clampScore(
    wordCount < 3 ? 1 :           // Band 1: unintelligible
    wordCount < 5 ? 2 :           // Band 2: main mispronunciations, unintelligible patches
    fillerHits > 5 ? 3 :          // Band 3: range limited, stress patterns inaccurate
    fillerHits > 3 ? 4 :          // Band 4: range limited, frequent mispronunciation
    fillerHits > 2 ? 5 :          // Band 5: range variable, occasional lack of clarity
    fillerHits > 1 && wordCount >= 20 ? 6 : // Band 6: range used, variable control
    fillerHits <= 1 && wordCount >= 40 ? 7 : // Band 7: consistent control, sustained features
    fillerHits === 0 && wordCount >= 60 ? 8 : // Band 8: wide range, flexible, effortless
    9                                         // Band 9: full range, effortless, precise
  );

  const criteria: CriterionAnalysis[] = [
    {
      label: "Fluency and Coherence",
      score: fluencyScore,
      feedback:
        fluencyScore <= 1 ? "Speech is totally incoherent. Focus on forming at least 2-3 complete sentences." :
        fluencyScore <= 2 ? "Long pauses before words; isolated responses. Aim to link simple ideas." :
        fluencyScore <= 3 ? "Limited ability to keep going; frequent pauses and hesitations. Work on extending responses." :
        fluencyScore <= 4 ? "Usually able to keep going but with repetition and self-correction. Add connectors to link sentences." :
        fluencyScore <= 5 ? "Can keep going but relies on repetition; mid-sentence searches. Use more discourse markers." :
        fluencyScore <= 6 ? "Demonstrates willingness for longer turns; occasional coherence loss due to hesitation. Refine transitions." :
        fluencyScore <= 7 ? "Readily produces longer turns with only occasional hesitation. Add more varied connectors." :
        fluencyScore <= 8 ? "Fluent with only occasional repetition or self-correction. Near-native flow achieved." :
        "Exceptional fluency; hesitation only for content preparation, not language searching.",
      nextStep: "Practice speaking in longer chunks without pausing between words.",
    },
    {
      label: "Lexical Resource",
      score: lexicalScore,
      feedback:
        lexicalScore <= 1 ? "No measurable vocabulary resource. Use more varied words beyond basic vocabulary." :
        lexicalScore <= 2 ? "Very limited resource; isolated memorized words. Build basic vocabulary foundation." :
        lexicalScore <= 3 ? "Limited to simple vocabulary for personal information. Expand to new topics." :
        lexicalScore <= 4 ? "Sufficient for familiar topics; inadequate for unfamiliar; frequent errors in word choice." :
        lexicalScore <= 5 ? "Limited flexibility; attempts paraphrase but not always successfully. Study synonyms." :
        lexicalScore <= 6 ? "Sufficient to discuss topics at length; some inappropriate vocabulary but meaning clear. Practice paraphrasing." :
        lexicalScore <= 7 ? "Uses less common and idiomatic items with flexibility; occasional inaccuracies." :
        lexicalScore <= 8 ? "Wide resource readily used to discuss all topics; skillful use of less common items." :
        "Total flexibility and precise use in all contexts; sustained accurate and idiomatic language.",
      nextStep: "Learn and practice 10-15 new topic-specific words and their collocations.",
    },
    {
      label: "Grammatical Range and Accuracy",
      score: grammarScore,
      feedback:
        grammarScore <= 1 ? "No evidence of basic sentence forms. Focus on simple subject-verb-object sentences." :
        grammarScore <= 2 ? "Numerous grammatical errors; no evidence of basic forms. Practice fundamental structures." :
        grammarScore <= 3 ? "Limited range; errors in both basic and complex structures; subordinate clauses rare. Study basic tenses." :
        grammarScore <= 4 ? "Basic sentence forms controlled; complex structures attempted but rarely successful. Mix simple and complex." :
        grammarScore <= 5 ? "Basic forms fairly well controlled; complex structures attempted but limited and error-prone. Practice complex sentences." :
        grammarScore <= 6 ? "Range of structures used with flexibility; error-free sentences frequent; occasional errors persist." :
        grammarScore <= 7 ? "Good range used accurately and flexibly; error-free sentences frequent; few errors despite complexity." :
        grammarScore <= 8 ? "Wide range flexibly used; mostly error-free; occasional non-systematic errors. Near-native accuracy." :
        "Structures precise and accurate at all times; mistakes only characteristic of native speaker speech.",
      nextStep: "Practice combining simple sentences with complex structures using because, although, and if-clauses.",
    },
    {
      label: "Pronunciation",
      score: pronunciationScore,
      feedback:
        pronunciationScore <= 1 ? "Unintelligible delivery; communication not possible. Record and listen to your speech." :
        pronunciationScore <= 2 ? "Frequent pauses and mispronunciations; overall delivery severely impaired. Slow down and pronounce clearly." :
        pronunciationScore <= 3 ? "Limited phonological range; stress patterns inaccurate; understanding requires considerable effort." :
        pronunciationScore <= 4 ? "Limited range; frequent mispronunciation; chunking imprecise; stress/intonation attempts ineffective." :
        pronunciationScore <= 5 ? "Range variable; some mispronunciation; occasional lack of clarity; understanding requires effort." :
        pronunciationScore <= 6 ? "Range used but variable control; some difficulty from intonation/stress; occasional mispronunciation." :
        pronunciationScore <= 7 ? "Consistent control of phonological features; appropriate stress and intonation with some flexibility." :
        pronunciationScore <= 8 ? "Wide range of phonological features; sustained appropriate rhythm and intonation; easily understood." :
        "Full range of phonological features; effortless understanding; flexible connected speech; accent has no effect.",
      nextStep: "Reduce filler words and practice clear articulation with consistent pacing.",
    },
  ];

  const overallScore = clampScore(
    (fluencyScore + lexicalScore + grammarScore + pronunciationScore) / 4,
  );

  const summary =
    overallScore <= 2 ? "Performance at Band 1-2: Speech is incoherent or very limited. Focus on forming complete, simple sentences and extending responses to 20+ words." :
    overallScore <= 3 ? "Performance at Band 3: Limited ability to keep going; frequent pauses. Work on linking ideas and maintaining fluency for longer stretches." :
    overallScore <= 4 ? "Performance at Band 4: Usually able to continue but relies on repetition. Improve grammar accuracy and add discourse markers to transitions." :
    overallScore <= 5 ? "Performance at Band 5: Can keep going but hesitates and self-corrects frequently. Practice smoother delivery and expand vocabulary range." :
    overallScore <= 6 ? "Performance at Band 6: Demonstrates willingness to produce longer turns; some coherence issues remain. Refine accuracy and reduce filler words." :
    overallScore <= 7 ? "Performance at Band 7: Readily produces longer turns with occasional hesitation. Continue refining grammar precision and vocabulary sophistication." :
    overallScore <= 8 ? "Performance at Band 8: Fluent speech with only occasional repetition or self-correction. Focus on near-native accuracy and advanced vocabulary." :
    "Performance at Band 9: Excellent fluency and accuracy. Continue polishing for exam-level performance.";

  return {
    overallScore,
    summary,
    criteria,
  };
};

const extractJsonBlock = (rawText: string) => {
  const fencedMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fencedMatch && fencedMatch[1]) return fencedMatch[1].trim();

  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return rawText.slice(firstBrace, lastBrace + 1);
  }

  return rawText.trim();
};

const normalizeModelAnalysis = (payload: any): SpeakingAnalysis | null => {
  if (!payload || typeof payload !== "object") return null;
  const criteriaInput = Array.isArray(payload.criteria) ? payload.criteria : [];
  if (criteriaInput.length === 0) return null;

  const criteria: CriterionAnalysis[] = criteriaInput
    .map((item: any) => {
      if (!item || typeof item !== "object") return null;
      const label = String(item.label ?? "").trim();
      const feedback = String(item.feedback ?? "").trim();
      const nextStep = String(item.nextStep ?? "").trim();
      const score = clampScore(Number(item.score ?? 0));
      if (!label || !feedback || !nextStep) return null;
      return { label, score, feedback, nextStep };
    })
    .filter(Boolean) as CriterionAnalysis[];

  if (criteria.length === 0) return null;

  const overallScore =
    typeof payload.overallScore === "number"
      ? clampScore(payload.overallScore)
      : clampScore(criteria.reduce((acc, item) => acc + item.score, 0) / criteria.length);

  let personalizedInsight: PersonalizedInsight | undefined = undefined;
  if (payload.personalizedInsight && typeof payload.personalizedInsight === "object") {
    const pi = payload.personalizedInsight;
    personalizedInsight = {
      strengths: Array.isArray(pi.strengths) ? pi.strengths.map((s: any) => String(s).trim()).filter(Boolean) : [],
      focusAreas: Array.isArray(pi.focusAreas) ? pi.focusAreas.map((f: any) => String(f).trim()).filter(Boolean) : [],
      goalAlignedTips: Array.isArray(pi.goalAlignedTips) ? pi.goalAlignedTips.map((t: any) => String(t).trim()).filter(Boolean) : [],
      levelComparison: String(pi.levelComparison ?? "").trim(),
      timelineAdvice: String(pi.timelineAdvice ?? "").trim(),
    };
    if (!personalizedInsight.strengths.length && !personalizedInsight.focusAreas.length && !personalizedInsight.goalAlignedTips.length && !personalizedInsight.levelComparison && !personalizedInsight.timelineAdvice) {
      personalizedInsight = undefined;
    }
  }

  return {
    overallScore,
    summary: String(payload.summary ?? "Estimated speaking analysis generated.").trim(),
    criteria,
    personalizedInsight,
  };
};

const requestModelAnalysis = async (
  answer: string,
  promptText: string,
  goal?: string,
  speakingLevel?: string,
  targetTime?: string,
) => {
  const systemPrompt = [
    "You are an IELTS Speaking examiner. You MUST use the official IELTS Band Descriptors below to score responses.",
    "",
    "OFFICIAL IELTS SPEAKING BAND DESCRIPTORS:",
    IELTS_RUBRIC_TEXT,
    "",
    "CRITICAL REQUIREMENTS:",
    "1. Score ONLY using the rubric above. Each score must be justified by the rubric criteria.",
    "2. For each criterion, identify which integer band (0-9) best matches the response.",
    "3. Ensure scores align with rubric descriptors - do not deviate.",
    "4. Return strict JSON only, with this exact schema:",
    "{",
    '  "overallScore": integer (0-9),',
    '  "summary": string (1-2 sentences explaining overall performance against rubric),',
    '  "criteria": [',
    '    {"label":"Fluency and Coherence","score":integer 0-9,"feedback":string (cite rubric),"nextStep":string},',
    '    {"label":"Lexical Resource","score":integer 0-9,"feedback":string (cite rubric),"nextStep":string},',
    '    {"label":"Grammatical Range and Accuracy","score":integer 0-9,"feedback":string (cite rubric),"nextStep":string},',
    '    {"label":"Pronunciation","score":integer 0-9,"feedback":string (cite rubric),"nextStep":string}',
    "  ],",
    '  "personalizedInsight": {',
    '    "strengths": [array of 2-3 items],',
    '    "focusAreas": [array of 2-3 items],',
    '    "goalAlignedTips": [array of 2-3 tips specific to their goal],',
    '    "levelComparison": "how their performance compares to their stated level",',
    '    "timelineAdvice": "practice pace advice for their target timeline"',
    "  }",
    "}",
    "Use English only. Be strict and accurate.",
  ].join("\n");

  const userPromptParts = [
    `Prompt question: ${promptText}`,
    `Transcript answer: ${answer}`,
  ];

  if (goal || speakingLevel || targetTime) {
    userPromptParts.push("");
    userPromptParts.push("User Profile:");
    if (goal) userPromptParts.push(`- Learning goal: ${goal}`);
    if (speakingLevel) userPromptParts.push(`- Current level: ${speakingLevel}`);
    if (targetTime) userPromptParts.push(`- Target timeline: ${targetTime}`);
    userPromptParts.push("\nProvide personalized insights that take their goal, level, and timeline into account.");
  }

  userPromptParts.push("\nEvaluate this response and provide actionable feedback and personalized insights.");

  const userPrompt = userPromptParts.join("\n");

  const response = await fetch(`${LM_STUDIO_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "ielts-scorer",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Model API returned ${response.status}`);
  }

  const completion = await response.json();
  const content = completion?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Model response is empty");
  }

  const parsed = JSON.parse(extractJsonBlock(content));
  const normalized = normalizeModelAnalysis(parsed);
  if (!normalized) {
    throw new Error("Model analysis schema is invalid");
  }

  return normalized;
};

const formatAnalysisForChat = (analysis: SpeakingAnalysis) => {
  const lines = [
    "IELTS analysis (estimated)",
    `Overall band: ${analysis.overallScore}/9`,
    "",
    `Summary: ${analysis.summary}`,
    "",
    "Criteria:",
    "",
    ...analysis.criteria.flatMap((item) => [
      `- ${item.label}: ${item.score}/9`,
      `  Feedback: ${item.feedback}`,
      `  Next step: ${item.nextStep}`,
      "",
    ]),
  ];

  return lines.join("\n").trim();
};

const getBandRangeForLevel = (level: string): BandRange => {
  if (level.startsWith("A1")) return { min: 2, max: 3 };
  if (level.startsWith("A2")) return { min: 3, max: 4 };
  if (level.startsWith("B1")) return { min: 4, max: 5 };
  if (level.startsWith("B2")) return { min: 5, max: 6 };
  if (level.startsWith("C1")) return { min: 6, max: 7 };
  if (level.startsWith("C2")) return { min: 7, max: 8 };
  return { min: 0, max: 9 };
};

const getLevelFitLabel = (score: number, level: string) => {
  const range = getBandRangeForLevel(level);
  if (score < range.min) return "Below selected level";
  if (score > range.max) return "Above selected level";
  return "Within selected level range";
};

const toNaturalCoachPrompt = (text: string) => {
  const cleaned = text.replace(/\r/g, "").trim();
  if (!cleaned) return "";

  const part1TopicMatch = cleaned.match(/Part\s*1\s*-\s*Topic:\s*"([^"]+)"/i);
  if (part1TopicMatch?.[1]) {
    return `Let us begin. Tell me about ${part1TopicMatch[1]}. Speak naturally in a short, clear response.`;
  }

  if (/cue card practice/i.test(cleaned)) {
    return "Here is your cue card. Take one minute to prepare, then speak for up to two minutes. Add one clear example and end with your opinion.";
  }

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !/^unit\s*\d+/i.test(line) &&
        !/^question:/i.test(line) &&
        !/^answer naturally/i.test(line) &&
        !/^task:/i.test(line) &&
        !/^ai practice cue:/i.test(line),
    );

  const compact = lines.join(" ").replace(/\s+/g, " ").trim();
  return compact || cleaned;
};

const pickPreferredVoice = (voices: SpeechSynthesisVoice[], preference: VoicePreference) => {
  const femaleHints = ["female", "zira", "samantha", "aria", "hazel", "google uk english female", "microsoft zira", "microsoft aria"];
  const maleHints = ["male", "david", "daniel", "mark", "google uk english male", "microsoft david"];
  const hints = preference === "female" ? femaleHints : maleHints;

  const byHint = voices.find((voice) => hints.some((hint) => voice.name.toLowerCase().includes(hint) || voice.voiceURI.toLowerCase().includes(hint)));
  if (byHint) return byHint;

  const byLang = voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));
  return byLang ?? voices[0] ?? null;
};

const isSupportiveTranscript = (text: string) => {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;

  const words = normalized.split(" ").filter(Boolean);
  return words.length >= 3 && !/^(h+m+|u+m+|e+m+|erm+|um+|uh+)$/.test(normalized);
};

const getAdaptiveEncouragement = (transcript: string, promptText: string) => {
  const normalized = transcript
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "Take your time. Start with one simple sentence, and I will stay with you.";
  }

  if (!isSupportiveTranscript(normalized)) {
    const promptHint = toNaturalCoachPrompt(promptText).replace(/^Let us begin\.\s*/i, "");
    return `You are okay. Try this: ${promptHint}`;
  }

  return null;
};

export default function Home() {
  const router = useRouter();
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const searchParams = useSearchParams();
  const practiceMode = searchParams.get("mode") === "test" ? "test" : searchParams.get("mode") === "learn" ? "learn" : null;
  const requestedUnit = Math.min(2, Math.max(1, Number(searchParams.get("unit") ?? "1") || 1));
  const requestedPart = Math.min(3, Math.max(1, Number(searchParams.get("part") ?? "1") || 1));
  const autoStart = searchParams.get("autostart") === "1";
  const assignmentId = searchParams.get("assignmentId");
  const replayOnboarding = searchParams.get("reset") === "1" || searchParams.get("replay") === "1";
  const [activeStep, setActiveStep] = useState(0);
  const [goal, setGoal] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("ielts_goal") || GOALS[0];
    }
    return GOALS[0];
  });
  const [speakingLevel, setSpeakingLevel] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("ielts_level") || SPEAKING_LEVELS[1];
    }
    return SPEAKING_LEVELS[1];
  });
  const [targetTime, setTargetTime] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("ielts_target") || TARGET_TIMES[1];
    }
    return TARGET_TIMES[1];
  });
  const [nickname, setNickname] = useState("");
  const [chatLog, setChatLog] = useState<ChatMessage[]>([
    { role: "assistant", text: STEP_COPY[0].ai },
  ]);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherValue, setOtherValue] = useState("");
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [testModeSkipMic, setTestModeSkipMic] = useState(false);

  const handleGoalChange = (newGoal: string) => {
    setGoal(newGoal);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("ielts_goal", newGoal);
    }
  };

  const handleLevelChange = (newLevel: string) => {
    setSpeakingLevel(newLevel);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("ielts_level", newLevel);
    }
  };

  const handleTargetTimeChange = (newTime: string) => {
    setTargetTime(newTime);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("ielts_target", newTime);
    }
  };

  const recognitionRef = useRef<any>(null);
  const answerRecognitionRef = useRef<any>(null);
  const [isTtsSupported, setIsTtsSupported] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [ttsVoicePreference, setTtsVoicePreference] = useState<VoicePreference>("female");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsRate, setTtsRate] = useState(1);
  const [isSpeakingSessionActive, setIsSpeakingSessionActive] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isAnswerRecording, setIsAnswerRecording] = useState(false);
  const [answerTranscript, setAnswerTranscript] = useState("");
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<SpeakingAnalysis | null>(null);
  const [lastAnalyzedTranscript, setLastAnalyzedTranscript] = useState("");
  const [responseTimeLeft, setResponseTimeLeft] = useState(PART_RESPONSE_TIME_LIMIT_SECONDS);
  const [sessionTimeLeft, setSessionTimeLeft] = useState(SESSION_TIME_LIMIT_SECONDS);
  const [selectedPart1TopicIndex, setSelectedPart1TopicIndex] = useState<number | null>(null);
  const [showTopicSelector, setShowTopicSelector] = useState(false);
  const [part1IntroShown, setPart1IntroShown] = useState(false);
  const [cueCardView, setCueCardView] = useState<"intro" | "transition" | "card">("intro");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isResponseTimerRunning, setIsResponseTimerRunning] = useState(false);
  const [flippedCriteria, setFlippedCriteria] = useState<Record<string, boolean>>({});
  const [assignmentQuestions, setAssignmentQuestions] = useState<{ id: string; content: string; order_index: number }[]>([]);
  const [isLoadingAssignment, setIsLoadingAssignment] = useState(false);
  const cueCardTimerRef = useRef<number | null>(null);
  const autoStartRef = useRef(false);
  const keepTryingSentRef = useRef(false);
  const voiceJustEnabledRef = useRef(false);
  const lastOnboardingStepSpokenRef = useRef<number | null>(null);
  const preferredTtsVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const manualStopRecordingRef = useRef(false);
  const answerTranscriptRef = useRef("");
  const adaptiveNudgeSentRef = useRef(false);

  const currentStep = activeStep + 1;
  const progressPercent = (currentStep / WIZARD_STEPS.length) * 100;
  const timerProgressPercent = (responseTimeLeft / PART_RESPONSE_TIME_LIMIT_SECONDS) * 100;

  const ensureMicrophoneAccess = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access is not available in this browser.");
    }

    if (testModeSkipMic) {
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  };

  const summaryText = useMemo(
    () =>
      [
        practiceMode ? `Practice mode: ${practiceMode === "test" ? "Test" : "Learn"}` : null,
        `Unit: ${requestedUnit}`,
        practiceMode === "learn" ? `Selected part: ${requestedPart}` : null,
        requestedPart === 1 ? `Topic: ${PART_1_TOPICS[UNIT_PART_1_TOPIC_INDEX[requestedUnit - 1] ?? 0].topic}` : null,
        `Learning goal: ${goal}`,
        `Speaking level: ${speakingLevel}`,
        `Target timeline: ${targetTime}`,
        nickname.trim() ? `Nickname: ${nickname.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    [goal, speakingLevel, targetTime, nickname, practiceMode, requestedUnit, requestedPart],
  );

  const appendMessages = (...messages: ChatMessage[]) => {
    const validMessages = messages.filter((message) => message.text.trim().length > 0);
    if (validMessages.length === 0) return;
    setChatLog((prev) => [...prev, ...validMessages]);
  };

  useEffect(() => {
    answerTranscriptRef.current = answerTranscript;
  }, [answerTranscript]);

  // Fetch assignment questions if assignmentId is provided
  useEffect(() => {
    if (!assignmentId) return;

    const fetchAssignmentQuestions = async () => {
      setIsLoadingAssignment(true);
      try {
        const { data, error } = await supabase
          .from("assignment_questions")
          .select("id, content, order_index")
          .eq("assignment_id", assignmentId)
          .order("order_index");

        if (error) {
          console.error("Error fetching assignment questions:", error);
          setSpeechError("Failed to load assignment questions.");
          return;
        }

        setAssignmentQuestions(data || []);
      } catch (err) {
        console.error("Error fetching assignment questions:", err);
        setSpeechError("Failed to load assignment questions.");
      } finally {
        setIsLoadingAssignment(false);
      }
    };

    fetchAssignmentQuestions();
  }, [assignmentId]);

  const persistPracticeProgress = async (analysis: SpeakingAnalysis, partIndex: number) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const progressPercent = 100 / 3;
    const lastActivityAt = new Date().toISOString();
    const rpcPayload = {
      latest_score: analysis.overallScore,
      progress_percent: progressPercent,
      speaking_attempts: partIndex,
      last_activity_at: lastActivityAt,
      last_unit_index: requestedUnit,
      last_part_index: partIndex,
      notes: analysis.summary,
    };

    const { error: rpcError } = await supabase.rpc("record_student_practice_progress", rpcPayload);

    // If the RPC succeeded, we're done.
    if (!rpcError) return;

    // If the RPC is missing on the database, avoid attempting a client-side upsert
    // which will be blocked by the row-level security policy. Show a clear message
    // so the developer can run the DB setup script (supabase/profiles_setup.sql).
    const functionMissing =
      rpcError.code === "PGRST202" ||
      /Could not find the function\s+public\.record_student_practice_progress/i.test(rpcError.message);

    if (functionMissing) {
      setSpeechError(
        "Database helper 'record_student_practice_progress' not found. Run 'supabase/profiles_setup.sql' to install required DB functions and policies."
      );
      return;
    }

    // Other RPC errors should be surfaced.
    setSpeechError(rpcError.message);
  };

  const speakingCards = useMemo<SpeakingCard[]>(() => {
    // If we have assignment questions, use them instead of standard cards
    if (assignmentQuestions.length > 0) {
      return assignmentQuestions.map((question, index) => ({
        id: question.id,
        title: `Assignment - Part ${requestedPart} - Question ${index + 1}`,
        promptText: `Assignment Question ${index + 1}: ${question.content}\n\nAnswer naturally and clearly.`,
      }));
    }

    const unitPrefix = `Unit ${requestedUnit}`;
    const part1Topic = PART_1_TOPICS[UNIT_PART_1_TOPIC_INDEX[requestedUnit - 1] ?? 0];
    
    // For Part 1, keep one fixed topic per unit.
    if (requestedPart === 1) {
      return [
        {
          id: 1,
          title: `${unitPrefix} - Part 1 - ${part1Topic.topic}`,
          promptText: `${unitPrefix}, Part 1 - Topic: "${part1Topic.topic}"\n\nAnswer naturally about this topic in a short, clear response.`,
        },
      ];
    }

    // For Part 1 without selected topic, or other parts
    const cards: SpeakingCard[] = [
      {
        id: 1,
        title: `${unitPrefix} - Part 1 - Chat Session`,
        promptText: `${unitPrefix}, Part 1: Introduce yourself and answer naturally about your goal: "${goal}".`,
      },
      {
        id: 2,
        title: `${unitPrefix} - Part 2 - Cue Card Practice`,
        promptText: `${unitPrefix}, Part 2 - Cue Card Practice

1 minute to prepare, then speak for up to 2 minutes.

Task:
- Answer the cue card in a longer turn.
- Add one clear example or short story.
- Keep the answer natural, fluent, and organized.

AI practice cue:
Describe a topic that feels useful for your current level (${speakingLevel}) and explain why it matters to you.`,
      },
      {
        id: 3,
        title: `${unitPrefix} - Part 3 - Chat Session`,
        promptText: `${unitPrefix}, Part 3: Discuss your plan to reach ${targetTime} and support your answer with reasons and examples.`,
      },
    ].slice(0, SPEAKING_CARD_COUNT);

    if (requestedPart === 2) {
      return [cards[1] ?? cards[0]].filter(Boolean);
    }

    if (practiceMode === "learn") {
      return [cards[requestedPart - 1] ?? cards[0]].filter(Boolean);
    }

    return cards;
  }, [assignmentQuestions, goal, speakingLevel, targetTime, practiceMode, requestedPart, requestedUnit]);

  const [selectedSpeakingCards, setSelectedSpeakingCards] = useState<SpeakingCard[] | null>(null);
  const cardsInUse = selectedSpeakingCards ?? speakingCards;
  const activeSpeakingCard = cardsInUse[currentCardIndex];
  const selectedPart1Topic = selectedPart1TopicIndex !== null ? PART_1_TOPICS[selectedPart1TopicIndex] : null;
  const isCueCardPart = requestedPart === 2;
  const isPart1LearnMode = requestedPart === 1 && practiceMode === "learn";
  const isOnboardingChatVisible = isPart1LearnMode || !(activeStep === 5 && isSpeakingSessionActive);

  useEffect(() => {
    if (!autoStart || autoStartRef.current) return;
    if (practiceMode === null && !assignmentId) return;

    autoStartRef.current = true;
    setActiveStep(WIZARD_STEPS.length - 1);
  }, [autoStart, practiceMode, assignmentId]);

  useEffect(() => {
    // Reset Part 1 topic selection when part or unit changes
    if (requestedPart === 1) {
      setSelectedPart1TopicIndex(UNIT_PART_1_TOPIC_INDEX[requestedUnit - 1] ?? 0);
      setCurrentCardIndex(0);
    }
  }, [requestedPart, requestedUnit]);

  useEffect(() => {
    if (!autoStart || autoStartRef.current === false) return;
    if (activeStep !== WIZARD_STEPS.length - 1) return;
    if (isSpeakingSessionActive) return;

    autoStartRef.current = false;
    
    // For Part 1 without assignment, show topic selector instead of auto-starting
    if (requestedPart === 1 && selectedPart1TopicIndex === null && !assignmentId) {
      setShowTopicSelector(true);
    } else {
      startSpeaking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, activeStep, isSpeakingSessionActive, requestedPart, selectedPart1TopicIndex]);

  useEffect(() => {
    // Start only after Part 1 topic is actually selected and selector is closed.
    if (!autoStart) return;
    if (requestedPart !== 1) return;
    if (showTopicSelector) return;
    if (selectedPart1TopicIndex === null) return;
    if (isSpeakingSessionActive) return;
    if (activeStep !== WIZARD_STEPS.length - 1) return;

    startSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, requestedPart, showTopicSelector, selectedPart1TopicIndex, isSpeakingSessionActive, activeStep]);

  useEffect(() => {
    if (requestedPart === 2) {
      setCueCardView(isSpeakingSessionActive ? "intro" : "intro");
    } else {
      setCueCardView("intro");
    }
  }, [isSpeakingSessionActive, requestedPart]);

  const isPromptLikeText = (text: string) => {
    const normalizeText = (value: string) =>
      value
        .toLowerCase()
        .replace(/^question:\s*/, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const normalizedText = normalizeText(text);
    if (!normalizedText) return false;

    return speakingCards.some((card) => {
      const normalizedPrompt = normalizeText(card.promptText);
      if (!normalizedPrompt) return false;
      if (normalizedText === normalizedPrompt) return true;
      if (normalizedText.includes(normalizedPrompt) || normalizedPrompt.includes(normalizedText)) return true;

      const textTokens = normalizedText.split(" ").filter(Boolean);
      if (textTokens.length === 0) return false;
      const promptTokenSet = new Set(normalizedPrompt.split(" ").filter(Boolean));
      const overlapCount = textTokens.filter((token) => promptTokenSet.has(token)).length;
      const overlapRatio = overlapCount / textTokens.length;
      return overlapRatio >= 0.75;
    });
  };

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    setIsSpeechSupported(supported);

    const ttsSupported =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      "SpeechSynthesisUtterance" in window;
    setIsTtsSupported(ttsSupported);

    const savedVoicePreference = window.localStorage.getItem("ielts_voice_preference") as VoicePreference | null;
    if (savedVoicePreference === "female" || savedVoicePreference === "male") {
      setTtsVoicePreference(savedVoicePreference);
    }

    const refreshPreferredVoice = () => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      preferredTtsVoiceRef.current = pickPreferredVoice(voices, ttsVoicePreference);
    };

    refreshPreferredVoice();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", refreshPreferredVoice);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }

      if (answerRecognitionRef.current) {
        answerRecognitionRef.current.onresult = null;
        answerRecognitionRef.current.onerror = null;
        answerRecognitionRef.current.onend = null;
        answerRecognitionRef.current.stop();
      }

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.removeEventListener("voiceschanged", refreshPreferredVoice);
        window.speechSynthesis.cancel();
      }
    };
  }, [ttsVoicePreference]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("ielts_voice_enabled");
    if (saved === "1") {
      setIsVoiceEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem("ielts_voice_preference", ttsVoicePreference);

    preferredTtsVoiceRef.current = pickPreferredVoice(availableVoices, ttsVoicePreference);
  }, [availableVoices, ttsVoicePreference]);

  const stopSpeechToText = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const stopAnswerRecording = () => {
    manualStopRecordingRef.current = true;
    setIsResponseTimerRunning(false);
    if (answerRecognitionRef.current) {
      answerRecognitionRef.current.stop();
    }
    setIsAnswerRecording(false);
  };

  const submitCurrentAnswerAnalysis = async () => {
    const currentAnswer = answerTranscript.trim();
    if (!currentAnswer) return false;

    const normalizeText = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const normalizedAnswer = normalizeText(currentAnswer);
    const normalizedPrompt = normalizeText(activeSpeakingCard.promptText);
    const answerTokens = normalizedAnswer.split(" ").filter(Boolean);
    const promptTokenSet = new Set(normalizedPrompt.split(" ").filter(Boolean));
    const overlapCount = answerTokens.filter((token) => promptTokenSet.has(token)).length;
    const overlapRatio = answerTokens.length ? overlapCount / answerTokens.length : 0;
    const isLikelyPromptEcho =
      normalizedAnswer === normalizedPrompt ||
      normalizedAnswer.includes(normalizedPrompt) ||
      overlapRatio >= 0.8;

    if (currentAnswer === lastAnalyzedTranscript) {
      return true;
    }

    const adaptiveNudge = getAdaptiveEncouragement(currentAnswer, activeSpeakingCard.promptText);
    if (adaptiveNudge) {
      appendMessages({ role: "assistant", text: adaptiveNudge });
    }

    setIsAnalyzing(true);
    try {
      const analysis = await requestModelAnalysis(
        currentAnswer,
        activeSpeakingCard.promptText,
        goal,
        speakingLevel,
        targetTime,
      );
      const lengthCalibratedAnalysis = calibrateAnalysisByLength(currentAnswer, analysis);
      const calibratedAnalysis = calibrateAnalysisByRelevance(
        currentAnswer,
        activeSpeakingCard.promptText,
        lengthCalibratedAnalysis,
      );
      setLatestAnalysis(calibratedAnalysis);
      setFlippedCriteria({});
      setLastAnalyzedTranscript(currentAnswer);
      if (isLikelyPromptEcho) {
        appendMessages(
          {
            role: "assistant",
            text: "Your transcript looks like AI prompt audio. Please record your own answer and keep mic away from speaker output.",
          },
          { role: "assistant", text: formatAnalysisForChat(calibratedAnalysis) },
        );
      } else {
        appendMessages(
          { role: "user", text: currentAnswer },
          { role: "assistant", text: formatAnalysisForChat(calibratedAnalysis) },
        );
      }

      void persistPracticeProgress(calibratedAnalysis, practiceMode === "learn" ? requestedPart : currentCardIndex + 1);
    } catch {
      const fallbackAnalysis = buildFallbackAnalysis(currentAnswer);
      const lengthCalibratedFallbackAnalysis = calibrateAnalysisByLength(currentAnswer, fallbackAnalysis);
      const calibratedFallbackAnalysis = calibrateAnalysisByRelevance(
        currentAnswer,
        activeSpeakingCard.promptText,
        lengthCalibratedFallbackAnalysis,
      );
      setLatestAnalysis(calibratedFallbackAnalysis);
      setFlippedCriteria({});
      setLastAnalyzedTranscript(currentAnswer);
      if (isLikelyPromptEcho) {
        appendMessages({
          role: "assistant",
          text: "Your transcript looks like AI prompt audio. Please record your own answer and keep mic away from speaker output.",
        });
      } else {
        appendMessages({ role: "user", text: currentAnswer });
      }
      appendMessages({
        role: "assistant",
        text: [
          "Live model analysis is temporarily unavailable. Showing local estimated analysis instead.",
          "",
          formatAnalysisForChat(calibratedFallbackAnalysis),
        ].join("\n"),
      });

      void persistPracticeProgress(calibratedFallbackAnalysis, practiceMode === "learn" ? requestedPart : currentCardIndex + 1);
    } finally {
      setIsAnalyzing(false);
    }

    return true;
  };

  const speakCardText = (text: string) => {
    if (!isVoiceEnabled || !isTtsSupported || !text.trim()) return;
    const coachSpeechText = toNaturalCoachPrompt(text);
    if (!coachSpeechText) return;

    setSpeechError("");
    stopAnswerRecording();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(coachSpeechText);
    utterance.lang = "en-US";
    utterance.rate = ttsRate;
    utterance.voice = preferredTtsVoiceRef.current;
    utterance.onstart = () => setIsAiSpeaking(true);
    utterance.onend = () => setIsAiSpeaking(false);
    utterance.onerror = () => setIsAiSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const speakNow = (text: string) => {
    if (!isTtsSupported || !text.trim()) return;
    const coachSpeechText = toNaturalCoachPrompt(text);
    if (!coachSpeechText) return;

    setSpeechError("");
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(coachSpeechText);
    utterance.lang = "en-US";
    utterance.rate = ttsRate;
    utterance.voice = preferredTtsVoiceRef.current;
    utterance.onstart = () => setIsAiSpeaking(true);
    utterance.onend = () => setIsAiSpeaking(false);
    utterance.onerror = () => setIsAiSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoice = () => {
    setIsVoiceEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ielts_voice_enabled", next ? "1" : "0");
        if (!next && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          setIsAiSpeaking(false);
        }
      }
      if (next) {
        voiceJustEnabledRef.current = true;
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isVoiceEnabled || !voiceJustEnabledRef.current) return;
    voiceJustEnabledRef.current = false;

    if (isSpeakingSessionActive && requestedPart !== 2) {
      speakNow(activeSpeakingCard?.promptText || "");
      return;
    }

    const currentCoachMessage = `${STEP_COPY[activeStep].ai} ${STEP_COPY[activeStep].subtitle}`.trim();
    lastOnboardingStepSpokenRef.current = activeStep;
    speakNow(currentCoachMessage);
  }, [isVoiceEnabled, isSpeakingSessionActive, requestedPart, activeSpeakingCard, activeStep, ttsRate]);

  useEffect(() => {
    if (!isVoiceEnabled) {
      lastOnboardingStepSpokenRef.current = null;
      return;
    }
    if (isSpeakingSessionActive) return;
    if (lastOnboardingStepSpokenRef.current === activeStep) return;

    const currentCoachMessage = `${STEP_COPY[activeStep].ai} ${STEP_COPY[activeStep].subtitle}`.trim();
    lastOnboardingStepSpokenRef.current = activeStep;
    speakNow(currentCoachMessage);
  }, [isVoiceEnabled, isSpeakingSessionActive, activeStep, ttsRate]);

  const startAnswerRecording = () => {
    if (!isSpeechSupported) {
      setSpeechError("Speech to text is not supported in this browser.");
      return;
    }

    if (isAiSpeaking) {
      setSpeechError("Please wait until the AI finishes speaking before recording your answer.");
      return;
    }

    manualStopRecordingRef.current = false;
    adaptiveNudgeSentRef.current = false;

    void ensureMicrophoneAccess()
      .then(() => {
        setSpeechError("");
        setResponseTimeLeft(PART_RESPONSE_TIME_LIMIT_SECONDS);
        setIsResponseTimerRunning(true);
        const SpeechRecognitionCtor =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognitionCtor();

        recognition.lang = "en-US";
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            transcript += event.results[i][0].transcript;
          }
          const value = transcript.trim();
          setAnswerTranscript(value);
          if (value) {
            keepTryingSentRef.current = false;
            adaptiveNudgeSentRef.current = false;
          }
        };

        recognition.onerror = (event: any) => {
          const errorMsg = event.error || "unknown";
          setSpeechError(`Voice recording failed (${errorMsg}). Please try again or check microphone permissions.`);
          setIsResponseTimerRunning(false);
          setIsAnswerRecording(false);
          if (answerRecognitionRef.current) {
            answerRecognitionRef.current.stop();
          }
        };

        recognition.onend = () => {
          setIsAnswerRecording(false);

          if (!manualStopRecordingRef.current && isSpeakingSessionActive && isResponseTimerRunning) {
            const transcriptSnapshot = answerTranscriptRef.current.trim();
            if (!adaptiveNudgeSentRef.current) {
              const nudge = getAdaptiveEncouragement(transcriptSnapshot, activeSpeakingCard?.promptText || "");
              if (nudge) {
                appendMessages({ role: "assistant", text: nudge });
                adaptiveNudgeSentRef.current = true;
              }
            }

            window.setTimeout(() => {
              try {
                recognition.start();
                setIsAnswerRecording(true);
              } catch {
                // ignore restart failures
              }
            }, 250);
          }
        };

        answerRecognitionRef.current = recognition;
        setIsAnswerRecording(true);
        recognition.start();
      })
      .catch((error) => {
        setSpeechError(error instanceof Error ? error.message : "Voice recording feature could not be started.");
        setIsResponseTimerRunning(false);
        setIsAnswerRecording(false);
      });
  };

  const moveToNextCard = async () => {
    const cards = selectedSpeakingCards ?? speakingCards;

    if (answerTranscript.trim()) {
      await submitCurrentAnswerAnalysis();
      appendMessages({ role: "assistant", text: "Good." });
    } else {
      appendMessages({ role: "assistant", text: "Keep trying. Take one breath and answer in your own words." });
    }

    setIsResponseTimerRunning(false);
    setAnswerTranscript("");
    setLastAnalyzedTranscript("");
    setResponseTimeLeft(PART_RESPONSE_TIME_LIMIT_SECONDS);
    setFlippedCriteria({});
    setIsCardFlipped(false);
    keepTryingSentRef.current = false;

    if (currentCardIndex >= cards.length - 1) {
      appendMessages({ role: "assistant", text: "Your first speaking session is complete. Do you want to repeat from card one?" });
      setIsSpeakingSessionActive(false);
      setSessionCompleted(true);
      setCurrentCardIndex(0);
      return;
    }

    const nextIndex = currentCardIndex + 1;
    setCurrentCardIndex(nextIndex);
    appendMessages({ role: "assistant", text: `Next question: ${toNaturalCoachPrompt(cards[nextIndex].promptText)}` });
    speakCardText(cards[nextIndex].promptText);
  };

  const startSpeechToText = (target: SpeechTarget) => {
    if (!isSpeechSupported) {
      setSpeechError("Speech to text is not supported in this browser.");
      return;
    }

    void ensureMicrophoneAccess()
      .then(() => {
        setSpeechError("");
        const SpeechRecognitionCtor =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognitionCtor();

        recognition.lang = "en-US";
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            transcript += event.results[i][0].transcript;
          }

          const value = transcript.trim();
          if (!value) return;

          if (target === "other") {
            setOtherValue(value);
            return;
          }

          setNickname(value);
        };

        recognition.onerror = (event: any) => {
          const errorMsg = event.error || "unknown";
          setSpeechError(`Could not capture your voice (${errorMsg}). Please try again.`);
          setIsListening(false);
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        setIsListening(true);
        recognition.start();
      })
      .catch((error) => {
        setSpeechError(error instanceof Error ? error.message : "Speech to text could not be started.");
        setIsListening(false);
      });
  };

  const nextStep = () => {
    stopSpeechToText();
    stopAnswerRecording();
    setShowOtherInput(false);
    setOtherValue("");
    setActiveStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  };

  const handleDismissSpeechError = () => {
    setSpeechError("");
    // ensure any active recognizers are stopped and flags cleared
    try {
      if (answerRecognitionRef.current) {
        answerRecognitionRef.current.onresult = null;
        answerRecognitionRef.current.onerror = null;
        answerRecognitionRef.current.onend = null;
        answerRecognitionRef.current.stop();
      }
    } catch (e) {
      // ignore
    }
    try {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    } catch (e) {
      // ignore
    }
    setIsAnswerRecording(false);
    setIsResponseTimerRunning(false);
    setIsListening(false);
  };

  const prevStep = () => {
    stopSpeechToText();
    stopAnswerRecording();
    setShowOtherInput(false);
    setOtherValue("");
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const buildFollowUpReply = (step: number, value: string) => {
    if (step === 1) return `Nice, "${value}" is a clear goal. What would you like to improve first?`;
    if (step === 2) return `Got it, you are at "${value}". What feels hardest for you right now?`;
    if (step === 3) return `"${value}" gives us a realistic timeline. What practice routine can you keep up this week?`;
    if (step === 4) return `Nice to meet you, ${value}. I will call you that from now on.`;
    return `Great, I noted "${value}". Let us keep going.`;
  };

  const selectOption = (value: string) => {
    if (activeStep === 1) handleGoalChange(value);
    if (activeStep === 2) handleLevelChange(value);
    if (activeStep === 3) handleTargetTimeChange(value);

    appendMessages(
      { role: "user", text: value },
      { role: "assistant", text: buildFollowUpReply(activeStep, value) },
    );
    nextStep();
  };

  const submitOther = () => {
    const value = otherValue.trim();
    if (!value) return;

    if (activeStep === 1) handleGoalChange(value);
    if (activeStep === 2) handleLevelChange(value);
    if (activeStep === 3) handleTargetTimeChange(value);
    if (activeStep === 4) setNickname(value);

    appendMessages(
      { role: "user", text: value },
      { role: "assistant", text: buildFollowUpReply(activeStep, value) },
    );
    nextStep();
  };

  const submitNickname = () => {
    const value = nickname.trim();
    if (!value) return;

    setNickname(value);
    appendMessages(
      { role: "user", text: value },
      { role: "assistant", text: buildFollowUpReply(activeStep, value) },
    );
    nextStep();
  };

  const startSpeaking = () => {
    const chosen = speakingCards[0];
    if (!chosen) return;
    const isPart1Learn = requestedPart === 1 && practiceMode === "learn";
    if (requestedPart === 2) {
      setCueCardView("intro");
    }
    setSpeechError("");
    setIsSpeakingSessionActive(true);
    setPart1IntroShown(isPart1Learn);
    setSessionCompleted(false);
    // pick the chosen card for this session
    setSelectedSpeakingCards([chosen]);
    setCurrentCardIndex(0);
    setAnswerTranscript("");
    setIsCardFlipped(false);
    setLatestAnalysis(null);
    setLastAnalyzedTranscript("");
    setResponseTimeLeft(PART_RESPONSE_TIME_LIMIT_SECONDS);
    setSessionTimeLeft(SESSION_TIME_LIMIT_SECONDS);
    setIsResponseTimerRunning(false);
    setFlippedCriteria({});
    keepTryingSentRef.current = false;
    manualStopRecordingRef.current = false;
    adaptiveNudgeSentRef.current = false;

    if (isPart1Learn) {
      return;
    }

    if (requestedPart !== 2) {
      speakCardText(chosen.promptText);
    }
  };

  const beginCueCardTransition = () => {
    if (cueCardTimerRef.current !== null) {
      window.clearTimeout(cueCardTimerRef.current);
      cueCardTimerRef.current = null;
    }

    setCueCardView("transition");
    cueCardTimerRef.current = window.setTimeout(() => {
      setCueCardView("card");
      cueCardTimerRef.current = null;
    }, 650);
  };

  useEffect(() => {
    return () => {
      if (cueCardTimerRef.current !== null) {
        window.clearTimeout(cueCardTimerRef.current);
      }
    };
  }, []);

  const goToUserDashboard = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "1");
    }
    router.push("/dashboard/user");
  };

  useEffect(() => {
    if (!isSpeakingSessionActive || !isResponseTimerRunning || responseTimeLeft <= 0) return;

    const timer = window.setInterval(() => {
      setResponseTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isSpeakingSessionActive, isResponseTimerRunning, responseTimeLeft]);

  useEffect(() => {
    if (!isSpeakingSessionActive || responseTimeLeft !== 0) return;

    if (isAnswerRecording) {
      stopAnswerRecording();
      if (!keepTryingSentRef.current) {
        keepTryingSentRef.current = true;
        appendMessages({ role: "assistant", text: "Time is up. Please review your answer or move to the next prompt." });
      }
      return;
    }

    if (!answerTranscript.trim() && !keepTryingSentRef.current) {
      keepTryingSentRef.current = true;
      appendMessages({ role: "assistant", text: "Keep trying. I am here. You can answer with one simple idea first." });
    }
  }, [answerTranscript, isSpeakingSessionActive, responseTimeLeft]);

  useEffect(() => {
    if (!isSpeakingSessionActive) return;

    if (sessionTimeLeft <= 0) {
      setIsSpeakingSessionActive(false);
      setSessionCompleted(true);
      appendMessages({ role: "assistant", text: "Your 20-minute speaking session is finished. Review the feedback or start a new session later." });
      return;
    }

    const timer = window.setInterval(() => {
      setSessionTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [appendMessages, isSpeakingSessionActive, sessionTimeLeft]);

  const startTypingCustom = () => {
    setShowOtherInput(true);
  };

  useEffect(() => {
    let isMounted = true;

    const ensureAuthenticated = async () => {
      if (typeof window !== "undefined" && replayOnboarding) {
        window.localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (!user) {
        setIsAuthenticated(false);
        setIsAuthChecking(false);
        router.replace("/landing-page");
        return;
      }

      if (
        !replayOnboarding &&
        typeof window !== "undefined" &&
        window.localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "1"
      ) {
        setIsAuthenticated(true);
        setIsAuthChecking(false);
        router.replace("/dashboard/user");
        return;
      }

      setIsAuthenticated(true);
      setIsAuthChecking(false);
    };

    void ensureAuthenticated();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      if (!session?.user) {
        setIsAuthenticated(false);
        setIsAuthChecking(false);
        router.replace("/landing-page");
        return;
      }

      if (
        !replayOnboarding &&
        typeof window !== "undefined" &&
        window.localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "1"
      ) {
        setIsAuthenticated(true);
        setIsAuthChecking(false);
        router.replace("/dashboard/user");
        return;
      }

      setIsAuthenticated(true);
      setIsAuthChecking(false);
    });

    return () => {
      isMounted = false;
    };
  }, [replayOnboarding, router]);

  if (isAuthChecking || !isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-tr from-[#eeeeee] to-neutral-200 px-6 py-10">
        <div className="rounded-2xl border border-white/70 bg-white/80 px-6 py-4 text-sm font-medium text-neutral-600 shadow-sm backdrop-blur-sm">
          Preparing your onboarding...
        </div>
      </main>
    );
  }

  if (isPart1LearnMode && activeStep === 5) {
    return (
      <main className="min-h-screen w-full bg-[#FFFFF] px-6 py-6 sm:px-10">
        <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col">
          <div className="flex items-center justify-between rounded-xl bg-white/80 px-2 py-2 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsSpeakingSessionActive(false);
                  setPart1IntroShown(false);
                  setActiveStep(4);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600"
              >
                ←
              </button>
              <div className="text-base font-semibold text-neutral-900">Practice Unit {requestedUnit} - Part 1 (Introduction)</div>
            </div>
            <div className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm font-semibold text-neutral-800">
              {String(Math.floor(sessionTimeLeft / 3600)).padStart(2, "0")}:
              {String(Math.floor((sessionTimeLeft % 3600) / 60)).padStart(2, "0")}:
              {String(sessionTimeLeft % 60).padStart(2, "0")}
            </div>
          </div>

    <div className="relative mt-4 flex-1 overflow-y-auto pb-6">

      {isSpeakingSessionActive && part1IntroShown ? (
        <div className="relative space-y-3">

          <div className="relative flex items-center gap-2 pl-1 text-rose-500">
            <img src="/logo.png" className="h-6 w-6 rounded-full object-cover" />
            <span className="text-lg font-semibold text-[#C95B5B]">Lexi AI Coach</span>
          </div>

          <div className="max-w-3xl rounded-xl border bg-white px-4 py-3 text-base text-neutral-800 shadow-sm">
            Hello! Before we start, let's understand the speaking session first.
          </div>

          <div className="max-w-3xl rounded-xl border bg-white px-4 py-3 text-base text-neutral-800 shadow-sm">
            Please read instructions below.
          </div>

          <div className="max-w-3xl space-y-2">
            <div className="rounded-xl border bg-neutral-100 px-4 py-3 text-sm">
              ① 2 topics, 8 questions total
            </div>

            <div className="rounded-xl border bg-amber-50 px-4 py-3 text-sm text-amber-700">
              ② 4–5 minutes speaking time
            </div>

            <div className="rounded-xl border bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              ⓘ Keep answers natural & casual
            </div>
          </div>
        </div>
      ) : (

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-sm text-neutral-500">
                  <span>AI Coach</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleVoice}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        isVoiceEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-white text-neutral-600"
                      }`}
                    >
                      {isVoiceEnabled ? "Voice on" : "Voice off"}
                    </button>
                    <select
                      value={ttsVoicePreference}
                      onChange={(event) => setTtsVoicePreference(event.target.value as VoicePreference)}
                      className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 outline-none"
                    >
                      <option value="female">Female voice</option>
                      <option value="male">Male voice</option>
                    </select>
                  </div>
                </div>

                   {chatLog.map((item, index) => {
            if (!item.text.trim()) return null;
            const isAssistant = item.role === "assistant";

            return (
              <div key={index} className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-6 shadow-sm ${
                    isAssistant
                      ? "border bg-white text-neutral-800"
                      : "bg-neutral-900 text-white"
                  }`}
                >
                  {item.text}
                </div>
              </div>
            );
          })}

          {isSpeakingSessionActive && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-xl border bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm">
                {answerTranscript || "Speak your answer..."}
              </div>
            </div>
          )}
        </div>
      )}
    </div>

    {!isSpeakingSessionActive ? (
      <div className="mt-3 flex justify-between">
        <button className="rounded-full border bg-white px-6 py-2 text-sm">
          Back
        </button>

        <button
          onClick={startSpeaking}
          className="rounded-full px-6 py-2 text-sm text-white"
          style={{ backgroundImage: "linear-gradient(90deg, #f9b8bc 0%, #d85e63 100%)" }}
        >
          Start
        </button>
      </div>
    ) : part1IntroShown ? (
      <div className="mt-3 flex justify-between">
        <button className="rounded-full border bg-white px-6 py-2 text-sm text-rose-500">
          Cancel
        </button>
        <button
          className="rounded-full px-6 py-2 text-sm text-white"
          style={{ backgroundImage: "linear-gradient(90deg, #f9b8bc 0%, #d85e63 100%)" }}
        >
          Start Session
        </button>
      </div>
    ) : (

        <div className="mt-3 flex justify-between gap-2">
        <button className="rounded-full border bg-white px-4 py-2 text-sm text-rose-500">
          Cancel
        </button>

        <div className="flex gap-2">
          <button className="rounded-full bg-black px-4 py-2 text-sm text-white">
            Record
          </button>

          <button className="rounded-full border bg-white px-4 py-2 text-sm">
            Next
          </button>
        </div>
      </div>
    )}
  </section>
</main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-tr from-[#eeeeee] to-neutral-200 px-6 pt-14 pb-10">
      <section className="mx-auto w-full max-w-7xl">
        {/* Part 1 Topic Selector */}
        {showTopicSelector && requestedPart === 1 && (
          <div className="mx-auto mb-6 w-full max-w-3xl rounded-2xl bg-white/85 p-6 shadow-sm backdrop-blur-sm">
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">Choose a Part 1 Topic</h2>
            <p className="mb-6 text-sm text-neutral-600">
              Select a topic you'd like to practice. You'll get 4 questions related to this topic.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {PART_1_TOPICS.map((topic, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedPart1TopicIndex(idx);
                    setShowTopicSelector(false);
                    setCurrentCardIndex(0);
                  }}
                  className="rounded-lg border border-neutral-200 bg-white p-4 text-left transition hover:border-brand-300 hover:bg-brand-50 dark:border-neutral-700 dark:bg-white/[0.03] dark:hover:bg-brand-500/10"
                >
                  <p className="font-medium text-neutral-900 dark:text-white/90">{topic.topic}</p>
                  <p className="mt-2 text-xs text-neutral-500 dark:text-gray-400">4 questions</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm" style={{ display: showTopicSelector && requestedPart === 1 ? "none" : "flex" }}>
          <div className="text-sm text-neutral-600">
            Step {currentStep} of {WIZARD_STEPS.length}
          </div>
          <div className="text-sm font-medium text-neutral-900">{WIZARD_STEPS[activeStep]}</div>
        </div>

        <div className="mx-auto grid min-h-[560px] w-full gap-6 rounded-[30px] bg-white/85 p-5 shadow-sm backdrop-blur-sm lg:grid-cols-1" style={{ display: showTopicSelector && requestedPart === 1 ? "none" : "grid" }}>
          <div className="mx-auto flex min-h-[420px] w-full flex-col rounded-[26px] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(250,250,250,0.97))] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3 text-sm text-neutral-500">
              <span>AI Coach</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    isVoiceEnabled
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-neutral-200 bg-white text-neutral-600"
                  }`}
                >
                  {isVoiceEnabled ? "Voice on" : "Voice off"}
                </button>
                <select
                  value={ttsVoicePreference}
                  onChange={(event) => setTtsVoicePreference(event.target.value as VoicePreference)}
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 outline-none transition focus:border-[color:var(--primary)]"
                >
                  <option value="female">Female voice</option>
                  <option value="male">Male voice</option>
                </select>
                <span>
                  Step {currentStep} of {WIZARD_STEPS.length}
                </span>
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundImage:
                        "linear-gradient(90deg, var(--primary) 0%, var(--secondary) 55%, var(--accent) 100%)",
                    }}
                  />
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-1 pb-2">
              {isCueCardPart && isSpeakingSessionActive ? (
                <div className="space-y-4">
                  {cueCardView === "intro" && (
                    <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Part 2 instructions</div>
                      <h2 className="mt-2 text-2xl font-semibold text-neutral-900">Read the rules first</h2>
                      <div className="mt-4 space-y-3 text-sm leading-7 text-neutral-600">
                        <p>1. You get 1 minute to prepare.</p>
                        <p>2. Speak for up to 2 minutes in one long turn.</p>
                        <p>3. Do not treat it like a chat. Build a short answer with an opening, details, and a closing opinion.</p>
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">Opening idea</div>
                        <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">Example or detail</div>
                        <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">Short opinion</div>
                      </div>
                      <button
                        type="button"
                        onClick={beginCueCardTransition}
                        className="mt-6 inline-flex items-center justify-center rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
                      >
                        Continue to cue card
                      </button>
                    </div>
                  )}

                  {cueCardView === "transition" && (
                    <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-amber-100 bg-[linear-gradient(180deg,#fff9ef,#fffdf8)] p-6 text-center shadow-sm">
                      <div>
                        <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-amber-100" />
                        <div className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-amber-600">Preparing cue card</div>
                        <div className="mt-2 text-2xl font-semibold text-neutral-900">Get ready to speak</div>
                        <div className="mt-3 text-sm leading-7 text-neutral-600">The cue card is coming up now. Think of your opening, one example, and a closing opinion.</div>
                      </div>
                    </div>
                  )}

                  {cueCardView === "card" && (
                    <div className="rounded-[32px] border border-amber-200 bg-[#fffaf0] p-6 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                      <div className="flex items-center justify-between border-b border-amber-100 pb-4">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-600">Part 2 cue card</div>
                          <div className="mt-1 text-lg font-semibold text-neutral-900">Long turn practice</div>
                        </div>
                        <div className="flex gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                          <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-amber-700">1 min prep</span>
                          <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-amber-700">2 min speak</span>
                        </div>
                      </div>

                      <div className="mx-auto mt-6 max-w-3xl rounded-[28px] border border-amber-200 bg-white p-6 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-500">Cue card</div>
                        <div className="mt-3 text-2xl font-semibold leading-tight text-neutral-900">
                          {activeSpeakingCard?.title?.replace(`${requestedUnit} - Part 2 - `, "") || "Long turn practice"}
                        </div>
                        <div className="mt-5 space-y-4 text-sm leading-7 text-neutral-700 sm:text-base">
                          <p>{activeSpeakingCard?.promptText || "Prepare a 2-minute answer based on the cue card."}</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl bg-amber-50 px-4 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">Preparation</div>
                              <div className="mt-1 font-medium text-neutral-900">Think of 2-3 ideas, one example, and a short ending.</div>
                            </div>
                            <div className="rounded-2xl bg-amber-50 px-4 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">Speaking goal</div>
                              <div className="mt-1 font-medium text-neutral-900">Speak naturally for up to 2 minutes without back-and-forth chat.</div>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-dashed border-amber-200 bg-[#fffdfa] px-4 py-3 text-neutral-600">
                            Tip: start with an opening sentence, describe details, then add a personal opinion.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {isOnboardingChatVisible && chatLog.map((item, index) => {
                    if (!item.text.trim()) return null;
                    const isAssistant = item.role === "assistant";

                    return (
                      <div
                        key={`${item.role}-${index}`}
                        className={`lexa-fade-slide-in flex items-end gap-2 ${isAssistant ? "justify-start" : "justify-end"}`}
                        style={{ animationDelay: `${Math.min(index * 35, 220)}ms` }}
                      >
                        {isAssistant && (
                          <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white shadow-sm">
                            AI
                          </div>
                        )}
                        <div
                          className={`relative max-w-[82%] whitespace-pre-line px-4 py-3 text-sm leading-6 shadow-sm ${
                            isAssistant
                              ? "rounded-[20px] rounded-bl-md border border-neutral-200 bg-white text-neutral-800"
                              : "rounded-[20px] rounded-br-md border border-transparent text-white"
                          }`}
                          style={
                            isAssistant
                              ? undefined
                              : {
                                  backgroundColor: "#111827",
                                  color: "#ffffff",
                                }
                          }
                        >

                          
                          <span
                            aria-hidden="true"
                            className={`"max-w-[75%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm text-neutral-800 shadow-sm border" ${
                              isAssistant
                                ? "-left-1 border-b border-l border-neutral-200 bg-white"
                                : "-right-1 bg-[#111827]"
                            }`}
                          />
                          {item.text}
                        </div>
                        {!isAssistant && (
                          <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-[11px] font-semibold text-white shadow-sm">
                            You
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="flex items-start gap-2">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white shadow-sm">
                      AI
                    </div>
                    <div className="lexa-fade-slide-in relative max-w-[86%] rounded-[22px] rounded-bl-md border border-neutral-200 bg-white px-4 py-4 shadow-sm">
                      <span aria-hidden="true" className="absolute -left-1 bottom-3 h-2.5 w-2.5 rotate-45 border-b border-l border-neutral-200 bg-white" />
                      <div className="text-sm font-medium text-neutral-900">{STEP_COPY[activeStep].ai}</div>
                      <div className="mt-2 text-sm leading-6 text-neutral-500">{STEP_COPY[activeStep].subtitle}</div>
                      {speechError && (
                        <div className="mt-3 rounded-lg bg-red-50 p-3">
                          <div className="text-xs font-medium text-red-700">{speechError}</div>
                          {speechError.includes("Permission denied") && (
                            <div className="mt-2 text-xs text-red-600 leading-5">
                              <p className="font-medium mb-1">To allow microphone access:</p>
                              <ol className="list-decimal list-inside space-y-1">
                                <li>Click the lock/camera icon in your address bar</li>
                                <li>Find "Microphone" and select "Allow"</li>
                                <li>Reload this page</li>
                              </ol>
                              <div className="mt-2 pt-2 border-t border-red-200">
                                <button
                                  type="button"
                                  onClick={() => setTestModeSkipMic(!testModeSkipMic)}
                                  className="text-xs underline text-red-700 hover:text-red-800"
                                >
                                  {testModeSkipMic ? "❌ Test mode ON" : "✓ Test without microphone"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {activeStep === 0 && (
                        <div className="mt-4 space-y-3 rounded-2xl border border-neutral-100 bg-[#fafafa] p-4">
                          <div className="text-sm font-medium text-neutral-900">I can help you start from here:</div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={nextStep}
                              className="rounded-full border border-[color:var(--primary)] bg-[color:var(--tertiary)]/80 px-4 py-2.5 text-left text-sm font-medium text-neutral-900 transition hover:-translate-y-[1px]"
                            >
                              Show options
                            </button>
                            <button
                              type="button"
                              onClick={startTypingCustom}
                              className="rounded-full border border-dashed border-neutral-300 bg-white px-4 py-2.5 text-left text-sm text-neutral-700 transition hover:border-[color:var(--primary)]"
                            >
                              Other / type custom
                            </button>
                          </div>
                          {showOtherInput && activeStep === 0 && (
                            <div className="space-y-3 pt-1">
                              <div className="rounded-2xl bg-white p-4">
                                <div className="text-sm font-medium text-neutral-900">Type your own answer</div>
                                <div className="mt-1 text-xs leading-5 text-neutral-500">
                                  Example: focus on speaking only, target band 7+, or practice 15 minutes per day.
                                </div>
                                <textarea
                                  value={otherValue}
                                  onChange={(e) => setOtherValue(e.target.value)}
                                  autoFocus
                                  rows={3}
                                  placeholder="Type your answer or preference"
                                  className="mt-3 w-full resize-none rounded-2xl border border-neutral-200 bg-[#fafafa] px-4 py-3 text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-[color:var(--primary)]"
                                />
                                <div className="mt-3 flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => (isListening ? stopSpeechToText() : startSpeechToText("other"))}
                                    className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700"
                                  >
                                    {isListening ? "Stop mic" : "Use mic"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setShowOtherInput(false)}
                                    className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={submitOther}
                                    className="rounded-full px-4 py-2 text-sm font-medium text-white shadow-sm"
                                    style={{
                                      backgroundImage:
                                        "linear-gradient(90deg, var(--primary) 0%, var(--secondary) 55%, var(--accent) 100%)",
                                    }}
                                  >
                                    Submit answer
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {activeStep > 0 && activeStep < 5 && STEP_COPY[activeStep].options && !showOtherInput && (
                        <div className="mt-4 flex flex-col gap-2">
                          {STEP_COPY[activeStep].options.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => selectOption(item)}
                              className="w-fit max-w-full rounded-full border border-neutral-200 bg-[#fafafa] px-4 py-2.5 text-left text-sm text-neutral-800 transition hover:-translate-y-[1px] hover:border-[color:var(--primary)] hover:bg-[color:var(--tertiary)]/70"
                            >
                              {item}
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => setShowOtherInput(true)}
                            className="w-fit max-w-full rounded-full border border-dashed border-neutral-300 bg-white px-4 py-2.5 text-left text-sm text-neutral-500 transition hover:border-[color:var(--primary)] hover:text-neutral-700"
                          >
                            {STEP_COPY[activeStep].otherLabel ?? "Other / type custom"}
                          </button>

                          <div className="text-xs text-neutral-400">If no option fits, choose Other and type your own answer.</div>
                        </div>
                      )}

                      {activeStep > 0 && activeStep < 5 && showOtherInput && (
                        <div className="mt-4 space-y-4">
                          <div className="text-sm font-medium text-neutral-900">Type your own answer</div>
                          <input
                            value={otherValue}
                            onChange={(e) => setOtherValue(e.target.value)}
                            placeholder="Type your own answer"
                            className="w-full rounded-2xl border border-neutral-200 bg-[#fafafa] px-4 py-3 text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-[color:var(--primary)]"
                          />
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => (isListening ? stopSpeechToText() : startSpeechToText("other"))}
                              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700"
                            >
                              {isListening ? "Stop mic" : "Use mic"}
                            </button>
                            <button
                              type="button"
                              onClick={submitOther}
                              className="rounded-full px-4 py-2 text-sm font-medium text-white shadow-sm"
                              style={{
                                backgroundImage: "linear-gradient(90deg, var(--primary) 0%, var(--secondary) 55%, var(--accent) 100%)",
                              }}
                            >
                              Submit answer
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowOtherInput(false)}
                              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700"
                            >
                              Back to options
                            </button>
                          </div>
                        </div>
                      )}

                      {activeStep === 4 && (
                        <div className="mt-4 space-y-4">
                          <input
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="Example: Aulia"
                            className="w-full rounded-2xl border border-neutral-200 bg-[#fafafa] px-4 py-3 text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-[color:var(--primary)]"
                          />
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => (isListening ? stopSpeechToText() : startSpeechToText("nickname"))}
                              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700"
                            >
                              {isListening ? "Stop mic" : "Use mic"}
                            </button>
                            <button
                              type="button"
                              onClick={submitNickname}
                              className="rounded-full px-4 py-2 text-sm font-medium text-white shadow-sm"
                              style={{
                                backgroundImage: "linear-gradient(90deg, var(--primary) 0%, var(--secondary) 55%, var(--accent) 100%)",
                              }}
                            >
                              Save nickname
                            </button>
                          </div>
                        </div>
                      )}

                      {activeStep === 5 && (
                        <div className="mt-4 space-y-4">
                          {!(isSpeakingSessionActive && part1IntroShown && isPart1LearnMode) && (
                            <div className="whitespace-pre-line rounded-2xl bg-[color:var(--tertiary)]/70 p-4 text-sm leading-7 text-neutral-700">
                              {summaryText}
                            </div>
                          )}

                          {isSpeakingSessionActive && part1IntroShown && isPart1LearnMode && (
                            <div className="relative space-y-4 pt-1">
                              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-200/50 blur-3xl" />

                              <div className="relative flex items-center justify-between gap-3 rounded-2xl bg-white/75 px-3 py-2">
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPart1IntroShown(false);
                                      setIsSpeakingSessionActive(false);
                                    }}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600"
                                  >
                                    ←
                                  </button>
                                  <div className="text-xl font-semibold text-neutral-900">Practice Unit {requestedUnit} - Part 1 (Introduction)</div>
                                </div>
                                <div className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-2xl font-semibold text-neutral-800">
                                  {String(Math.floor(sessionTimeLeft / 3600)).padStart(2, "0")}:{String(
                                    Math.floor((sessionTimeLeft % 3600) / 60),
                                  ).padStart(2, "0")}:{String(sessionTimeLeft % 60).padStart(2, "0")}
                                </div>
                              </div>

                              <div className="relative ml-12 flex items-center gap-2 text-rose-500">
                                <img src="/logo.png" alt="LexiSpeak logo" className="h-7 w-7 rounded-full object-cover" />
                                <span className="text-2xl font-semibold text-[#C95B5B]">Lexi - AI Coach</span>
                              </div>

                              <div className="relative ml-12 max-w-4xl rounded-2xl border border-neutral-200 bg-white px-6 py-5 text-2xl leading-9 text-neutral-800 shadow-sm">
                                Hello! Before we start the practice session, let's give you a nice understanding about this <span className="font-semibold">introduction and interview</span> system first!
                              </div>

                              <div className="relative ml-12 max-w-[780px] rounded-2xl border border-neutral-200 bg-white px-6 py-5 text-2xl leading-9 text-neutral-800 shadow-sm">
                                Please carefully read the instructions below before proceed the practice session
                              </div>

                              <div className="relative ml-12 max-w-[820px] space-y-3 pt-1">
                                <div className="rounded-2xl border border-neutral-400 bg-neutral-200 px-5 py-4 text-xl text-neutral-800">
                                  ① I will include 2 speaking topics with 4 question for each topic, so <span className="font-semibold">8 questions in total.</span>
                                </div>
                                <div className="rounded-2xl border border-amber-400 bg-amber-100 px-5 py-4 text-xl text-amber-700">
                                  ② You will have to speak for the total of <span className="font-semibold">4-5 minutes for 8 questions.</span>
                                </div>
                                <div className="rounded-2xl border border-emerald-500 bg-emerald-200 px-5 py-4 text-xl text-emerald-700">
                                  ⓘ <span className="font-semibold">Tips:</span> Keep your answers reasonable while treating it like a casual conversation.
                                </div>
                              </div>

                              <div className="relative mt-10 flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPart1IntroShown(false);
                                    setIsSpeakingSessionActive(false);
                                  }}
                                  className="rounded-full border border-neutral-200 bg-white px-8 py-3 text-2xl font-medium text-rose-500 shadow-sm"
                                >
                                  Cancel
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setPart1IntroShown(false);
                                    const chosen = speakingCards[0];
                                    if (!chosen) return;
                                    appendMessages({ role: "assistant", text: `Topic: ${PART_1_TOPICS[UNIT_PART_1_TOPIC_INDEX[requestedUnit - 1] ?? 0].topic}` });
                                    appendMessages({ role: "assistant", text: `Question 1: ${toNaturalCoachPrompt(chosen.promptText)}` });
                                    speakCardText(chosen.promptText);
                                  }}
                                  className="rounded-full px-10 py-3 text-2xl font-medium text-white shadow-sm"
                                  style={{ backgroundImage: "linear-gradient(90deg, #f9b8bc 0%, #d85e63 100%)" }}
                                >
                                  Start Session
                                </button>
                              </div>
                            </div>
                          )}

                          {!isSpeakingSessionActive ? (
                            sessionCompleted ? (
                              <div className="flex w-full items-center justify-center gap-3">
                                <button
                                  type="button"
                                  onClick={goToUserDashboard}
                                  className="w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-base font-medium text-neutral-700 border border-neutral-200 bg-white"
                                >
                                  Finish
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={startSpeaking}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-medium text-white shadow-sm transition-transform duration-200 hover:-translate-y-[1px]"
                                style={{
                                  backgroundImage:
                                    "linear-gradient(90deg, var(--primary) 0%, var(--secondary) 55%, var(--accent) 100%)",
                                }}
                              >
                                <svg
                                  aria-hidden="true"
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  className="h-5 w-5"
                                >
                                  <path
                                    d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a1 1 0 1 1 2 0 5 5 0 1 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.07A7 7 0 0 1 5 12Z"
                                    fill="currentColor"
                                  />
                                </svg>
                                {requestedPart === 2 ? "Start cue-card practice" : "Start speaking now"}
                              </button>
                            )
                          ) : !(part1IntroShown && isPart1LearnMode) ? (
                            <div className="space-y-3">
                              {requestedPart !== 2 && (
                                <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
                                  <div className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                                    Current question
                                  </div>
                                  <div className="mt-2 text-center font-medium text-neutral-900">
                                    {toNaturalCoachPrompt(activeSpeakingCard?.promptText || "") || "Question is being prepared..."}
                                  </div>
                                </div>
                              )}
                              <div className="rounded-2xl bg-[#f8fafc] p-4 text-sm text-neutral-700">
                                <div className="text-center font-medium text-neutral-900">Answer transcript</div>
                                <div className="mt-2 min-h-[44px] text-center leading-6">{answerTranscript || "No recorded answer yet."}</div>
                              </div>

                              {latestAnalysis && (
                                <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-sm font-semibold text-neutral-900">AI speaking analysis</div>
                                    <div className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
                                      Band {latestAnalysis.overallScore}/9
                                    </div>
                                  </div>

                                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <div className="rounded-xl bg-neutral-50 px-3 py-2">
                                      <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Selected level</div>
                                      <div className="mt-1 font-medium text-neutral-900">{speakingLevel}</div>
                                    </div>
                                    <div className="rounded-xl bg-neutral-50 px-3 py-2">
                                      <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Level fit</div>
                                      <div className="mt-1 font-medium text-neutral-900">
                                        {getLevelFitLabel(latestAnalysis.overallScore, speakingLevel)}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-3 rounded-xl bg-[#fafafa] px-3 py-2 text-neutral-700">
                                    {latestAnalysis.summary}
                                  </div>

                                  {latestAnalysis.personalizedInsight?.levelComparison && (
                                    <div className="mt-2 rounded-xl border border-neutral-200 px-3 py-2 text-neutral-700">
                                      <span className="font-medium text-neutral-900">Level comparison: </span>
                                      {latestAnalysis.personalizedInsight.levelComparison}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                                <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-500">
                                  <span className="rounded-full bg-neutral-100 px-3 py-1">
                                    Response time: {responseTimeLeft}s
                                  </span>
                                  <span className="rounded-full bg-neutral-100 px-3 py-1">
                                    Session left: {Math.floor(sessionTimeLeft / 60)}m {sessionTimeLeft % 60}s
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => (isAnswerRecording ? stopAnswerRecording() : startAnswerRecording())}
                                    disabled={isAnalyzing}
                                    className={`rounded-full px-4 py-2 text-sm font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                      isAnswerRecording ? "bg-red-500 hover:bg-red-600" : "bg-neutral-900 hover:bg-neutral-800"
                                    }`}
                                  >
                                    {isAnswerRecording ? "Stop recording" : "Start recording"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      void moveToNextCard();
                                    }}
                                    disabled={isAnalyzing}
                                    className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isAnalyzing ? "Analyzing..." : "Next question"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {!isTtsSupported && (
                        <div className="text-xs text-amber-600">This browser does not support Text-to-Speech yet. Try Chrome/Edge desktop.</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

            <div
              className="mt-4 flex items-center justify-between gap-3 pt-4"
              style={{ display: activeStep === 5 && isSpeakingSessionActive ? "none" : "flex" }}
            >
              <button
                type="button"
                onClick={prevStep}
                disabled={activeStep === 0}
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>

              <button
                type="button"
                onClick={activeStep === WIZARD_STEPS.length - 1 ? startSpeaking : nextStep}
                className="rounded-full px-5 py-2 text-sm font-medium text-white shadow-sm transition-transform duration-200 hover:-translate-y-[1px]"
                style={{
                  backgroundImage: "linear-gradient(90deg, var(--primary) 0%, var(--secondary) 55%, var(--accent) 100%)",
                }}
              >
                {activeStep === WIZARD_STEPS.length - 1 ? "Start speaking now" : "Next"}
              </button>
            </div>
        </div>
      </section>
      <style jsx global>{`
        @keyframes lexaFadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .lexa-fade-slide-in {
          animation: lexaFadeSlideIn 320ms ease-out both;
        }
      `}</style>
    </main>
  );
}
