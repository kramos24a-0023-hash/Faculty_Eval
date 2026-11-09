"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const email = identity.trim().toLowerCase();
      if (!/^[^@]+@olopsc\.edu\.ph$/.test(email)) {
        setMessage("Use your OLOPSC school email address to sign in.");
        return;
      }

      const supabase = createClient();
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

        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) {
          await supabase.auth.signOut();
          setMessage("We couldn’t change your password. Please try again or contact your school administrator.");
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
        setMessage("We couldn’t sign you in. Check your school email and password, or contact your school administrator.");
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
    } catch {
      setMessage("We couldn’t reach the sign-in service. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

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
          <div className="login-card__heading"><span className="login-card__icon" aria-hidden="true">↗</span><p className="login-card__eyebrow">WELCOME TO YOUR WORKSPACE</p><h2 id="login-title">{isChangingPassword ? "Change your password" : "Sign in to continue"}</h2><p>{isChangingPassword ? "Verify your current password, then choose a new one." : "Use your school account to access faculty evaluations."}</p></div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field" htmlFor="school-email">School email
              <span className="login-input-wrap"><span className="login-input-icon" aria-hidden="true">✉</span><input id="school-email" name="identity" type="email" autoComplete="username" placeholder="name@olopsc.edu.ph" value={identity} onChange={(event) => setIdentity(event.target.value)} required /></span>
            </label>
            <label className="login-field" htmlFor="school-password">{isChangingPassword ? "Current password" : "Password"}
              <span className="login-input-wrap"><span className="login-input-icon" aria-hidden="true">▣</span><input id="school-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder={isChangingPassword ? "Enter your current password" : "Enter your password"} value={password} onChange={(event) => setPassword(event.target.value)} required /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></span>
            </label>
            {isChangingPassword && <>
              <label className="login-field" htmlFor="new-password">New password
                <span className="login-input-wrap"><span className="login-input-icon" aria-hidden="true">▣</span><input id="new-password" name="newPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required /></span>
              </label>
              <label className="login-field" htmlFor="confirm-password">Confirm new password
                <span className="login-input-wrap"><span className="login-input-icon" aria-hidden="true">▣</span><input id="confirm-password" name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Re-enter your new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required /></span>
              </label>
            </>}
            <div className="login-form__options">{!isChangingPassword && <label className="remember-option"><input type="checkbox" name="remember" /> <span>Remember this device</span></label>}<button className="login-text-button" type="button" onClick={() => { setMessage(""); setIsChangingPassword((changing) => !changing); setNewPassword(""); setConfirmPassword(""); }}>{isChangingPassword ? "Back to sign in" : "Change password"}</button></div>
            <button className="login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? (isChangingPassword ? "Changing password…" : "Signing in…") : (isChangingPassword ? "Update password" : "Sign in")} <span aria-hidden="true">→</span></button>
            {message && <p className="login-message" role="status" aria-live="polite">{message}</p>}
          </form>

          <div className="access-note"><span className="access-note__icon" aria-hidden="true">ⓘ</span><p><strong>Your access is assigned by OLOPSC.</strong> Students, faculty, and administrators see the workspace for their school role.</p></div>
          <p className="login-card__footnote"><span aria-hidden="true">◇</span> Access is limited to accounts with an @olopsc.edu.ph school email.</p>
        </div>
        <div className="login-panel__footer"><span>Need access? Contact your school administrator.</span><span><i /> Secure school workspace</span></div>
      </section>
    </main>
  );
}
