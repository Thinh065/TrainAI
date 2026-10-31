"use client";

import { useChatApp } from "@/context/ChatAppContext";
import { cn, initials } from "@/lib/utils";

interface UserProfileProps {
  collapsed?: boolean;
}

export function UserProfile({ collapsed }: UserProfileProps) {
  const { user } = useChatApp();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 px-4 py-3",
        collapsed && "md:justify-center md:px-0",
      )}
      title={user ? `${user.name} · ${user.email}` : undefined}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-active text-xs font-semibold text-ink"
        aria-hidden="true"
      >
        {user ? initials(user.name) : ""}
      </div>
      <div className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
        {user ? (
          <>
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">Tài khoản trên máy này</p>
          </>
        ) : (
          <div className="space-y-1.5" aria-hidden="true">
            <div className="h-3.5 w-28 rounded bg-active" />
            <div className="h-3 w-36 rounded bg-raised" />
          </div>
        )}
      </div>
    </div>
  );
}
