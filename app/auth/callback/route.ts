import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";

function redirectWithoutCaching(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  try {
    const supabase = await createClient();

    if (tokenHash && type === "recovery") {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
      if (!error) return redirectWithoutCaching(request, "/reset-password");
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return redirectWithoutCaching(request, "/reset-password");
    }
  } catch {
    // Return a clear recovery error instead of exposing an unhandled callback failure.
  }

  return redirectWithoutCaching(request, "/reset-password?error=invalid-link");
}

