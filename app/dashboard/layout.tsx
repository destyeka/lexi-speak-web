"use client";

import { Suspense } from "react";
import type { ReactNode } from "react";
import "./global.css";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { useSidebar } from "@/context/SidebarContext";

function DashboardShell({ children }: { children: ReactNode }) {
	const { isExpanded, isHovered } = useSidebar();
	const contentShiftClass = isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]";

	return (
		<div className="min-h-screen xl:flex">
			<Suspense fallback={null}>
				<AppSidebar />
			</Suspense>
			<Backdrop />
			<div className={`flex-1 transition-all duration-300 ease-in-out ${contentShiftClass}`}>
				<AppHeader />
				<div className="mx-auto w-full max-w-[1600px] p-4 md:p-6">{children}</div>
			</div>
		</div>
	);
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
	return (
		<ThemeProvider>
			<SidebarProvider>
				<DashboardShell>{children}</DashboardShell>
			</SidebarProvider>
		</ThemeProvider>
	);
}
