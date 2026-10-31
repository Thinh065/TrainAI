"use client";

import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Mark } from "@/components/brand/Mark";
import { NewChatButton } from "@/components/sidebar/NewChatButton";
import { ChatHistory } from "@/components/sidebar/ChatHistory";
import { UserProfile } from "@/components/sidebar/UserProfile";
import { useChatApp } from "@/context/ChatAppContext";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
}

const iconButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-control text-muted transition-colors hover:bg-active hover:text-ink";

export function Sidebar({ className }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar, setMobileSidebarOpen } =
    useChatApp();

  return (
    <aside
      aria-label="Cuộc trò chuyện"
      className={cn("flex h-full flex-col bg-ground", className)}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 px-3",
          sidebarCollapsed && "md:justify-center md:px-0",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 pl-1",
            sidebarCollapsed && "md:hidden",
          )}
        >
          <Mark />
          <span className="text-[15px] font-semibold">TrainAI</span>
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(iconButton, "hidden md:inline-flex")}
          aria-label={sidebarCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          title={sidebarCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          ) : (
            <PanelLeftClose className="h-[18px] w-[18px]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className={cn(iconButton, "md:hidden")}
          aria-label="Đóng thanh bên"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className={cn("px-3 pb-3", sidebarCollapsed && "md:px-2")}>
        <NewChatButton collapsed={sidebarCollapsed} />
      </div>

      <div
        className={cn(
          "min-h-0 flex-1",
          sidebarCollapsed && "md:invisible",
        )}
      >
        <ChatHistory />
      </div>

      <UserProfile collapsed={sidebarCollapsed} />
    </aside>
  );
}
