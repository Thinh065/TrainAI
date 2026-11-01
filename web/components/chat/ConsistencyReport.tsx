"use client";

import { ExternalLink } from "lucide-react";
import type {
  ConsistencyIssue,
  ConsistencyReport as Report,
  IssueSeverity,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITY: Record<IssueSeverity, { label: string; className: string }> = {
  high: { label: "Nghiêm trọng", className: "bg-danger-soft text-danger-ink" },
  medium: { label: "Trung bình", className: "bg-warning-soft text-warning-ink" },
  low: { label: "Nhẹ", className: "bg-raised text-muted" },
};

function verdict(score: number, issues: number): string {
  if (issues === 0) return "Không thấy chỗ nào nói trước sau không khớp";
  if (score >= 85) return "Khá nhất quán, còn vài chỗ cần sửa";
  if (score >= 60) return "Có một số chỗ vênh nhau";
  return "Nhiều chỗ vênh nhau, nên rà lại trước khi thuyết trình";
}

function Issue({ issue, index }: { issue: ConsistencyIssue; index: number }) {
  const severity = SEVERITY[issue.severity];
  return (
    <li className="border-t border-rule py-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="tabular-nums text-faint">{index}.</span>
        <span className={cn("rounded px-1.5 py-0.5 font-medium", severity.className)}>
          {severity.label}
        </span>
        {issue.category && <span className="text-muted">{issue.category}</span>}
      </div>
      <h4 className="mt-1.5 text-[15px] font-semibold leading-6">{issue.title}</h4>

      <dl className="mt-3 space-y-2">
        {issue.locations.map((loc, i) => (
          <div key={`${loc.label}-${i}`} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
            <dt className="shrink-0 pt-0.5 text-xs font-semibold text-cite sm:w-[72px]">
              {loc.label}
            </dt>
            <dd className="min-w-0 flex-1 rounded-control bg-raised px-3 py-2 text-sm leading-5">
              “{loc.quote}”
            </dd>
          </div>
        ))}
      </dl>

      {issue.explanation && (
        <p className="mt-3 text-sm leading-6 text-muted">{issue.explanation}</p>
      )}
      {issue.suggestion && (
        <p className="mt-2 text-sm leading-6">
          <span className="font-semibold">Cách sửa: </span>
          {issue.suggestion}
        </p>
      )}
    </li>
  );
}

export function ConsistencyReport({ report }: { report: Report }) {
  const counts = (["high", "medium", "low"] as const)
    .map((s) => ({ s, n: report.issues.filter((i) => i.severity === s).length }))
    .filter((c) => c.n > 0);

  return (
    <section
      aria-label={`Kết quả kiểm tra độ nhất quán: ${report.title}`}
      className="rounded-card border border-line bg-surface"
    >
      <header className="border-b border-rule p-5">
        <p className="text-xs text-muted">
          {report.source && `${report.source} · `}
          <span className="tabular-nums">
            {report.sectionsWithText}/{report.totalSections}
          </span>{" "}
          phần có chữ
        </p>
        <h3 className="mt-1 text-base font-semibold leading-6">
          {report.url ? (
            <a
              href={report.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-start gap-1.5 hover:underline"
            >
              {report.title}
              <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
            </a>
          ) : (
            report.title
          )}
        </h3>

        <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3">
          <p className="tabular-nums">
            <span className="text-[32px] font-semibold leading-none tracking-[-0.02em]">
              {report.score}
            </span>
            <span className="text-base text-muted">/100</span>
          </p>
          <div className="min-w-0 flex-1 pb-0.5">
            <p className="text-sm font-medium leading-5">
              {verdict(report.score, report.issues.length)}
            </p>
            <div
              className="mt-2 h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-raised"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={report.score}
              aria-label="Điểm nhất quán"
            >
              <div className="h-full rounded-full bg-cite" style={{ width: `${report.score}%` }} />
            </div>
          </div>
        </div>

        {counts.length > 0 && (
          <p className="mt-4 flex flex-wrap gap-1.5 text-xs">
            {counts.map(({ s, n }) => (
              <span key={s} className={cn("rounded px-1.5 py-0.5 font-medium", SEVERITY[s].className)}>
                <span className="tabular-nums">{n}</span> {SEVERITY[s].label.toLowerCase()}
              </span>
            ))}
          </p>
        )}
        {report.summary && (
          <p className="mt-4 text-[15px] leading-6">{report.summary}</p>
        )}
      </header>

      {report.issues.length > 0 && (
        <ol className="p-5">
          {report.issues.map((issue, i) => (
            <Issue key={i} issue={issue} index={i + 1} />
          ))}
        </ol>
      )}

      {report.consistentPoints.length > 0 && (
        <div className="border-t border-rule p-5">
          <h4 className="text-sm font-semibold">Những chỗ bài đã giữ thống nhất</h4>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-muted marker:text-faint">
            {report.consistentPoints.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <footer className="border-t border-rule px-5 py-3 text-xs leading-5 text-faint">
        Điểm = 100, trừ 15 cho mỗi lỗi nghiêm trọng, 7 cho mỗi lỗi trung bình, 3 cho mỗi lỗi nhẹ.
        Chỉ giữ những chỗ trích được nguyên văn trong bài.
        {report.truncated && " Bài quá dài nên phần cuối chưa được đọc."}
      </footer>
    </section>
  );
}
