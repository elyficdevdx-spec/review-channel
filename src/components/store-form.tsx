"use client";
import { useActionState } from "react";
import { saveStore } from "@/features/stores/actions";
import type { Store } from "@/features/stores/validation";
export function StoreForm({ store }: { store?: Store }) {
  const [state, action, pending] = useActionState(saveStore, {});
  return (
    <form action={action} className="form">
      {store && <input type="hidden" name="id" value={store.id} />}
      <label>
        店舗名
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={store?.name}
          placeholder="例：喫茶 ひととき"
        />
      </label>
      <label>
        住所
        <input
          name="address"
          required
          maxLength={500}
          defaultValue={store?.address}
          placeholder="都道府県・市区町村・番地"
        />
      </label>
      <label>
        Google口コミ投稿URL
        <input
          name="google_review_url"
          type="url"
          required
          maxLength={2048}
          defaultValue={store?.google_review_url}
          placeholder="https://g.page/店舗ID/review"
          aria-describedby="url-help"
        />
      </label>
      <p className="hint" id="url-help">
        g.page/r/…/review、g.page/…/review または
        search.google.com/local/writereview?placeid=… の形式に対応しています。
      </p>
      <label>
        ステータス
        <select name="status" defaultValue={store?.status ?? "active"}>
          <option value="active">有効</option>
          <option value="inactive">停止</option>
        </select>
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
        {pending ? "保存中…" : store ? "変更を保存" : "店舗を登録"}
      </button>
    </form>
  );
}
