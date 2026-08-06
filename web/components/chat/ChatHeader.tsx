"use client";

import { ChevronDown, Menu, PanelLeft } from "lucide-react";
import { useChatApp } from "@/context/ChatAppContext";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

const MODELS = ["TrainAI GPT", "TrainAI Fast", "TrainAI Pro"];

export function ChatHeader() {
  const {
    selectedModel,
    setSelectedModel,
    sidebarCollapsed,
    toggleSidebar,
    setMobileSidebarOpen,
    activeConversation,
  } = useChatApp();
  const [modelOpen, setModelOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-surface-border/50 bg-surface-chat/95 px-3 py-3 backdrop-blur-md md:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-surface-hover hover:text-zinc-100 md:hidden"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Mở menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {sidebarCollapsed && (
          <button
            type="button"
            className="hidden rounded-lg p-2 text-zinc-400 transition-colors hover:bg-surface-hover hover:text-zinc-100 md:inline-flex"
            onClick={toggleSidebar}
            aria-label="Mở sidebar"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-zinc-100 md:text-base">
            TrainAI Chat
          </h1>
          {activeConversation && (
            <p className="truncate text-xs text-zinc-500 md:hidden">
              {activeConversation.title}
            </p>
          )}
        </div>
      </div>

      <div ref={modelRef} className="relative">
        <button
          type="button"
          onClick={() => setModelOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-input px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:border-zinc-500"
        >
          <span className="max-w-[120px] truncate sm:max-w-none">
            {selectedModel}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-zinc-500 transition-transform",
              modelOpen && "rotate-180",
            )}
          />
        </button>
        {modelOpen && (
          <ul className="absolute right-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-surface-border bg-surface-elevated py-1 shadow-xl">
            {MODELS.map((m) => (
              <li key={m}>
                <button
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover",
                    m === selectedModel && "text-accent",
                  )}
                  onClick={() => {
                    setSelectedModel(m);
                    setModelOpen(false);
                  }}
                >
                  {m}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
