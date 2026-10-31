"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { DocumentsPanel } from "@/components/documents/DocumentsPanel";
import { useChatApp } from "@/context/ChatAppContext";
import { cn } from "@/lib/utils";

export function AppShell() {
  const {
    mobileSidebarOpen,
    setMobileSidebarOpen,
    sidebarCollapsed,
    docsOpen,
    setDocsOpen,
  } = useChatApp();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setMobileSidebarOpen(false);
      setDocsOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setMobileSidebarOpen, setDocsOpen]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-ground text-ink">
      {(mobileSidebarOpen || docsOpen) && (
        <button
          type="button"
          aria-label="Đóng bảng"
          className={cn(
            "fixed inset-0 z-40 bg-black/40",
            !docsOpen && "md:hidden",
            docsOpen && !mobileSidebarOpen && "xl:hidden",
          )}
          onClick={() => {
            setMobileSidebarOpen(false);
            setDocsOpen(false);
          }}
        />
      )}

      <Sidebar
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(288px,86vw)] md:relative md:z-auto",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          mobileSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0",
          sidebarCollapsed ? "md:w-14" : "md:w-64",
        )}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-surface md:my-2 md:mr-2 md:rounded-card md:border md:border-line xl:mr-0">
        <ChatArea />
      </main>

      <DocumentsPanel
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-[min(340px,92vw)] xl:relative xl:z-auto xl:w-80",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          docsOpen ? "translate-x-0 shadow-float xl:shadow-none" : "translate-x-full xl:translate-x-0",
        )}
      />
    </div>
  );
}
