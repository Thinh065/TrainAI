import { cn } from "@/lib/utils";

/** A page with a folded corner; one line marked in the citation hue. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("h-6 w-6 shrink-0", className)}
    >
      <path
        d="M5 2.75h9.25L19.25 7.75V21.25H5z"
        fill="var(--surface)"
        stroke="var(--text)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 2.75v5.25h5.25"
        fill="none"
        stroke="var(--text)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 12h8" stroke="var(--text)" strokeWidth="1.5" />
      <path d="M8 15.25h8" stroke="var(--cite)" strokeWidth="2" />
      <path d="M8 18.5h5" stroke="var(--text)" strokeWidth="1.5" />
    </svg>
  );
}
