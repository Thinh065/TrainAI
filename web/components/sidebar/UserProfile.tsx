"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronUp, LogOut, Settings, User } from "lucide-react";
import { useChatApp } from "@/context/ChatAppContext";
import { cn } from "@/lib/utils";

interface UserProfileProps {
  collapsed?: boolean;
}

export function UserProfile({ collapsed }: UserProfileProps) {
  const { user } = useChatApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(-2)
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative border-t border-surface-border/60 p-2">
      {open && !collapsed && (
        <div className="absolute bottom-full left-2 right-2 mb-2 overflow-hidden rounded-xl border border-surface-border bg-surface-elevated py-1 shadow-xl">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-hover"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4 text-zinc-400" />
            Profile
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-hover"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4 text-zinc-400" />
            Settings
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-surface-hover"
            onClick={() => setOpen(false)}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-hover",
          collapsed && "justify-center",
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-muted text-sm font-semibold text-accent">
          {initials}
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-zinc-100">
                {user.name}
              </p>
              <p className="truncate text-xs text-zinc-500">User</p>
            </div>
            <ChevronUp
              className={cn(
                "h-4 w-4 text-zinc-500 transition-transform",
                open && "rotate-180",
              )}
            />
          </>
        )}
      </button>
    </div>
  );
}
