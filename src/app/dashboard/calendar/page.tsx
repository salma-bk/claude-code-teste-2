import Link from "next/link";
import { addDays, addWeeks, eachDayOfInterval, format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekOffset = week ? Number(week) : 0;

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const [users, tasks] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.task.findMany({
      where: {
        status: { in: ["SCHEDULED", "SUGGESTED"] },
        scheduledStart: { gte: weekStart, lte: addDays(weekEnd, 1) },
      },
      include: { assignee: { select: { id: true, name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Calendrier équipe</h1>
          <p className="text-sm text-slate-500">
            Semaine du {format(weekStart, "d MMMM", { locale: fr })} au{" "}
            {format(weekEnd, "d MMMM yyyy", { locale: fr })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/calendar?week=${weekOffset - 1}`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            ← Précédente
          </Link>
          <Link
            href="/dashboard/calendar"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Aujourd&apos;hui
          </Link>
          <Link
            href={`/dashboard/calendar?week=${weekOffset + 1}`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Suivante →
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="w-36 p-3 text-left font-medium text-slate-500">Membre</th>
              {days.map((day) => (
                <th key={day.toISOString()} className="p-3 text-left font-medium text-slate-500">
                  {format(day, "EEE d", { locale: fr })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-100 align-top">
                <td className="p-3 font-medium">{user.name}</td>
                {days.map((day) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const dayTasks = tasks.filter(
                    (t) =>
                      t.assignee?.id === user.id &&
                      t.scheduledStart &&
                      format(new Date(t.scheduledStart), "yyyy-MM-dd") === dayKey
                  );
                  return (
                    <td key={dayKey} className="p-2">
                      <div className="flex flex-col gap-1">
                        {dayTasks.map((t) => (
                          <div
                            key={t.id}
                            className={`rounded-md px-2 py-1 text-xs ${
                              t.status === "SUGGESTED"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-emerald-100 text-emerald-900"
                            }`}
                          >
                            <div className="font-medium">{t.title}</div>
                            <div>{format(new Date(t.scheduledStart!), "HH:mm")}</div>
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
