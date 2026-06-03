"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useProfileStore } from "@/hooks/useProfileStore";

type ProfileLite = {
  email: string;
  role: "user" | "guru" | "admin";
};

const menuItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "User", href: "/dashboard/user" },
  { label: "Guru", href: "/dashboard/guru" },
  { label: "Admin", href: "/dashboard/admin" },
  { label: "Role Management", href: "/dashboard/admin" },
];

export default function DashboardFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileLite | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("email, role")
        .eq("id", user.id)
        .single();

      setProfile((data as ProfileLite | null) ?? { email: user.email ?? "Unknown", role: "user" });
    };

    void loadProfile();
  }, [router]);

  const resetProfile = useProfileStore((state) => state.resetProfile);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    resetProfile();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div
        className={`fixed inset-0 z-30 bg-black/35 transition lg:hidden ${
          isSidebarOpen ? "block" : "hidden"
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-[280px] border-r border-gray-200 bg-white px-4 py-6 transition-transform dark:border-gray-800 dark:bg-gray-900 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="h-9 w-9 rounded-lg bg-brand-500/15" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Lexa Speak</p>
            <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Admin Panel</h2>
          </div>
        </div>

        <nav>
          <p className="px-2 pb-3 text-xs uppercase tracking-wide text-gray-400">Menu</p>
          <ul className="space-y-1.5">
            {menuItems.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={`${item.label}-${item.href}`}>
                  <Link
                    href={item.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="lg:ml-[280px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300 lg:hidden"
            aria-label="Toggle menu"
          >
            <span className="text-lg">=</span>
          </button>

          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-gray-400">{profile?.role ?? "user"}</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">{profile?.email ?? "Loading..."}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
