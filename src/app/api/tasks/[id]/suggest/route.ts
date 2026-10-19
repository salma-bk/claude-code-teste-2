import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findEarliestSlot } from "@/lib/scheduling";

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

  // If the task already names a specific assignee, only consider that person;
  // otherwise consider every team member and pick whoever is free soonest.
  const candidateIds = task.assigneeId
    ? [task.assigneeId]
    : (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id);

  const slot = await findEarliestSlot({
    durationMinutes: task.durationMinutes,
    deadline: task.deadline,
    userIds: candidateIds,
  });

  if (!slot) {
    return NextResponse.json(
      { error: "Aucun créneau disponible n'a été trouvé avant l'échéance" },
      { status: 409 }
    );
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      assigneeId: slot.userId,
      scheduledStart: slot.start,
      scheduledEnd: slot.end,
      status: "SUGGESTED",
    },
    include: includeRelations,
  });

  return NextResponse.json({ task: updated });
}
