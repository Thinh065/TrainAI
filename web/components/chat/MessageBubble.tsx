"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import { ConsistencyReport } from "@/components/chat/ConsistencyReport";
import { useChatApp } from "@/context/ChatAppContext";
import type { Message, Source } from "@/lib/types";
import { displayFileName } from "@/lib/utils";

// Only the languages answers realistically contain; the full Prism bundle tripled the page size.
for (const [name, lang] of Object.entries({
  bash,
  javascript,
  json,
  python,
  sql,
  typescript,
})) {
  SyntaxHighlighter.registerLanguage(name, lang);
}
SyntaxHighlighter.registerLanguage("js", javascript);
SyntaxHighlighter.registerLanguage("ts", typescript);
SyntaxHighlighter.registerLanguage("py", python);
SyntaxHighlighter.registerLanguage("sh", bash);

function usePrefersDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return dark;
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (http, permissions); nothing else to do.
    }
  }, [text]);
  return { copied, copy };
}

function CodeBlock({ className, children }: ComponentPropsWithoutRef<"code">) {
  const match = /language-([\w+-]+)/.exec(className || "");
  const codeString = String(children).replace(/\n$/, "");
  const { copied, copy } = useCopy(codeString);
  const dark = usePrefersDark();

  // Inline code; fenced blocks without a language also land here and stay readable.
  if (!match && !codeString.includes("\n")) {
    return <code>{children}</code>;
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-raised">
      <div className="flex h-9 items-center justify-between pl-3 pr-1.5 text-xs text-muted">
        <span>{match?.[1] ?? "text"}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-7 items-center gap-1.5 rounded px-2 hover:bg-active hover:text-ink"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Đã chép" : "Chép"}
        </button>
      </div>
      <SyntaxHighlighter
        style={(dark ? oneDark : oneLight) as { [key: string]: CSSProperties }}
        language={match?.[1] ?? "text"}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "12px 14px 14px",
          background: "transparent",
          fontSize: "13px",
          lineHeight: "20px",
        }}
        codeTagProps={{ style: { fontFamily: "var(--font-mono), monospace" } }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}

const markdownComponents: Components = {
  code: CodeBlock,
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
};

const LATEX_SYMBOLS: Record<string, string> = {
  times: "×",
  div: "÷",
  cdot: "·",
  approx: "≈",
  le: "≤",
  ge: "≥",
  neq: "≠",
  pm: "±",
};

/** "$1.650.000 \times 9$" -> "1.650.000 × 9". Only spans holding a LaTeX command, so "$5" stays. */
export function plainMath(text: string): string {
  return text.replace(/\$\$?([^$\n]*\\[a-zA-Z]+[^$\n]*)\$\$?/g, (_, inner: string) =>
    inner
      .replace(/\\([a-zA-Z]+)/g, (cmd: string, name: string) => LATEX_SYMBOLS[name] ?? cmd)
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function Sources({ sources }: { sources: Source[] }) {
  const { showSource } = useChatApp();
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-muted">Nguồn</span>
      {sources.map((s) => (
        <button
          key={`${s.fileId}-${s.pageNumber}`}
          type="button"
          onClick={() => showSource(s.fileId)}
          title={`${s.fileName}, trang ${s.pageNumber}`}
          className="inline-flex h-7 max-w-full items-center gap-1 rounded-control bg-cite-soft px-2 text-xs text-cite transition-colors hover:underline"
        >
          <span className="max-w-[180px] truncate">
            {displayFileName(s.fileName)}
          </span>
          <span className="shrink-0 font-semibold tabular-nums">
            tr. {s.pageNumber}
          </span>
        </button>
      ))}
    </div>
  );
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const { copied, copy } = useCopy(message.content);

  if (isUser) {
    return (
      <article className="flex justify-end" aria-label="Câu hỏi của bạn">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-card bg-raised px-4 py-2.5 text-[15px] leading-6 md:max-w-[75%]">
          {message.content}
        </div>
      </article>
    );
  }

  if (message.report) {
    return (
      <article aria-label="Kết quả kiểm tra của TrainAI">
        <ConsistencyReport report={message.report} />
      </article>
    );
  }

  return (
    <article className="group" aria-label="Câu trả lời của TrainAI">
      <div className="answer">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {plainMath(message.content)}
        </ReactMarkdown>
      </div>
      {message.sources && message.sources.length > 0 && (
        <Sources sources={message.sources} />
      )}
      <button
        type="button"
        onClick={copy}
        className="mt-2 inline-flex h-7 items-center gap-1.5 rounded px-1.5 text-xs text-muted opacity-0 transition-opacity hover:bg-raised hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Đã chép" : "Chép câu trả lời"}
      </button>
    </article>
  );
}
