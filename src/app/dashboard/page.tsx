import Link from "next/link";
import { addDays } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAvailabilitySummary } from "@/lib/scheduling";

const RANGE_DAYS = 14;

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [myTasks, suggestedTasks, users] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: userId, status: { in: ["PENDING", "SUGGESTED", "SCHEDULED"] } },
      orderBy: [{ status: "asc" }, { deadline: "asc" }],
      take: 5,
    }),
    prisma.task.findMany({
      where: { status: "SUGGESTED" },
      include: { assignee: { select: { id: true, name: true } } },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const rangeStart = new Date();
  const rangeEnd = addDays(rangeStart, RANGE_DAYS);
  const summaries = await Promise.all(
    users.map(async (u) => ({
      ...u,
      ...(await getAvailabilitySummary(u.id, rangeStart, rangeEnd)),
    }))
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Tableau de bord</h1>
        <p className="text-sm text-slate-500">
          Vue d&apos;ensemble de vos tâches et des disponibilités de l&apos;équipe
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Mes prochaines tâches
        </h2>
        {myTasks.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune tâche ne vous est assignée pour l&apos;instant.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {myTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between py-2 text-sm">
                <span>{task.title}</span>
                <span className="text-xs text-slate-500">
                  {task.status === "PENDING" && "Non planifiée"}
                  {task.status === "SUGGESTED" && "Suggestion à valider"}
                  {task.status === "SCHEDULED" && task.scheduledStart &&
                    new Date(task.scheduledStart).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/dashboard/tasks" className="mt-3 inline-block text-sm font-medium underline">
          Voir toutes les tâches
        </Link>
      </section>

      {suggestedTasks.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-3 text-sm font-semibold text-amber-800">
            {suggestedTasks.length} suggestion(s) en attente de validation
          </h2>
          <ul className="space-y-1 text-sm text-amber-900">
            {suggestedTasks.map((task) => (
              <li key={task.id}>
                {task.title} — proposé pour {task.assignee?.name}
              </li>
            ))}
          </ul>
          <Link href="/dashboard/tasks" className="mt-3 inline-block text-sm font-medium underline">
            Valider les suggestions
          </Link>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Jours disponibles par membre (prochains {RANGE_DAYS} jours)
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {summaries.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
            >
              <div className="font-medium">{s.name}</div>
              <div className="text-slate-500">
                {s.availableDays} j. disponibles · {Math.round(s.totalFreeMinutes / 60)}h libres
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
