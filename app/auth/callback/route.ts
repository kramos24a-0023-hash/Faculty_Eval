import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  try {
    const supabase = await createClient();

    if (tokenHash && type === "recovery") {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
      if (!error) return NextResponse.redirect(new URL("/reset-password", request.url));
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL("/reset-password", request.url));
    }
  } catch {
    // Return a clear recovery error instead of exposing an unhandled callback failure.
  }

  return NextResponse.redirect(new URL("/reset-password?error=invalid-link", request.url));
}
