"use client";

import { useEffect, useState } from "react";

type User = { id: string; name: string };
type Task = {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  priority: "LOW" | "MEDIUM" | "HIGH";
  deadline: string | null;
  status: "PENDING" | "SUGGESTED" | "SCHEDULED" | "DONE" | "CANCELLED";
  assignee: User | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
};

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
};

const STATUS_LABEL: Record<Task["status"], string> = {
  PENDING: "Non planifiée",
  SUGGESTED: "Suggestion à valider",
  SCHEDULED: "Planifiée",
  DONE: "Terminée",
  CANCELLED: "Annulée",
};

function formatDateTimeLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(60);
  const [priority, setPriority] = useState<Task["priority"]>("MEDIUM");
  const [deadline, setDeadline] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAssignee, setEditAssignee] = useState("");
  const [editStart, setEditStart] = useState("");

  async function loadData() {
    const [tasksRes, usersRes] = await Promise.all([
      fetch("/api/tasks"),
      fetch("/api/users"),
    ]);
    const tasksData = await tasksRes.json();
    const usersData = await usersRes.json();
    setTasks(tasksData.tasks);
    setUsers(usersData.users);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadData();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        durationMinutes: duration,
        priority,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        assigneeId: assigneeId || null,
      }),
    });

    setCreating(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de la création");
      return;
    }

    setTitle("");
    setDescription("");
    setDuration(60);
    setPriority("MEDIUM");
    setDeadline("");
    setAssigneeId("");
    await loadData();
  }

  async function handleSuggest(id: string) {
    setError(null);
    const res = await fetch(`/api/tasks/${id}/suggest`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Aucun créneau trouvé");
      return;
    }
    await loadData();
  }

  async function handleValidate(id: string) {
    await fetch(`/api/tasks/${id}/validate`, { method: "POST" });
    await loadData();
  }

  async function handleReject(id: string) {
    await fetch(`/api/tasks/${id}/reject`, { method: "POST" });
    await loadData();
  }

  async function handleMarkDone(id: string) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });
    await loadData();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await loadData();
  }

  function startEditing(task: Task) {
    setEditingId(task.id);
    setEditAssignee(task.assignee?.id ?? "");
    setEditStart(formatDateTimeLocal(task.scheduledStart));
  }

  async function handleSaveEdit(task: Task) {
    if (!editAssignee || !editStart) return;
    const start = new Date(editStart);
    const end = new Date(start.getTime() + task.durationMinutes * 60000);

    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assigneeId: editAssignee,
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        status: "SCHEDULED",
      }),
    });
    setEditingId(null);
    await loadData();
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Chargement...</p>;
  }

  const activeTasks = tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
  const doneTasks = tasks.filter((t) => t.status === "DONE" || t.status === "CANCELLED");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Tâches</h1>
        <p className="text-sm text-slate-500">
          Créez des tâches, laissez l&apos;app proposer un créneau selon les disponibilités,
          puis validez ou ajustez.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2"
      >
        <label className="text-sm sm:col-span-2">
          Titre
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm sm:col-span-2">
          Description (optionnelle)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm">
          Durée (minutes)
          <input
            type="number"
            min={5}
            step={5}
            required
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm">
          Priorité
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task["priority"])}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="LOW">Basse</option>
            <option value="MEDIUM">Moyenne</option>
            <option value="HIGH">Haute</option>
          </select>
        </label>

        <label className="text-sm">
          Échéance (optionnelle)
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm">
          Assigné (optionnel)
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">N&apos;importe qui de libre</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:col-span-2"
        >
          {creating ? "Création..." : "Créer la tâche"}
        </button>
      </form>

      <div className="space-y-3">
        {activeTasks.map((task) => (
          <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{task.title}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                </div>
                {task.description && (
                  <p className="mt-1 text-sm text-slate-500">{task.description}</p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {task.durationMinutes} min
                  {task.deadline &&
                    ` · échéance ${new Date(task.deadline).toLocaleDateString("fr-FR")}`}
                </p>
              </div>
              <span className="whitespace-nowrap rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600">
                {STATUS_LABEL[task.status]}
              </span>
            </div>

            {task.status === "SUGGESTED" && task.assignee && task.scheduledStart && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                Proposé pour <strong>{task.assignee.name}</strong> le{" "}
                {new Date(task.scheduledStart).toLocaleString("fr-FR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </div>
            )}

            {task.status === "SCHEDULED" && task.assignee && task.scheduledStart && (
              <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                Assigné à <strong>{task.assignee.name}</strong> le{" "}
                {new Date(task.scheduledStart).toLocaleString("fr-FR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </div>
            )}

            {editingId === task.id ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3">
                <select
                  value={editAssignee}
                  onChange={(e) => setEditAssignee(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                >
                  <option value="">Choisir un assigné</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <button
                  onClick={() => handleSaveEdit(task)}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                >
                  Enregistrer
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1.5 text-sm text-slate-500"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {task.status === "PENDING" && (
                  <button
                    onClick={() => handleSuggest(task.id)}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Suggérer un créneau
                  </button>
                )}
                {task.status === "SUGGESTED" && (
                  <>
                    <button
                      onClick={() => handleValidate(task.id)}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      Valider
                    </button>
                    <button
                      onClick={() => handleReject(task.id)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Rejeter
                    </button>
                  </>
                )}
                {task.status === "SCHEDULED" && (
                  <button
                    onClick={() => handleMarkDone(task.id)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Marquer terminée
                  </button>
                )}
                <button
                  onClick={() => startEditing(task)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Ajuster manuellement
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="rounded-md px-3 py-1.5 text-sm text-red-500 hover:bg-red-50"
                >
                  Supprimer
                </button>
              </div>
            )}
          </div>
        ))}

        {activeTasks.length === 0 && (
          <p className="text-sm text-slate-500">Aucune tâche en cours.</p>
        )}
      </div>

      {doneTasks.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">
            Tâches terminées ({doneTasks.length})
          </summary>
          <ul className="mt-3 space-y-1 text-sm text-slate-500">
            {doneTasks.map((t) => (
              <li key={t.id}>{t.title}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
