"use client";

import { useRef } from "react";
import { FilePlus2 } from "lucide-react";
import { useChatApp } from "@/context/ChatAppContext";

export function PDFUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadPdf } = useChatApp();

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadPdf(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-surface-hover hover:text-zinc-100"
      >
        <FilePlus2 className="h-4 w-4 shrink-0 text-red-400" />
        <span>Add PDF</span>
      </button>
    </div>
  );
}
