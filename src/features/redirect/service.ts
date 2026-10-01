import { isGoogleReviewUrl } from "../../lib/validation/google-review-url";
export type RedirectInput = {
  type: string;
  shortCode: string;
  userAgent: string | null;
};
export type RedirectDependencies = {
  resolveAndLog: (input: RedirectInput) => Promise<string | null>;
  // Replace with a distributed limiter; do not use process-local counters in serverless.
  allowRequest?: (input: RedirectInput) => Promise<boolean>;
};
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};
export function redirectError(status: 404 | 405 | 429 | 503) {
  const message =
    status === 404
      ? "この口コミ案内は現在ご利用いただけません。店舗スタッフにお問い合わせください。"
      : status === 405
        ? "この操作は利用できません。"
        : "ただいま接続できません。しばらくしてから、もう一度お試しください。";
  return new Response(
    `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>口コミのご案内</title><body><main><h1>口コミのご案内</h1><p>${message}</p></main></body></html>`,
    {
      status,
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        ...(status === 405 ? { Allow: "GET" } : {}),
        ...(status === 503 || status === 429 ? { "Retry-After": "30" } : {}),
      },
    },
  );
}
export async function handleRedirect(
  input: RedirectInput,
  deps: RedirectDependencies,
): Promise<Response> {
  if (
    !["nfc", "qr"].includes(input.type) ||
    input.shortCode.length !== 32 ||
    !/^[a-f0-9]{32}$/.test(input.shortCode)
  )
    return redirectError(404);
  try {
    const bounded = {
      ...input,
      userAgent: input.userAgent?.replace(/\u0000/g, "").slice(0, 512) ?? null,
    };
    if (deps.allowRequest && !(await deps.allowRequest(bounded)))
      return redirectError(429);
    const destination = await deps.resolveAndLog(bounded);
    if (!destination || !isGoogleReviewUrl(destination))
      return redirectError(404);
    return new Response(null, {
      status: 302,
      headers: { ...headers, Location: destination },
    });
  } catch {
    // No URL, raw IP, headers, keys or visitor data in application error logs.
    return redirectError(503);
  }
}
