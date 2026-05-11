"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RoleOverviewPanel from "../_components/RoleOverviewPanel";

function UserDashboardContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "dashboard";

  if (tab === "learn") {
    return (
      <RoleOverviewPanel
        expectedRole="user"
        title="Learn - Practice Speaking"
        description="Practice speaking freely. Ada 2 unit, masing-masing berisi 3 part. Selesaikan dengan pace kamu sendiri. Progress disimpan otomatis setiap selesai 1 part."
        tab="learn"
      />
    );
  }

  if (tab === "test") {
    return (
      <RoleOverviewPanel
        expectedRole="user"
        title="Test - Evaluasi dengan Coach"
        description="Official test berbasis rubric IELTS. Coach akan mengevaluasi speaking kamu di sesi test ini. Pastikan kamu sudah terhubung dengan coach sebelum mulai."
        tab="test"
      />
    );
  }

  return (
    <RoleOverviewPanel
      expectedRole="user"
      title="Student Dashboard"
      description="Student hub berbasis unit card. Ada 2 unit, masing-masing berisi 3 part, dengan progress bar di dalam kartu dan coach hanya aktif saat test dimulai."
    />
  );
}

export default function UserDashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UserDashboardContent />
    </Suspense>
  );
}