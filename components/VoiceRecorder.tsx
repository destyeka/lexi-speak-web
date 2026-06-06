"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface VoiceRecorderProps {
  onRecordingComplete?: (url: string) => void;
}

export default function VoiceRecorder({
  onRecordingComplete,
}: VoiceRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: "audio/webm",
        });

        await uploadAudio(blob);
      };

      recorder.start();

      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (error) {
      console.error(error);
      alert("Gagal mengakses microphone");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();

    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    setIsRecording(false);
  };

  const uploadAudio = async (audioBlob: Blob) => {
    try {
      setIsUploading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const filePath = `${user?.id ?? "guest"}/${Date.now()}.webm`;

      const { error } = await supabase.storage
        .from("SPEAKING-AUDIOS")
        .upload(filePath, audioBlob, {
          contentType: "audio/webm",
          upsert: false,
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from("SPEAKING-AUDIOS")
        .getPublicUrl(filePath);

      console.log("Audio uploaded:", data.publicUrl);

      onRecordingComplete?.(data.publicUrl);
    } catch (error) {
      console.error(error);
      alert("Upload gagal");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!isRecording ? (
        <button
          type="button"
          onClick={startRecording}
          disabled={isUploading}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          🎤 Start Recording
        </button>
      ) : (
        <button
          type="button"
          onClick={stopRecording}
          className="bg-black text-white px-4 py-2 rounded"
        >
          ⏹ Stop Recording
        </button>
      )}

      {isUploading && (
        <p>Uploading audio to Supabase...</p>
      )}
    </div>
  );
}