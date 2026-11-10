import LoginPage from "../login";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <LoginPage
      isPasswordReset
      initialMessage={error === "invalid-link"
        ? "This password reset link is invalid or expired. Return to sign in to request another."
        : ""}
    />
  );
}
