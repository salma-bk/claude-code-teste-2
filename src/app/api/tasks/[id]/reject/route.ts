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

  const updated = await prisma.task.update({
    where: { id },
    data: {
      status: "PENDING",
      assigneeId: null,
      scheduledStart: null,
      scheduledEnd: null,
    },
    include: includeRelations,
  });

  return NextResponse.json({ task: updated });
}
