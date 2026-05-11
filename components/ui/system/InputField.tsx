"use client";

import { TextInput } from "./TextInput";
import { useEffect, useRef } from "react";

type InputFieldProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;

  multiline?: boolean;
  rows?: number;
};

export function InputField({
  value,
  onChange,
  placeholder = "Type here...",
  className = "",

  multiline = false,
  rows = 4,
}: InputFieldProps) {
  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  useEffect(() => {

    if (!multiline) return;

    const textarea =
      textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";

    textarea.style.height =
      `${textarea.scrollHeight}px`;

  }, [value, multiline]);

  return (
    <div
      className={`
        p-3 flex flex-col bg-tertiary rounded-2xl
        shadow-[1px_2px_12px_0px_rgba(217,217,217,0.50)]
        outline outline-dashed outline-offset-1 outline-[var(--primary)]
        text-primary gap-2
        ${className}
      `}
    >
      {multiline ? (
        <textarea
          ref={textareaRef}
          rows={rows}
          value={value}
          onInput={(e) => {
            const target =
              e.target as HTMLTextAreaElement;

            target.style.height = "auto";
            target.style.height =
              `${target.scrollHeight}px`;
          }}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="
    w-full bg-transparent outline-none
    resize-none text-primary text-base font-medium
    placeholder:text-primary/50
    overflow-hidden
  "
        />
      ) : (
        <TextInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}