import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-md p-8 space-y-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] muted">WG Router</p>
          <h1 className="text-3xl font-semibold">Sign in</h1>
          <p className="muted">
            Sign in with email or continue with Google.
          </p>
        </div>

        <LoginForm />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-xs uppercase tracking-wider muted">or</span>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <GoogleSignInButton />
      </div>
    </main>
  );
}
