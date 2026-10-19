import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const includeRelations = {
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 });
  }
  if (!task.assigneeId || !task.scheduledStart || !task.scheduledEnd) {
    return NextResponse.json(
      { error: "La tâche doit avoir un assigné et un créneau avant validation" },
      { status: 400 }
    );
  }

  const updated = await prisma.task.update({
    where: { id },
    data: { status: "SCHEDULED" },
    include: includeRelations,
  });

  return NextResponse.json({ task: updated });
}
