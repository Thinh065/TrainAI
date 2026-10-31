"use client";

import { useRef } from "react";
import { useChatApp } from "@/context/ChatAppContext";

/** A hidden file input plus a function that opens it; every chosen PDF is uploaded. */
export function usePdfPicker() {
  const { uploadPdf } = useChatApp();
  const inputRef = useRef<HTMLInputElement>(null);

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf,.pdf"
      multiple
      hidden
      onChange={(e) => {
        Array.from(e.target.files ?? []).forEach((file) => uploadPdf(file));
        e.target.value = "";
      }}
    />
  );

  return { openPicker: () => inputRef.current?.click(), input };
}
