import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const includeRelations = {
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(5).max(24 * 60).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  deadline: z.string().datetime().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  scheduledStart: z.string().datetime().nullable().optional(),
  scheduledEnd: z.string().datetime().nullable().optional(),
  status: z.enum(["PENDING", "SUGGESTED", "SCHEDULED", "DONE", "CANCELLED"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  const { deadline, scheduledStart, scheduledEnd, ...rest } = parsed.data;

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...rest,
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(scheduledStart !== undefined && {
        scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
      }),
      ...(scheduledEnd !== undefined && {
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
      }),
    },
    include: includeRelations,
  });

  return NextResponse.json({ task });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.task.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
