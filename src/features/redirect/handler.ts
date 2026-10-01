import "server-only";
import { createRedirectGateway } from "./gateway";
import { handleRedirect } from "./service";
import type { EndpointType } from "../acquisition/types";
export function publicRedirect(
  request: Request,
  type: EndpointType,
  shortCode: string,
) {
  return handleRedirect(
    { type, shortCode, userAgent: request.headers.get("user-agent") },
    {
      resolveAndLog: async (input) => {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceRoleKey)
          throw new Error("Redirect not configured");
        return createRedirectGateway({ supabaseUrl, serviceRoleKey })(input);
      },
    },
  );
}
