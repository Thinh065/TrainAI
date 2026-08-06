"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NewChatButton } from "@/components/sidebar/NewChatButton";
import { PDFUpload } from "@/components/sidebar/PDFUpload";
import { PDFList } from "@/components/sidebar/PDFList";
import { ChatHistory } from "@/components/sidebar/ChatHistory";
import { UserProfile } from "@/components/sidebar/UserProfile";
import { useChatApp } from "@/context/ChatAppContext";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useChatApp();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-surface-border bg-surface-sidebar shadow-drawer md:shadow-none",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b border-surface-border/60 p-2",
          sidebarCollapsed ? "justify-center" : "justify-between px-3",
        )}
      >
        {!sidebarCollapsed && (
          <span className="truncate text-sm font-semibold tracking-tight text-zinc-200">
            TrainAI
          </span>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden rounded-lg p-2 text-zinc-400 transition-colors hover:bg-surface-hover hover:text-zinc-100 md:inline-flex"
          aria-label={sidebarCollapsed ? "Mở sidebar" : "Thu gọn sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className={cn("shrink-0 space-y-1 p-2", sidebarCollapsed && "px-1.5")}>
          <NewChatButton collapsed={sidebarCollapsed} />
          {!sidebarCollapsed && (
            <>
              <PDFUpload />
              <PDFList />
            </>
          )}
        </div>

        {!sidebarCollapsed && (
          <div className="min-h-0 flex-1 overflow-hidden border-t border-surface-border/60">
            <ChatHistory />
          </div>
        )}

        <UserProfile collapsed={sidebarCollapsed} />
      </div>
    </aside>
  );
}
