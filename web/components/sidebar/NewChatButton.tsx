"use client";

import { SquarePen } from "lucide-react";
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
      title="New Chat"
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-surface-border/80 bg-surface-elevated/40 px-3 py-2.5 text-sm font-medium text-zinc-100 transition-all hover:border-accent/40 hover:bg-surface-hover hover:shadow-sm active:scale-[0.98]",
        collapsed && "justify-center px-2",
      )}
    >
      <SquarePen className="h-4 w-4 shrink-0 text-accent" />
      {!collapsed && <span>New Chat</span>}
    </button>
  );
}
