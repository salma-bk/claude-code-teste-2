import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const tasks = await prisma.task.findMany({
    include: {
      assignee: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ tasks });
}

const createTaskSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  durationMinutes: z.number().int().min(5).max(24 * 60),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  deadline: z.string().datetime().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  const { title, description, durationMinutes, priority, deadline, assigneeId } = parsed.data;

  const task = await prisma.task.create({
    data: {
      title,
      description,
      durationMinutes,
      priority,
      deadline: deadline ? new Date(deadline) : null,
      assigneeId: assigneeId ?? null,
      createdById: session.user.id,
    },
    include: {
      assignee: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
