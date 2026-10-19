"use client";

import { useEffect, useState } from "react";

const DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
];

type Slot = { id: string; dayOfWeek: number; startMinute: number; endMinute: number };

function toTimeString(minutes: number) {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export default function AvailabilityPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/availability")
      .then((res) => res.json())
      .then((data) => setSlots(data.slots))
      .finally(() => setLoading(false));
  }, []);

  function addSlot(dayOfWeek: number) {
    setSlots((prev) => [
      ...prev,
      { id: crypto.randomUUID(), dayOfWeek, startMinute: 9 * 60, endMinute: 17 * 60 },
    ]);
  }

  function removeSlot(id: string) {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  function updateSlot(id: string, field: "startMinute" | "endMinute", time: string) {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: toMinutes(time) } : s))
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slots: slots.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startMinute: s.startMinute,
          endMinute: s.endMinute,
        })),
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Erreur lors de l'enregistrement");
      return;
    }

    const data = await res.json();
    setSlots(data.slots);
    setMessage("Disponibilités enregistrées");
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Chargement...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Mes disponibilités</h1>
        <p className="text-sm text-slate-500">
          Indiquez vos créneaux récurrents chaque semaine. Ils seront utilisés pour vous
          proposer automatiquement des tâches.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DAYS.map((day) => {
          const daySlots = slots.filter((s) => s.dayOfWeek === day.value);
          return (
            <div key={day.value} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{day.label}</h2>
                <button
                  onClick={() => addSlot(day.value)}
                  className="text-xs font-medium text-slate-600 underline"
                >
                  + créneau
                </button>
              </div>
              {daySlots.length === 0 ? (
                <p className="text-xs text-slate-400">Indisponible</p>
              ) : (
                <div className="space-y-2">
                  {daySlots.map((slot) => (
                    <div key={slot.id} className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={toTimeString(slot.startMinute)}
                        onChange={(e) => updateSlot(slot.id, "startMinute", e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                      />
                      <span className="text-xs text-slate-400">–</span>
                      <input
                        type="time"
                        value={toTimeString(slot.endMinute)}
                        onChange={(e) => updateSlot(slot.id, "endMinute", e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => removeSlot(slot.id)}
                        className="px-1 text-slate-400 hover:text-red-600"
                        aria-label="Supprimer le créneau"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
        {message && <span className="text-sm text-slate-500">{message}</span>}
      </div>
    </div>
  );
}
