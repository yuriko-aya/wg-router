import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/register-form";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-md p-8 space-y-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] muted">WG Router</p>
          <h1 className="text-3xl font-semibold">Create account</h1>
          <p className="muted">
            Register with email. Protected by Cloudflare Turnstile.
          </p>
        </div>

        <RegisterForm />
      </div>
    </main>
  );
}
