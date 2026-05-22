"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AlertCircleIcon, CheckCircle2Icon, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Notice = {
  kind: "success" | "error";
  title: string;
  description: string;
} | null;

type AppRole = "user" | "guru";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<AppRole>("user");
  const [email, setEmail] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreePolicy, setAgreePolicy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNotice(null);

    if (password !== confirmPassword) {
      setNotice({
        kind: "error",
        title: "Registration failed",
        description: "Password and confirm password do not match.",
      });
      return;
    }

    if (!agreePolicy) {
      setNotice({
        kind: "error",
        title: "Registration failed",
        description: "You must agree to the privacy policy and terms.",
      });
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, role, affiliation },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    setIsSubmitting(false);

    if (error) {
      setNotice({
        kind: "error",
        title: "Registration failed",
        description: error.message,
      });
      return;
    }

    if (!data.user?.id || !data.user?.email) {
      setNotice({
        kind: "error",
        title: "Registration failed",
        description: "User data was not returned from Supabase. Please try again.",
      });
      return;
    }

    // Do not upsert profile from client during sign-up.
    // With email confirmation enabled, there may be no active session yet,
    // so RLS can reject inserts/updates. Profile creation is handled by
    // the auth.users trigger in Supabase (handle_new_user_profile).

    setNotice({
      kind: "success",
      title: "Registration successful",
      description:
        "Your account has been created. Please open the verification email on this same device/browser, then sign in.",
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-[url('https://cdn.flyonui.com/fy-assets/blocks/marketing-ui/auth/auth-background-2.png')] bg-cover bg-center bg-no-repeat px-4 py-10">
      <div className="relative w-full max-w-xl">
        <div className="mb-5 rounded-3xl border border-white/70 bg-white/75 p-5 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="size-10 rounded-full object-cover" alt="LexiSpeak logo" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Built for IELTS speaking practice</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950">Build Speaking Skills That Shape Your Future</h1>
            </div>
          </div>
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
            fill="url(#paint0_linear_register)"
            fillOpacity="0.08"
          />
          <path
            d="M519.53 233.188L250.147 586.888C216.765 630.72 154.17 639.19 110.339 605.808C66.5071 572.425 58.0367 509.831 91.4194 465.999L360.802 112.299C394.185 68.4674 456.78 59.9969 500.611 93.3796C544.443 126.762 552.913 189.357 519.53 233.188Z"
            stroke="var(--color-primary)"
            strokeOpacity="0.2"
          />
          <defs>
            <linearGradient
              id="paint0_linear_register"
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
            <h3 className="text-3xl font-semibold text-slate-900">Sign Up</h3>
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

          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800" htmlFor="userName">
                Username*
              </label>
              <input
                type="text"
                placeholder="Enter your username"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                id="userName"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800" htmlFor="userRole">
                Register as*
              </label>
              <select
                id="userRole"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
              >
                <option value="user">Student</option>
                <option value="guru">Coach</option>
              </select>
              <p className="text-xs text-slate-500">Student accounts use the default user role. Coach accounts are for instructors and trainers.</p>
            </div>

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
              <label className="text-sm font-medium text-slate-800" htmlFor="userAffiliation">
                Affiliation
              </label>
              <input
                type="text"
                placeholder="Enter your Affiliation/Institute/University"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                id="userAffiliation"
                value={affiliation}
                onChange={(e) => setAffiliation(e.target.value)}
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
                  className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                  aria-label="toggle password"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800" htmlFor="userConfirmPassword">
                Confirm Password*
              </label>
              <div className="relative">
                <input
                  id="userConfirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="************"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                  aria-label="toggle confirm password"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300 accent-[var(--color-primary)]"
                checked={agreePolicy}
                onChange={(e) => setAgreePolicy(e.target.checked)}
              />
              <span>
                I agree to <a href="#" className="text-primary underline">privacy policy and terms</a>
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="brand-pill-button w-full py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating account..." : "Sign Up to LexiSpeak"}
            </button>
          </form>

          <p className="mt-5 text-center text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline">
              Sign in instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}