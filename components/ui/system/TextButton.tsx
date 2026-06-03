"use client";

import * as React from "react";

type TextButtonProps = {
    type?: "button" | "submit" | "reset";
    onClick?: () => void;
    variant?: "primary" | "secondary";
    disabled?: boolean;
    className?: string;
    children: React.ReactNode;
};

export default function TextButton({
    type = "button",
    onClick,
    variant = "primary",
    disabled = false,
    className = "",
    children,
}: TextButtonProps) {
    const base =
        "px-6 py-3 rounded-[99px] shadow-[1px_2px_12px_0px_rgba(217,217,217,0.50)] outline outline-1 outline-offset-[-1px] inline-flex justify-center items-center gap-2.5 font-semibold text-base";
    const variants = {
        primary:
            "bg-gradient-to-r from-secondary to-primary text-white outline-white/50 hover:opacity-90 active:opacity-80",

        secondary:
            "bg-white/50 backdrop-blur-sm text-primary outline-white hover:bg-white/80 active:bg-white/90",
    };

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${base} ${variants[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""
                } ${className}`}
        >
            {children}
        </button>
    );
}