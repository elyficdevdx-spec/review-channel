import type { RedirectInput } from "./service";
export function createRedirectGateway(
  config: { supabaseUrl: string; serviceRoleKey: string },
  fetcher: typeof fetch = fetch,
) {
  return async (input: RedirectInput): Promise<string | null> => {
    const response = await fetcher(
      new URL("/rest/v1/rpc/resolve_and_log_redirect", config.supabaseUrl),
      {
        method: "POST",
        redirect: "error",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_type: input.type,
          p_short_code: input.shortCode,
          p_user_agent: input.userAgent,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      },
    );
    if (!response.ok) throw new Error("Redirect database unavailable");
    const result: unknown = await response.json();
    if (result !== null && typeof result !== "string")
      throw new Error("Invalid redirect response");
    return result;
  };
}
