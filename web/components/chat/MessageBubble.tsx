"use client";

import { useState, useCallback, type ComponentPropsWithoutRef, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Bot, Check, Copy, User } from "lucide-react";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
}

function CodeBlock({
  className,
  children,
}: ComponentPropsWithoutRef<"code">) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const codeString = String(children).replace(/\n$/, "");

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(codeString);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [codeString]);

  if (match) {
    return (
      <div className="group/code relative my-3 overflow-hidden rounded-xl border border-surface-border bg-[#1e1e1e]">
        <div className="flex items-center justify-between border-b border-surface-border/80 px-3 py-1.5 text-xs text-zinc-500">
          <span>{match[1]}</span>
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1 rounded px-2 py-0.5 transition-colors hover:bg-surface-hover hover:text-zinc-200"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Đã copy
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
        <SyntaxHighlighter
          style={
            oneDark as unknown as { [key: string]: CSSProperties }
          }
          language={match[1]}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent",
            fontSize: "0.8125rem",
          }}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code
      className="rounded bg-surface-input px-1.5 py-0.5 text-[0.85em] text-emerald-300/90"
    >
      {children}
    </code>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <article
      className={cn(
        "flex gap-3 px-2 py-4",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isUser ? "bg-surface-elevated" : "bg-accent-muted",
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-zinc-300" />
        ) : (
          <Bot className="h-4 w-4 text-accent" />
        )}
      </div>

      <div
        className={cn(
          "min-w-0 max-w-[85%] text-sm leading-relaxed md:max-w-[80%]",
          isUser && "text-right",
        )}
      >
        {isUser ? (
          <div className="inline-block rounded-2xl rounded-tr-md bg-surface-elevated px-4 py-2.5 text-left text-zinc-100">
            {message.content}
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-p:text-zinc-300 prose-headings:text-zinc-100 prose-a:text-accent prose-strong:text-zinc-100 prose-li:text-zinc-300 prose-table:text-zinc-300">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeBlock,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </article>
  );
}
