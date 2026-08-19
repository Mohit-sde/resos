"use client";

import { ReactNode, useState } from "react";
import { Menu, X, Bell } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function DashboardShell({
  children,
  title,
  subtitle,
  actions,
}: DashboardShellProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile drawer overlay */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className="hidden md:flex md:flex-col">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer - only visible on mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300",
          mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0">
          {/* Mobile menu button - only visible on mobile */}
          <button
            className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          >
            {mobileDrawerOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          {/* Page title */}
          <div className="flex-1 min-w-0">
            {title && (
              <div>
                <h1 className="text-sm font-semibold text-gray-900 truncate">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-xs text-gray-500 truncate">{subtitle}</p>
                )}
              </div>
            )}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {actions}
            <button className="relative p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}