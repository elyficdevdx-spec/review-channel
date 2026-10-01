import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (hash && type === "email") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: hash,
      type: "email",
    });
    if (!error) return NextResponse.redirect(new URL("/stores", siteUrl()));
  }
  return NextResponse.redirect(
    new URL("/login?confirmation=failed", siteUrl()),
  );
}
