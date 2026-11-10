"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

type LoginPageProps = {
  isPasswordReset?: boolean;
  initialMessage?: string;
};

function getResetEmailErrorMessage(error: { code?: string; status?: number }) {
  if (error.code === "email_address_not_authorized") {
    return "Supabase’s default email service only sends to project-team addresses. Configure custom SMTP in Supabase Authentication → SMTP Settings to send reset emails to school accounts.";
  }
  if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return "Too many reset requests were made. Please wait before requesting another email.";
  }
  if (error.code === "unexpected_failure" || error.status === 500) {
    return "The password reset email service rejected the request. The school administrator needs to verify the sender domain with the email provider.";
  }
  if (error.code === "email_provider_disabled") {
    return "Email sign-in is disabled in Supabase. Ask your administrator to enable the email provider.";
  }

  const errorCode = error.code ?? error.status;
  return errorCode
    ? `Supabase couldn’t send the reset email (error ${errorCode}). Check Authentication → SMTP Settings in the Supabase dashboard.`
    : "We couldn’t reach Supabase to send the reset email. Check your connection and try again.";
}

function getPasswordUpdateErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "weak_password") {
    return "Choose a stronger password that meets the school account requirements.";
  }
  if (error.code === "same_password") {
    return "Choose a password you haven’t used before.";
  }
  if (error.code === "invalid_credentials") {
    return "Your current password is incorrect. Check it and try again.";
  }
  if (error.code === "reauthentication_needed" || error.code === "reauthentication_not_valid") {
    return "For your security, sign in again and restart the password change.";
  }
  return "We couldn’t update your password. Please try again or request a reset email.";
}

