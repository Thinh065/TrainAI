"use client";

import { LogOut } from "lucide-react";
import { useChatApp } from "@/context/ChatAppContext";
import { signOutApi } from "@/lib/api-client";
import { cn, initials } from "@/lib/utils";

interface UserProfileProps {
  collapsed?: boolean;
}

export function UserProfile({ collapsed }: UserProfileProps) {
  const { user } = useChatApp();

  async function signOut() {
    await signOutApi();
    window.location.assign("/login");
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 py-3 pl-4 pr-2",
        collapsed && "md:flex-col md:gap-2 md:px-0",
      )}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-active text-xs font-semibold text-ink"
        aria-hidden="true"
        title={user ? `${user.name} · ${user.email}` : undefined}
      >
        {user ? initials(user.name) : ""}
      </div>
      <div className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
        {user ? (
          <>
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </>
        ) : (
          <div className="space-y-1.5" aria-hidden="true">
            <div className="h-3.5 w-28 rounded bg-active" />
            <div className="h-3 w-36 rounded bg-raised" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={signOut}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-active hover:text-ink"
        aria-label="Đăng xuất"
        title="Đăng xuất"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
