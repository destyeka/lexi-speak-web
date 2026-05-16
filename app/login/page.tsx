"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type AppRole = "user" | "guru" | "admin";

type Notice = {
  kind: "success" | "error";
  title: string;
  description: string;
} | null;

const mapLoginErrorMessage = (rawMessage: string) => {
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return [
      "Email atau password tidak cocok.",
      "Jika email hanya diubah dari panel admin/profiles, akun auth belum ikut berubah.",
      "Pastikan akun coach benar-benar dibuat lewat Sign Up (atau diundang via Supabase Auth), lalu login pakai email auth tersebut.",
    ].join(" ");
  }

  if (normalized.includes("email not confirmed")) {
    return "Email belum terverifikasi. Buka email verifikasi dulu, lalu coba login lagi.";
  }

  return rawMessage;
};

const getDashboardPathForRole = (role: AppRole) => {
  if (role === "admin") return "/dashboard/admin";
  if (role === "guru") return "/dashboard/coach";
  if (role === "user") return "/dashboard/user";
  return "/learn";
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // When returning from external OAuth pages, force-refresh if page came from bfcache.
      if (event.persisted) {
        window.location.reload();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setIsSubmitting(false);

    if (error) {
      setNotice({
        kind: "error",
        title: "Login failed",
        description: mapLoginErrorMessage(error.message),
      });
      return;
    }

    setNotice({
      kind: "success",
      title: "Login successful",
      description: "You will be redirected to your dashboard now.",
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };

    const role = (profile?.role as AppRole | undefined) ?? (user?.user_metadata?.role as AppRole | undefined) ?? "user";

    setTimeout(() => {
      window.location.href = getDashboardPathForRole(role);
    }, 900);
  };

  const handleGoogleLogin = async () => {
    setNotice(null);
    setIsGoogleSubmitting(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      setIsGoogleSubmitting(false);
      setNotice({
        kind: "error",
        title: "Google login failed",
        description: error.message,
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-[url('https://cdn.flyonui.com/fy-assets/blocks/marketing-ui/auth/auth-background-2.png')] bg-cover bg-center bg-no-repeat px-4 py-10">
      <div className="relative w-full max-w-xl">
        <div className="mb-5 rounded-3xl border border-white/70 bg-white/75 p-5 shadow-xl backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Built for IELTS speaking practice</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">Build Speaking Skills That Shape Your Future</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            Practice IELTS speaking with guided onboarding, topic-based Part 1 cards, time-boxed sessions, and rubric-aligned feedback.
          </p>
        </div>

        <svg
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full scale-110 opacity-70"
          viewBox="0 0 612 697"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M360.405 111.996C393.955 67.9448 456.863 59.4318 500.914 92.9818V92.9818C544.965 126.532 553.478 189.44 519.928 233.491L250.545 587.191C216.995 631.243 154.087 639.756 110.036 606.206V606.206C65.9845 572.656 57.4716 509.747 91.0216 465.696L360.405 111.996Z"
            fill="url(#paint0_linear_login)"
            fillOpacity="0.08"
          />
          <path
            d="M519.53 233.188L250.147 586.888C216.765 630.72 154.17 639.19 110.339 605.808C66.5071 572.425 58.0367 509.831 91.4194 465.999L360.802 112.299C394.185 68.4674 456.78 59.9969 500.611 93.3796C544.443 126.762 552.913 189.357 519.53 233.188Z"
            stroke="var(--color-primary)"
            strokeOpacity="0.2"
          />
          <defs>
            <linearGradient
              id="paint0_linear_login"
              x1="500.914"
              y1="92.9818"
              x2="110.036"
              y2="606.206"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="var(--color-primary)" />
              <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0.2" />
            </linearGradient>
          </defs>
        </svg>

        <div className="rounded-2xl border border-white/70 bg-white/95 p-6 shadow-xl backdrop-blur-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <img src="/logo.png" className="size-8" alt="brand-logo" />
            <h2 className="text-xl font-bold text-slate-900">LexiSpeak</h2>
          </div>

          <div className="mb-5 space-y-1">
            <h3 className="text-3xl font-semibold text-slate-900">Sign in</h3>
            <p className="text-slate-600">Ship Faster and Focus on Growth.</p>
          </div>

          {notice && (
            <Alert
              className={`mb-4 ${
                notice.kind === "error"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              }`}
            >
              {notice.kind === "error" ? <AlertCircleIcon /> : <CheckCircle2Icon />}
              <AlertTitle>{notice.title}</AlertTitle>
              <AlertDescription>{notice.description}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800" htmlFor="userEmail">
                Email address*
              </label>
              <input
                type="email"
                placeholder="Enter your email address"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                id="userEmail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800" htmlFor="userPassword">
                Password*
              </label>
              <div className="relative">
                <input
                  id="userPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="************"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 px-2 text-slate-300 hover:text-slate-500"
                  aria-label="toggle password"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300 accent-[var(--color-primary)]"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember Me
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="brand-pill-button w-full py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleSubmitting}
              className="auth-secondary-button w-full py-2.5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGoogleSubmitting ? "Redirecting to Google..." : "Continue with Google"}
            </button>
          </form>

          <p className="mt-5 text-center text-slate-600">
            New on our platform?{" "}
            <Link href="/register" className="text-primary underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}