export default function LoginPage({ isPasswordReset = false, initialMessage = "" }: LoginPageProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [isResetEmailSent, setIsResetEmailSent] = useState(false);
  const [isResetComplete, setIsResetComplete] = useState(false);
  const [isCheckingRecovery, setIsCheckingRecovery] = useState(isPasswordReset);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isPasswordReset) return;
    if (initialMessage) {
      setMessage(initialMessage);
      setIsCheckingRecovery(false);
      return;
    }

    let isActive = true;
    async function checkRecoverySession() {
      try {
        const { data, error } = await createClient().auth.getUser();
        if (!isActive) return;
        const isValid = !error && Boolean(data.user);
        setHasRecoverySession(isValid);
        setIsCheckingRecovery(false);
        if (!isValid) setMessage("This password reset link is invalid or expired. Return to sign in to request another.");
      } catch {
        if (!isActive) return;
        setIsCheckingRecovery(false);
        setMessage("We couldn’t verify this password reset link. Return to sign in to request another.");
      }
    }

    void checkRecoverySession();
    return () => {
      isActive = false;
    };
  }, [initialMessage, isPasswordReset]);

  function returnToSignIn() {
    setIsChangingPassword(false);
    setIsRequestingReset(false);
    setIsResetEmailSent(false);
    setMessage("");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const supabase = createClient();

      if (isPasswordReset) {
        if (!hasRecoverySession) {
          setMessage("This password reset link is invalid or expired. Return to sign in to request another.");
          return;
        }
        if (newPassword.length < 8) {
          setMessage("Choose a new password with at least 8 characters.");
          return;
        }
        if (newPassword !== confirmPassword) {
          setMessage("The new passwords don’t match.");
          return;
        }

        const { data, error: userError } = await supabase.auth.getUser();
        if (userError || !data.user) {
          setHasRecoverySession(false);
          setMessage("This password reset link is invalid or expired. Return to sign in to request another.");
          return;
        }

        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) {
          setMessage(getPasswordUpdateErrorMessage(updateError));
          return;
        }

        const { error: signOutError } = await supabase.auth.signOut();
        setIsResetComplete(true);
        setMessage(signOutError
          ? "Your password was updated, but we couldn’t sign you out automatically. Return to sign in and use your new password."
          : "Your password has been reset. Sign in with your new password.");
        return;
      }

      const email = identity.trim().toLowerCase();

      if (isRequestingReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        });
        if (error) {
          setMessage(getResetEmailErrorMessage(error));
          return;
        }
        setIsResetEmailSent(true);
        setMessage("If an account exists for that email, a password reset link has been sent.");
        return;
      }

      if (isChangingPassword) {
        if (newPassword.length < 8) {
          setMessage("Choose a new password with at least 8 characters.");
          return;
        }
        if (newPassword !== confirmPassword) {
          setMessage("The new passwords don’t match.");
          return;
        }

        const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password });
        if (verifyError) {
          setMessage("We couldn’t verify your current password. Check it and try again.");
          return;
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
          current_password: password,
        });
        if (updateError) {
          await supabase.auth.signOut();
          setMessage(getPasswordUpdateErrorMessage(updateError));
          return;
        }

        await supabase.auth.signOut();
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setIsChangingPassword(false);
        setMessage("Your password has been changed. Sign in with your new password.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.user) {
        setMessage("That email or password doesn’t match a provisioned account. Try again or use “Forgot your password?” to reset it.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileError || !profile?.role) {
        await supabase.auth.signOut();
        setMessage("Your school account is not fully set up yet. Please contact your school administrator.");
        return;
      }

      const routeByRole: Record<string, string> = {
        student: "/student",
        admin: "/workspace",
        professor: "/professor",
      };
      const route = routeByRole[profile.role];
      if (!route) {
        await supabase.auth.signOut();
        setMessage("Your school account has an unsupported role. Please contact your school administrator.");
        return;
      }

      router.push(route);
    } catch (error) {
      setMessage(isRequestingReset
        ? error instanceof Error
          ? `We couldn’t reach Supabase to send the reset email: ${error.message}`
          : "We couldn’t reach Supabase to send the reset email. Check your connection and try again."
        : isPasswordReset
        ? "We couldn’t reset your password. Please try again or request a new reset email."
        : "We couldn’t reach the sign-in service. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const heading = isPasswordReset
    ? "Choose a new password"
    : isRequestingReset
      ? "Forgot your password?"
      : isChangingPassword
        ? "Change your password"
        : "Sign in to continue";
  const description = isPasswordReset
    ? "Choose a new password for your school account."
    : isRequestingReset
      ? "Enter the email address on your account and we’ll send a reset link."
      : isChangingPassword
        ? "Verify your current password, then choose a new one."
        : "Use your school account to access faculty evaluations.";

  return (
    <main className="login-shell">
      <section className="login-story" aria-label="About OLOPSC Faculty Evaluation">
        <div className="login-story__pattern" aria-hidden="true" />
        <a className="login-brand" href="#home" aria-label="OLOPSC Faculty Evaluation home">
          <span className="login-brand__mark" aria-hidden="true">◇</span>
          <span className="login-brand__copy"><strong>OLOPSC</strong><small>FACULTY EVALUATION<br />SYSTEM</small></span>
        </a>

        <div className="login-story__content">
          <span className="login-overline"><i /> A SCHOOL COMMUNITY, MOVING FORWARD</span>
          <h1>Better teaching<br />starts with <em>listening.</em></h1>
          <p>Thoughtful feedback helps our teachers grow and gives every learner a voice in the classroom.</p>
          <div className="login-quote">
            <span className="login-quote__mark" aria-hidden="true">“</span>
            <div><strong>Make every voice count.</strong><small>A more connected OLOPSC learning community.</small></div>
          </div>
        </div>

        <div className="login-story__footer"><span>© 2026 OLOPSC</span><span>Empowering better teaching</span></div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel__top"><span className="login-panel__school">OLOPSC · SCHOOL YEAR 2026–2027</span><span className="secure-label"><span aria-hidden="true">◈</span> SCHOOL ACCESS</span></div>
        <div className="login-card">
          <div className="login-card__heading"><span className="login-card__icon" aria-hidden="true">↗</span><p className="login-card__eyebrow">WELCOME TO YOUR WORKSPACE</p><h2 id="login-title">{heading}</h2><p>{description}</p></div>

          {isPasswordReset && isCheckingRecovery && <p className="login-message" role="status">Verifying your password reset link…</p>}
          {((isPasswordReset && isResetComplete) || (isRequestingReset && isResetEmailSent)) ? (
            <div className="login-form">
              <p className="login-message" role="status" aria-live="polite">{message}</p>
              {isRequestingReset && <button className="login-text-button" type="button" onClick={() => { setIsResetEmailSent(false); setMessage(""); }}>Send another reset email</button>}
              <button className="login-submit" type="button" onClick={() => isPasswordReset ? router.push("/") : returnToSignIn()}>Back to sign in <span aria-hidden="true">→</span></button>
            </div>
          ) : isPasswordReset && !isCheckingRecovery && !hasRecoverySession ? (
            <div className="login-form">
              {message && <p className="login-message" role="status" aria-live="polite">{message}</p>}
              <button className="login-submit" type="button" onClick={() => router.push("/")}>Back to sign in <span aria-hidden="true">→</span></button>
            </div>
          ) : !isPasswordReset || hasRecoverySession ? (
            <form className="login-form" onSubmit={handleSubmit}>
              {!isPasswordReset && <label className="login-field" htmlFor="school-email">Email address
                <span className="login-input-wrap"><span className="login-input-icon" aria-hidden="true">✉</span><input id="school-email" name="identity" type="email" autoComplete={isRequestingReset ? "email" : "username"} placeholder="name@example.com" value={identity} onChange={(event) => setIdentity(event.target.value)} required /></span>
              </label>}
              {!isPasswordReset && !isRequestingReset && <label className="login-field" htmlFor="school-password">{isChangingPassword ? "Current password" : "Password"}
                <span className="login-input-wrap"><span className="login-input-icon" aria-hidden="true">▣</span><input id="school-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder={isChangingPassword ? "Enter your current password" : "Enter your password"} value={password} onChange={(event) => setPassword(event.target.value)} required /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></span>
              </label>}
              {(isChangingPassword || isPasswordReset) && <>
                <label className="login-field" htmlFor="new-password">New password
                  <span className="login-input-wrap"><span className="login-input-icon" aria-hidden="true">▣</span><input id="new-password" name="newPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required /></span>
                </label>
                <label className="login-field" htmlFor="confirm-password">Confirm new password
                  <span className="login-input-wrap"><span className="login-input-icon" aria-hidden="true">▣</span><input id="confirm-password" name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Re-enter your new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required /></span>
                </label>
              </>}
              {!isPasswordReset && !isRequestingReset && <div className="login-form__options">
                {!isChangingPassword && <label className="remember-option"><input type="checkbox" name="remember" /> <span>Remember this device</span></label>}
                <div className="login-form__links">
                  {!isChangingPassword && <button className="login-text-button" type="button" onClick={() => { setMessage(""); setIsChangingPassword(false); setIsRequestingReset(true); setNewPassword(""); setConfirmPassword(""); }}>Forgot password?</button>}
                  <button className="login-text-button" type="button" onClick={() => { setMessage(""); if (isChangingPassword) returnToSignIn(); else { setIsRequestingReset(false); setIsChangingPassword(true); setNewPassword(""); setConfirmPassword(""); } }}>{isChangingPassword ? "Back to sign in" : "Change password"}</button>
                </div>
              </div>}
              {isRequestingReset && <button className="login-text-button" type="button" onClick={returnToSignIn}>Back to sign in</button>}
              <button className="login-submit" type="submit" disabled={isSubmitting || (isPasswordReset && !hasRecoverySession)}>{isSubmitting ? (isPasswordReset || isChangingPassword ? "Updating password…" : isRequestingReset ? "Sending reset link…" : "Signing in…") : isPasswordReset || isChangingPassword ? "Update password" : isRequestingReset ? "Send reset link" : "Sign in"} <span aria-hidden="true">→</span></button>
              {message && <p className="login-message" role="status" aria-live="polite">{message}</p>}
            </form>
          ) : null}

          {!isPasswordReset && <><div className="access-note"><span className="access-note__icon" aria-hidden="true">ⓘ</span><p><strong>Your access is assigned by OLOPSC.</strong> Students, faculty, and administrators see the workspace for their school role.</p></div><p className="login-card__footnote"><span aria-hidden="true">◇</span> Only accounts provisioned by your school administrator can sign in.</p></>}
        </div>
        <div className="login-panel__footer"><span>Need access? Contact your school administrator.</span><span><i /> Secure school workspace</span></div>
      </section>
    </main>
  );
}
