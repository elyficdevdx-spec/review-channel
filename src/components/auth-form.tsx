"use client";
import { useActionState, useState } from "react";
import { authenticate } from "@/features/auth/actions";
export function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [state, action, pending] = useActionState(authenticate, {});
  return (
    <>
      <div className="tabs">
        <button
          type="button"
          aria-pressed={mode === "login"}
          onClick={() => setMode("login")}
        >
          ログイン
        </button>
        <button
          type="button"
          aria-pressed={mode === "signup"}
          onClick={() => setMode("signup")}
        >
          新規登録
        </button>
      </div>
      <form action={action} className="form" key={mode}>
        <input type="hidden" name="mode" value={mode} />
        <label>
          メールアドレス
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label>
          パスワード
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        {state.error && (
          <p role="alert" className="error">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="notice">
            {state.success}
          </p>
        )}
        <button className="primary" disabled={pending}>
          {pending
            ? "処理中…"
            : mode === "login"
              ? "ログイン"
              : "アカウントを作成"}
        </button>
      </form>
    </>
  );
}
