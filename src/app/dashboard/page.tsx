import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DashboardClient } from "@/components/dashboard-client";
import { getSiteTitle } from "@/lib/env";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <AppShell
      email={session.user.email}
      role={session.user.role}
      siteTitle={getSiteTitle()}
    >
      <DashboardClient />
    </AppShell>
  );
}
