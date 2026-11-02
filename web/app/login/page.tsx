"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Mark } from "@/components/brand/Mark";
import { signInApi, signUpApi } from "@/lib/api-client";
import { cn, errorMessage } from "@/lib/utils";

type Mode = "signin" | "signup";

const field =
  "h-11 w-full rounded-control border border-control bg-surface px-3 text-[15px] outline-none placeholder:text-faint focus:border-ink";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") await signInApi(email, password);
      else await signUpApi(name, email, password);
      window.location.assign("/");
    } catch (err) {
      setError(errorMessage(err, "Không đăng nhập được"));
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-[100dvh] bg-ground lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="flex flex-col px-4 py-8 sm:px-10 lg:px-16">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="text-[15px] font-semibold">TrainAI</span>
        </div>

        <div className="my-auto w-full max-w-[400px] py-12">
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">
            {mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-muted">
            Hỏi đáp trên PDF của bạn và kiểm tra bài nhóm có nói trước sau như một.
          </p>

          <div role="tablist" aria-label="Chọn cách vào" className="mt-8 flex gap-1 rounded-control bg-raised p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={cn(
                  "h-9 flex-1 rounded-[5px] text-sm transition-colors",
                  mode === m ? "bg-surface font-medium shadow-composer" : "text-muted hover:text-ink",
                )}
              >
                {m === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            {mode === "signup" && (
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
                  Tên hiển thị
                </label>
                <input
                  id="name"
                  autoComplete="name"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  className={field}
                  required
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={mode === "signup" ? "password-help" : undefined}
                className={field}
                required
              />
              {mode === "signup" && (
                <p id="password-help" className="mt-1.5 text-xs text-muted">
                  Ít nhất 8 ký tự.
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger-ink">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-control bg-primary text-[15px] font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:opacity-70"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          </form>
        </div>
      </section>

      <SampleAnswer />
    </main>
  );
}

/** What the product does, shown as the product: one answer with its page sources. */
function SampleAnswer() {
  return (
    <aside
      aria-label="Ví dụ câu trả lời"
      className="hidden items-center justify-center bg-surface px-16 lg:flex lg:border-l lg:border-line"
    >
      <div className="w-full max-w-[460px]">
        <p className="ml-auto w-fit max-w-[85%] rounded-card bg-raised px-4 py-2.5 text-[15px] leading-6">
          Rút hồ sơ trước khi học kỳ bắt đầu thì được hoàn bao nhiêu?
        </p>
        <div className="mt-8 text-[15px] leading-[1.65]">
          <p>
            Học sinh rút hồ sơ <strong className="font-semibold">trước khi học kỳ bắt đầu</strong>{" "}
            được hoàn <strong className="font-semibold">70% học phí</strong> đã nộp của học kỳ đó.
            Sau khi học kỳ bắt đầu thì không được hoàn.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted">Nguồn</span>
            <span className="inline-flex h-7 items-center gap-1 rounded-control bg-cite-soft px-2 text-xs text-cite">
              quy che hoc phi <span className="font-semibold tabular-nums">tr. 2</span>
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
