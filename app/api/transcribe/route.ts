import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

// Minimum bytes accepted for transcription. Lowered to allow short-but-valid
// recordings from some browsers/devices. Increase if you observe unreliable results.
const MIN_AUDIO_BYTES = Number(process.env.MIN_AUDIO_BYTES) || 800;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("[transcribe] GROQ_API_KEY is not configured");
      return NextResponse.json({ error: "Server misconfiguration: GROQ API key not set" }, { status: 500 });
    }

    const groq = new Groq({ apiKey });

    const formData = await req.formData();

    const audio = formData.get("audio") as File;

    if (!audio) {
      return NextResponse.json(
        { error: "No audio uploaded" },
        { status: 400 }
      );
    }

    console.info("[transcribe] received audio upload", {
      name: audio.name,
      type: audio.type,
      size: audio.size,
      minBytes: MIN_AUDIO_BYTES,
    });

    if (audio.size < MIN_AUDIO_BYTES) {
      console.warn("[transcribe] audio upload below recommended size", { size: audio.size });
    }

    const transcription = await groq.audio.transcriptions.create({
      file: audio,
      model: "whisper-large-v3",
      language: "en",
      response_format: "json",
    });

    return NextResponse.json({
      text: transcription.text,
    });
  } catch (error) {
    console.error("[transcribe] error", error);

    // Try to extract a useful message for the client without leaking secrets
    let message = "Failed to transcribe audio";
    try {
      if (error instanceof Error && error.message) {
        message = error.message;
      } else if (error && typeof error === "object") {
        message = JSON.stringify(error);
      } else {
        message = String(error);
      }
    } catch (e) {
      // ignore
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}