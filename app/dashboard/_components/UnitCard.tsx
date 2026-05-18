import React from "react";

type UnitCardProps = {
  id?: string;
  subtitle?: string;
  title: string;
  topic?: string;
  progress?: number; // 0-100
  status?: string;
  price?: number | string;
  onStart?: () => void;
  accent?: string;
  partsCount?: number;
  coreFocus?: boolean;
  score?: number | string | null;
  scoreLabel?: string;
};

export default function UnitCard({
  subtitle = "",
  title,
  topic = "",
  progress = 0,
  status = "Active",
  price,
  onStart,
  accent,
  partsCount,
  coreFocus = false,
  score,
  scoreLabel = "Final score",
}: UnitCardProps) {
  const hasScore = score !== null && score !== undefined && score !== "";

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onStart) onStart();
      }}
      onClick={() => onStart?.()}
      className="group relative cursor-pointer overflow-hidden rounded-[24px] border border-gray-200 bg-gradient-to-br from-white via-white to-rose-50/50 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_18px_40px_rgba(15,23,42,0.16)] focus:outline-none focus:ring-2 focus:ring-primary/20"
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />

      {/* Header with title and icon */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex-1">
          {subtitle ? (
            <span className="mb-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {subtitle}
            </span>
          ) : null}
          <h3 className="mb-1 text-2xl font-bold text-gray-900 leading-tight">{title}</h3>
          <p className="text-sm text-gray-600">{topic}</p>
          {price !== undefined && (
            <div className="mt-3">
              <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-700">
                {typeof price === 'number'
                  ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price)
                  : price}
              </span>
            </div>
          )}
        </div>

        {/* parts badge */}
        <div className="flex flex-col items-end">
          {typeof partsCount === 'number' ? (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r ${accent ?? 'from-primary to-rose-400'}`}>
              {partsCount} Parts
            </span>
          ) : null}
          {hasScore ? (
            <span className="mt-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-100">
              {scoreLabel}: {typeof score === 'number' ? score.toFixed(1) : score}
            </span>
          ) : null}
          {coreFocus ? <span className="mt-2 text-xs font-medium text-amber-600">Core focus</span> : null}
        </div>
      </div>

      {/* Status and label row */}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          {status}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div className={`h-full rounded-full ${accent ? `bg-gradient-to-r ${accent}` : 'bg-gradient-to-r from-primary to-rose-400'}`} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {Math.round(progress)}% complete
        </div>
      </div>

      {/* Start Now button */}
      <div className="mt-5 flex justify-end">
        <button
          onClick={(e) => { e.stopPropagation(); onStart?.(); }}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          Start Now
        </button>
      </div>
    </div>
  );
}
