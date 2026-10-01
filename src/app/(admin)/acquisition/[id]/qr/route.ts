import { z } from "zod";
import { getAsset } from "@/features/acquisition/repository";
import { qrSvg } from "@/features/acquisition/qr";
import { siteUrl } from "@/lib/env";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Not found", { status: 404 });
  // Route Handlers do not inherit layout auth. getAsset verifies session + RLS.
  const asset = await getAsset(id);
  const endpoint = asset?.acquisition_endpoints.find((e) => e.type === "qr");
  if (!endpoint) return new Response("Not found", { status: 404 });
  const svg = await qrSvg(siteUrl(), endpoint.short_code);
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="review-qr-${id}.svg"`,
    },
  });
}
