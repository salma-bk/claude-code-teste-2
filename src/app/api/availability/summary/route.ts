import { NextResponse } from "next/server";
import { addDays } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAvailabilitySummary } from "@/lib/scheduling";

const RANGE_DAYS = 14;

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const rangeStart = new Date();
  const rangeEnd = addDays(rangeStart, RANGE_DAYS);

  const summaries = await Promise.all(
    users.map(async (user) => {
      const summary = await getAvailabilitySummary(user.id, rangeStart, rangeEnd);
      return { userId: user.id, name: user.name, ...summary };
    })
  );

  return NextResponse.json({ rangeDays: RANGE_DAYS, summaries });
}
