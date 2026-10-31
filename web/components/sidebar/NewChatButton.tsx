"use client";

import { Plus } from "lucide-react";
import { useChatApp } from "@/context/ChatAppContext";
import { cn } from "@/lib/utils";

interface NewChatButtonProps {
  collapsed?: boolean;
}

export function NewChatButton({ collapsed }: NewChatButtonProps) {
  const { createNewChat } = useChatApp();

  return (
    <button
      type="button"
      onClick={createNewChat}
      title="Cuộc trò chuyện mới"
      aria-label="Cuộc trò chuyện mới"
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-control bg-primary px-3 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover active:translate-y-px",
        collapsed && "md:w-10 md:justify-center md:px-0",
      )}
    >
      <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className={cn(collapsed && "md:hidden")}>Cuộc trò chuyện mới</span>
    </button>
  );
}
