"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  createAsset,
  updateAsset,
  updateEndpoint,
} from "@/features/acquisition/actions";
import type { Asset, Endpoint } from "@/features/acquisition/types";
export function CreateAssetForm({
  stores,
}: {
  stores: { id: string; name: string; ready: boolean }[];
}) {
  const [state, action, pending] = useActionState(createAsset, {});
  const [selected, setSelected] = useState(
    stores.find((s) => s.ready)?.id ?? stores[0]?.id ?? "",
  );
  const ready = stores.find((s) => s.id === selected)?.ready;
  return (
    <form action={action} className="form">
      <label>
        店舗
        <select
          name="store_id"
          required
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {!stores.length && (
            <option value="">登録された店舗がありません</option>
          )}
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {!ready && (
        <p className="notice">
          先に店舗設定からGoogle口コミ投稿URLを登録し、店舗を有効にしてください。
          <br />
          <Link
            className="text-link"
            href={selected ? `/stores/${selected}` : "/stores"}
          >
            店舗設定へ →
          </Link>
        </p>
      )}
      <label>
        販促物名
        <input
          name="name"
          required
          maxLength={120}
          placeholder="例：レジ横口コミカード"
        />
      </label>
      <p className="hint">NFCとQR、それぞれの専用URLを発行します。</p>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button className="primary" disabled={pending || !ready}>
        {pending ? "作成中…" : "販促物を作成"}
      </button>
    </form>
  );
}
export function EditAssetForm({ asset }: { asset: Asset }) {
  const [state, action, pending] = useActionState(updateAsset, {});
  return (
    <form action={action} className="form">
      <input name="id" type="hidden" value={asset.id} />
      <label>
        販促物名
        <input name="name" required maxLength={120} defaultValue={asset.name} />
      </label>
      <label>
        状態
        <select name="status" defaultValue={asset.status}>
          <option value="active">有効</option>
          <option value="inactive">停止</option>
        </select>
      </label>
      <p className="hint">
        停止すると、この販促物のNFC・QR両方の遷移が停止します。
      </p>
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
        {pending ? "保存中…" : "変更を保存"}
      </button>
    </form>
  );
}
export function EndpointStatusForm({ endpoint }: { endpoint: Endpoint }) {
  const [state, action, pending] = useActionState(updateEndpoint, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={endpoint.id} />
      <input
        type="hidden"
        name="asset_id"
        value={endpoint.acquisition_asset_id}
      />
      <input
        type="hidden"
        name="status"
        value={endpoint.status === "active" ? "inactive" : "active"}
      />
      <button className="secondary" disabled={pending}>
        {pending
          ? "更新中…"
          : `${endpoint.type.toUpperCase()}を${endpoint.status === "active" ? "停止" : "有効にする"}`}
      </button>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="hint">
          {state.success}
        </p>
      )}
    </form>
  );
}
