import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? session.user.id;

  const slots = await prisma.availability.findMany({
    where: { userId },
    orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
  });

  return NextResponse.json({ slots });
}

const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
});

const bodySchema = z.object({
  slots: z.array(slotSchema),
});

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  const invalid = parsed.data.slots.some((s) => s.endMinute <= s.startMinute);
  if (invalid) {
    return NextResponse.json(
      { error: "L'heure de fin doit être après l'heure de début" },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { userId } }),
    prisma.availability.createMany({
      data: parsed.data.slots.map((s) => ({ ...s, userId })),
    }),
  ]);

  const slots = await prisma.availability.findMany({
    where: { userId },
    orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
  });

  return NextResponse.json({ slots });
}
