"use client";
import { useState } from "react";
export function CopyUrl({ url, label }: { url: string; label: string }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("コピーしました。");
    } catch {
      setMessage("コピーできませんでした。URL欄を選択してコピーしてください。");
    }
  }
  return (
    <div className="copy-url">
      <label className="sr-only" htmlFor={label}>
        {label}
      </label>
      <input
        id={label}
        value={url}
        readOnly
        onFocus={(e) => e.currentTarget.select()}
        aria-label={label}
      />
      <button className="secondary" type="button" onClick={copy}>
        コピー
      </button>
      <span className="hint" role="status">
        {message}
      </span>
    </div>
  );
}
