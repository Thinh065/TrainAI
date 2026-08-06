"use client";

import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { useChatApp } from "@/context/ChatAppContext";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { mobileSidebarOpen, setMobileSidebarOpen, sidebarCollapsed } =
    useChatApp();

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-surface-chat text-zinc-100">
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Đóng sidebar"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        className={cn(
          "fixed inset-y-0 left-0 z-50 md:relative md:z-auto",
          "transition-transform duration-300 ease-out md:transition-[width]",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          sidebarCollapsed ? "md:w-[52px]" : "md:w-[280px]",
          "w-[min(280px,88vw)]",
        )}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <ChatArea />
      </main>
    </div>
  );
}
