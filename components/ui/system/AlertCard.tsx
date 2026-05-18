"use client";

import { ElementType } from "react";

type AlertCardProps = {
  icon?: ElementType;
  iconWeight?: "regular" | "fill";
  title?: string;
  description?: string;
  variant?: "success" | "warning" | "error" | "text";
  className?: string;
};

export function AlertCard({
  icon: Icon,
  iconWeight,
  title,
  description,
  variant = "success",
  className = "",
}: AlertCardProps) {
  const base =
    "p-4 rounded-2xl shadow-[1px_2px_12px_0px_rgba(217,217,217,0.50)] border border-gray-200 dark:border-gray-800 inline-flex gap-3 bg-white dark:bg-gray-900";

  const variants = {
    success:
      "success outline-[var(--color-success-text)]",
    warning:
      "warning outline-[var(--color-warning-text)]",
    error:
      "error outline-[var(--color-error-text)]",
    text:
      "text-[var(--color-text)] bg-[var(--text-tertiary)] outline-[var(--color-text)]",
  };

  const isSingle = !!title !== !!description;

  return (
    <div className={`${base} ${variants[variant]} ${isSingle ? "items-center" : "items-start"} ${className}`}>
      {Icon && <Icon size={24} weight={iconWeight || "fill"} />}

      <div className="flex-1 flex flex-col gap-1">
        <span className="text-base font-bold">
          {title}
        </span>

        {description && (
          <span className="text-base font-medium">
            {description}
          </span>
        )}
      </div>
    </div>
  );
}