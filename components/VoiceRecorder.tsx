"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase"; 

interface VoiceRecorderProps {
  onUploadSuccess: (url: string) => void; 
}

export default function VoiceRecorder({ onUploadSuccess }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 🎤 1. Fungsi Mulai Rekam Suara
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 🌟 SOLUSI 1: Tentukan mimeType yang didukung browser secara dinamis
      let options = { mimeType: "audio/webm" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        // Fallback jika di iOS/Safari jadul yang condong ke mp4 audio
        options = { mimeType: "audio/mp4" }; 
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // 🌟 SOLUSI 2: Bungkus sesuai dengan mimeType aslinya perekam
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        
        // Kirim data ke Supabase Storage
        await uploadAudioToBucket(audioBlob, mediaRecorder.mimeType);
        
        // Matikan mic hardware SETELAH blob dibuat
        stream.getTracks().forEach((track) => track.stop());
      };

      // Rekam data per 200ms biar data chunks-nya mengalir stabil
      mediaRecorder.start(200); 
      setIsRecording(true);
    } catch (err) {
      alert("Gagal mengakses Microphone. Pastikan lu udah izinin mic di browser!");
      console.error(err);
    }
  };

  // ⏹️ 2. Fungsi Berhenti Rekam
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // 📤 3. Fungsi Upload ke Supabase Storage
  const uploadAudioToBucket = async (audioBlob: Blob, mimeType: string) => {
    if (audioBlob.size === 0) {
      alert("Gagal: Data suara kosong atau tidak terekam.");
      return;
    }

    setUploading(true);
    try {
      // Tentukan ekstensi file berdasarkan mimeType aslinya
      const extension = mimeType.includes("mp4") ? "mp4" : "webm";
      const fileName = `audio_attempt_${Date.now()}.${extension}`;

      // Upload ke bucket 'speaking-audios'
      const { data, error } = await supabase.storage
        .from("speaking-audios")
        .upload(fileName, audioBlob, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) throw error;

      // Ambil link Public URL
      const { data: urlData } = supabase.storage
        .from("speaking-audios")
        .getPublicUrl(fileName);

      const publicAudioUrl = urlData.publicUrl;
      console.log("Audio berhasil masuk Storage! URL:", publicAudioUrl);
      
      // Kirim URL-nya ke halaman induk (page.tsx) agar masuk database utama
      onUploadSuccess(publicAudioUrl);

    } catch (err: any) {
      console.error(err);
      alert("Gagal mengunggah file suara ke server storage: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-5 text-center dark:border-gray-800 dark:bg-white/[0.01]">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">
        {uploading 
          ? "🔄 Sedang mengunggah rekaman suara ke server..." 
          : isRecording 
            ? "🔴 Mic Aktif! Sedang merekam suara anda..." 
            : "Gunakan Perekam untuk Menjawab Soal Speaking"}
      </p>

      <div className="flex justify-center gap-3">
        {!isRecording ? (
          <button
            type="button"
            disabled={uploading}
            onClick={startRecording}
            className="rounded-xl bg-[#C95B5B] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#b54f4f] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            🎤 Start Record
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="animate-pulse rounded-xl bg-gray-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-black flex items-center gap-1.5 cursor-pointer"
          >
            ⏹️ Stop & Save
          </button>
        )}
      </div>
    </div>
  );
}