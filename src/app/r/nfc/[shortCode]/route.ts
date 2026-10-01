import { publicRedirect } from "@/features/redirect/handler";
import { redirectError } from "@/features/redirect/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  return publicRedirect(request, "nfc", (await params).shortCode);
}
// Next otherwise implements HEAD by invoking GET, which would inflate counts.
export function HEAD() {
  return redirectError(405);
}
