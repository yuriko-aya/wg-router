import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminClient } from "@/components/admin-client";
import { Role } from "@prisma/client";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <AppShell email={session.user.email} role={session.user.role}>
      <AdminClient />
    </AppShell>
  );
}
