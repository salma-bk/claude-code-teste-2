import { auth } from "@/lib/auth";
import { NavLink } from "@/components/NavLink";
import { SignOutButton } from "@/components/SignOutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold">Planificateur</span>
            <nav className="flex gap-1">
              <NavLink href="/dashboard">Tableau de bord</NavLink>
              <NavLink href="/dashboard/tasks">Tâches</NavLink>
              <NavLink href="/dashboard/availability">Mes disponibilités</NavLink>
              <NavLink href="/dashboard/calendar">Calendrier équipe</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{session?.user?.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
