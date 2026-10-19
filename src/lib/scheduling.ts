import {
  addDays,
  addMinutes,
  differenceInMinutes,
  eachDayOfInterval,
  format,
  startOfDay,
} from "date-fns";
import { prisma } from "@/lib/prisma";

export type Interval = { start: Date; end: Date };

function subtractBusy(free: Interval, busyList: Interval[]): Interval[] {
  let segments: Interval[] = [free];

  for (const busy of busyList) {
    const next: Interval[] = [];
    for (const seg of segments) {
      const noOverlap = busy.end <= seg.start || busy.start >= seg.end;
      if (noOverlap) {
        next.push(seg);
        continue;
      }
      if (busy.start > seg.start) next.push({ start: seg.start, end: busy.start });
      if (busy.end < seg.end) next.push({ start: busy.end, end: seg.end });
    }
    segments = next;
  }

  return segments.filter((seg) => seg.end > seg.start);
}

/**
 * Computes the free time slots for a user within [rangeStart, rangeEnd],
 * derived from their recurring weekly availability, minus time off and
 * minus tasks already scheduled on their calendar.
 */
export async function getFreeSlotsForUser(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<Interval[]> {
  if (rangeEnd <= rangeStart) return [];

  const [availabilities, timeOffs, busyTasks] = await Promise.all([
    prisma.availability.findMany({ where: { userId } }),
    prisma.timeOff.findMany({
      where: {
        userId,
        date: { gte: startOfDay(rangeStart), lte: startOfDay(rangeEnd) },
      },
    }),
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: { in: ["SCHEDULED", "SUGGESTED"] },
        scheduledStart: { lte: rangeEnd },
        scheduledEnd: { gte: rangeStart },
      },
      select: { scheduledStart: true, scheduledEnd: true },
    }),
  ]);

  const timeOffDates = new Set(timeOffs.map((t) => format(t.date, "yyyy-MM-dd")));
  const busyIntervals: Interval[] = busyTasks
    .filter((t) => t.scheduledStart && t.scheduledEnd)
    .map((t) => ({ start: t.scheduledStart as Date, end: t.scheduledEnd as Date }));

  const days = eachDayOfInterval({ start: startOfDay(rangeStart), end: startOfDay(rangeEnd) });
  const freeSlots: Interval[] = [];

  for (const day of days) {
    const dayKey = format(day, "yyyy-MM-dd");
    if (timeOffDates.has(dayKey)) continue;

    const dayOfWeek = day.getDay();
    const windows = availabilities.filter((a) => a.dayOfWeek === dayOfWeek);

    for (const window of windows) {
      const windowStart = addMinutes(day, window.startMinute);
      const windowEnd = addMinutes(day, window.endMinute);

      const clippedStart = windowStart < rangeStart ? rangeStart : windowStart;
      const clippedEnd = windowEnd > rangeEnd ? rangeEnd : windowEnd;
      if (clippedStart >= clippedEnd) continue;

      const relevantBusy = busyIntervals.filter(
        (b) => b.start < clippedEnd && b.end > clippedStart
      );
      const segments = subtractBusy({ start: clippedStart, end: clippedEnd }, relevantBusy);
      freeSlots.push(...segments);
    }
  }

  return freeSlots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Finds the earliest slot, across the given candidate users, long enough to
 * fit a task of the given duration before the deadline (if any).
 */
export async function findEarliestSlot(params: {
  durationMinutes: number;
  deadline: Date | null;
  userIds: string[];
  from?: Date;
}): Promise<{ userId: string; start: Date; end: Date } | null> {
  const rangeStart = params.from ?? new Date();
  const rangeEnd = params.deadline ?? addDays(rangeStart, 60);
  if (rangeEnd <= rangeStart) return null;

  const durationMs = params.durationMinutes * 60000;
  let best: { userId: string; start: Date; end: Date } | null = null;

  for (const userId of params.userIds) {
    const freeSlots = await getFreeSlotsForUser(userId, rangeStart, rangeEnd);
    const fit = freeSlots.find((slot) => slot.end.getTime() - slot.start.getTime() >= durationMs);
    if (!fit) continue;

    const candidateEnd = new Date(fit.start.getTime() + durationMs);
    if (!best || fit.start < best.start) {
      best = { userId, start: fit.start, end: candidateEnd };
    }
  }

  return best;
}

/** Number of distinct days with at least some free time, plus total free hours, in a range. */
export async function getAvailabilitySummary(userId: string, rangeStart: Date, rangeEnd: Date) {
  const freeSlots = await getFreeSlotsForUser(userId, rangeStart, rangeEnd);
  const availableDays = new Set(freeSlots.map((s) => format(s.start, "yyyy-MM-dd")));
  const totalFreeMinutes = freeSlots.reduce(
    (sum, s) => sum + differenceInMinutes(s.end, s.start),
    0
  );
  return { availableDays: availableDays.size, totalFreeMinutes };
}
