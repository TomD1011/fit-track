"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

type Programme = {
  id: string;
  coach_id: string;
  name: string;
  description: string | null;
  days_per_week: number;
};

type ProgrammeDay = {
  id: string;
  programme_id: string;
  day_number: number;
  day_name: string;
  notes: string | null;
};

type Exercise = {
  id: string;
  programme_day_id: string;
  exercise_name: string;
  target_sets: number;
  target_reps: string;
  target_weight_kg: number | null;
  rest_seconds: number | null;
  notes: string | null;
  sort_order: number;
};

type Client = {
  id: string;
  name: string;
  email: string;
};

type Assignment = {
  id: string;
  programme_id: string;
  client_id: string;
  active: boolean;
};

export default function ProgrammeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const programmeId = params.id as string;

  const [programme, setProgramme] = useState<Programme | null>(null);
  const [days, setDays] = useState<ProgrammeDay[]>([]);
  const [exercises, setExercises] = useState<Record<string, Exercise[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Edit programme name
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  // Add exercise form
  const [addingExerciseTo, setAddingExerciseTo] = useState<string | null>(null);
  const [newExercise, setNewExercise] = useState({
    exercise_name: "",
    target_sets: 3,
    target_reps: "10",
    target_weight_kg: "",
    rest_seconds: "",
    notes: "",
  });

  // Edit exercise
  const [editingExercise, setEditingExercise] = useState<string | null>(null);
  const [editExerciseData, setEditExerciseData] = useState({
    exercise_name: "",
    target_sets: 3,
    target_reps: "10",
    target_weight_kg: "",
    rest_seconds: "",
    notes: "",
  });

  // Edit day name
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [dayNameValue, setDayNameValue] = useState("");

  // Assign clients
  const [showAssign, setShowAssign] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const loadProgramme = useCallback(async () => {
    const { data: prog } = await supabase
      .from("programmes")
      .select("*")
      .eq("id", programmeId)
      .single();

    if (!prog) {
      router.replace("/programmes");
      return;
    }

    setProgramme(prog);
    setNameValue(prog.name);

    // Load days
    const { data: daysData } = await supabase
      .from("programme_days")
      .select("*")
      .eq("programme_id", programmeId)
      .order("day_number");

    const loadedDays = daysData || [];
    setDays(loadedDays);

    // Load exercises for all days
    if (loadedDays.length > 0) {
      const dayIds = loadedDays.map((d) => d.id);
      const { data: exData } = await supabase
        .from("programme_exercises")
        .select("*")
        .in("programme_day_id", dayIds)
        .order("sort_order");

      // Group exercises by day
      const grouped: Record<string, Exercise[]> = {};
      for (const day of loadedDays) {
        grouped[day.id] = (exData || []).filter(
          (ex) => ex.programme_day_id === day.id
        );
      }
      setExercises(grouped);
    }

    // Auto-expand first day
    if (loadedDays.length > 0) {
      setExpandedDay(loadedDays[0].id);
    }

    setLoading(false);
  }, [programmeId, router]);

  useEffect(() => {
    loadProgramme();
  }, [loadProgramme]);

  // --- Programme Name ---
  async function saveName() {
    if (!nameValue.trim() || !programme) return;
    await supabase
      .from("programmes")
      .update({ name: nameValue.trim(), updated_at: new Date().toISOString() })
      .eq("id", programme.id);
    setProgramme({ ...programme, name: nameValue.trim() });
    setEditingName(false);
  }

  // --- Day Name ---
  async function saveDayName(dayId: string) {
    if (!dayNameValue.trim()) return;
    await supabase
      .from("programme_days")
      .update({ day_name: dayNameValue.trim() })
      .eq("id", dayId);
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, day_name: dayNameValue.trim() } : d))
    );
    setEditingDay(null);
  }

  // --- Exercises ---
  function resetNewExercise() {
    setNewExercise({
      exercise_name: "",
      target_sets: 3,
      target_reps: "10",
      target_weight_kg: "",
      rest_seconds: "",
      notes: "",
    });
  }

  async function addExercise(dayId: string) {
    if (!newExercise.exercise_name.trim()) return;

    const currentExercises = exercises[dayId] || [];
    const nextOrder =
      currentExercises.length > 0
        ? Math.max(...currentExercises.map((e) => e.sort_order)) + 1
        : 0;

    const { data, error } = await supabase
      .from("programme_exercises")
      .insert({
        programme_day_id: dayId,
        exercise_name: newExercise.exercise_name.trim(),
        target_sets: newExercise.target_sets,
        target_reps: newExercise.target_reps,
        target_weight_kg: newExercise.target_weight_kg
          ? parseFloat(newExercise.target_weight_kg)
          : null,
        rest_seconds: newExercise.rest_seconds
          ? parseInt(newExercise.rest_seconds)
          : null,
        notes: newExercise.notes.trim() || null,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      alert("Failed to add exercise: " + error.message);
      return;
    }

    setExercises((prev) => ({
      ...prev,
      [dayId]: [...(prev[dayId] || []), data],
    }));
    resetNewExercise();
    setAddingExerciseTo(null);

    // Update programme timestamp
    await supabase
      .from("programmes")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", programmeId);
  }

  async function deleteExercise(dayId: string, exerciseId: string) {
    const { error } = await supabase
      .from("programme_exercises")
      .delete()
      .eq("id", exerciseId);

    if (error) {
      alert("Failed to delete: " + error.message);
      return;
    }

    setExercises((prev) => ({
      ...prev,
      [dayId]: (prev[dayId] || []).filter((e) => e.id !== exerciseId),
    }));
  }

  function startEditExercise(exercise: Exercise) {
    setEditingExercise(exercise.id);
    setEditExerciseData({
      exercise_name: exercise.exercise_name,
      target_sets: exercise.target_sets,
      target_reps: exercise.target_reps,
      target_weight_kg: exercise.target_weight_kg?.toString() || "",
      rest_seconds: exercise.rest_seconds?.toString() || "",
      notes: exercise.notes || "",
    });
  }

  async function saveExercise(dayId: string, exerciseId: string) {
    if (!editExerciseData.exercise_name.trim()) return;

    const { data, error } = await supabase
      .from("programme_exercises")
      .update({
        exercise_name: editExerciseData.exercise_name.trim(),
        target_sets: editExerciseData.target_sets,
        target_reps: editExerciseData.target_reps,
        target_weight_kg: editExerciseData.target_weight_kg
          ? parseFloat(editExerciseData.target_weight_kg)
          : null,
        rest_seconds: editExerciseData.rest_seconds
          ? parseInt(editExerciseData.rest_seconds)
          : null,
        notes: editExerciseData.notes.trim() || null,
      })
      .eq("id", exerciseId)
      .select()
      .single();

    if (error) {
      alert("Failed to update: " + error.message);
      return;
    }

    setExercises((prev) => ({
      ...prev,
      [dayId]: (prev[dayId] || []).map((e) => (e.id === exerciseId ? data : e)),
    }));
    setEditingExercise(null);
  }

  async function moveExercise(dayId: string, exerciseId: string, direction: "up" | "down") {
    const dayExercises = [...(exercises[dayId] || [])];
    const idx = dayExercises.findIndex((e) => e.id === exerciseId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === dayExercises.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const temp = dayExercises[idx].sort_order;
    dayExercises[idx].sort_order = dayExercises[swapIdx].sort_order;
    dayExercises[swapIdx].sort_order = temp;

    // Swap in array
    [dayExercises[idx], dayExercises[swapIdx]] = [dayExercises[swapIdx], dayExercises[idx]];

    setExercises((prev) => ({ ...prev, [dayId]: dayExercises }));

    // Persist both
    await Promise.all([
      supabase
        .from("programme_exercises")
        .update({ sort_order: dayExercises[idx].sort_order })
        .eq("id", dayExercises[idx].id),
      supabase
        .from("programme_exercises")
        .update({ sort_order: dayExercises[swapIdx].sort_order })
        .eq("id", dayExercises[swapIdx].id),
    ]);
  }

  // --- Client Assignment ---
  async function loadClients() {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("role", "client");
    setClients(data || []);

    const { data: assignData } = await supabase
      .from("programme_assignments")
      .select("*")
      .eq("programme_id", programmeId);
    setAssignments(assignData || []);
  }

  async function toggleAssignment(clientId: string) {
    const existing = assignments.find((a) => a.client_id === clientId);

    if (existing) {
      // Toggle active status
      const { data } = await supabase
        .from("programme_assignments")
        .update({ active: !existing.active })
        .eq("id", existing.id)
        .select()
        .single();
      if (data) {
        setAssignments((prev) =>
          prev.map((a) => (a.id === existing.id ? data : a))
        );
      }
    } else {
      // Create new assignment
      const { data } = await supabase
        .from("programme_assignments")
        .insert({
          programme_id: programmeId,
          client_id: clientId,
          active: true,
        })
        .select()
        .single();
      if (data) {
        setAssignments((prev) => [...prev, data]);
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Loading..." backHref="/programmes" showSignOut={false} />
        <div className="flex items-center justify-center py-20">
          <p className="text-[var(--muted)]">Loading programme...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      <Header
        title={programme?.name || "Programme"}
        backHref="/programmes"
        showSignOut={false}
      />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Programme Info */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          {editingName ? (
            <div className="flex gap-2">
              <input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
              />
              <button
                onClick={saveName}
                className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{programme?.name}</h2>
                <p className="text-sm text-[var(--muted)] mt-1">
                  {programme?.days_per_week} days/week
                  {programme?.description && ` · ${programme.description}`}
                </p>
              </div>
              <button
                onClick={() => setEditingName(true)}
                className="text-sm text-[var(--accent)]"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Assign Clients Button */}
        <button
          onClick={() => {
            setShowAssign(!showAssign);
            if (!showAssign) loadClients();
          }}
          className="w-full py-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)] transition-colors"
        >
          {showAssign ? "Hide Client Assignments" : "Assign to Clients"}
        </button>

        {/* Client Assignment Panel */}
        {showAssign && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
            <h3 className="font-medium text-sm text-[var(--muted)]">
              Assign this programme to clients
            </h3>
            {clients.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No clients registered yet. They need to sign up first.
              </p>
            ) : (
              clients.map((client) => {
                const assignment = assignments.find(
                  (a) => a.client_id === client.id
                );
                const isAssigned = assignment?.active ?? false;
                return (
                  <div
                    key={client.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{client.name}</p>
                      <p className="text-xs text-[var(--muted)]">{client.email}</p>
                    </div>
                    <button
                      onClick={() => toggleAssignment(client.id)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isAssigned
                          ? "bg-green-500/20 text-green-400"
                          : "bg-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]"
                      }`}
                    >
                      {isAssigned ? "Assigned" : "Assign"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Days */}
        <div className="space-y-3">
          {days.map((day) => {
            const dayExercises = exercises[day.id] || [];
            const isExpanded = expandedDay === day.id;

            return (
              <div
                key={day.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden"
              >
                {/* Day Header */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() =>
                    setExpandedDay(isExpanded ? null : day.id)
                  }
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    >
                      ▶
                    </span>
                    {editingDay === day.id ? (
                      <input
                        value={dayNameValue}
                        onChange={(e) => setDayNameValue(e.target.value)}
                        className="px-2 py-1 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveDayName(day.id);
                          if (e.key === "Escape") setEditingDay(null);
                        }}
                        onBlur={() => saveDayName(day.id)}
                      />
                    ) : (
                      <h3 className="font-medium">{day.day_name}</h3>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--muted)]">
                      {dayExercises.length} exercise
                      {dayExercises.length !== 1 ? "s" : ""}
                    </span>
                    {editingDay !== day.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDay(day.id);
                          setDayNameValue(day.day_name);
                        }}
                        className="text-xs text-[var(--accent)] ml-2"
                      >
                        rename
                      </button>
                    )}
                  </div>
                </div>

                {/* Exercises */}
                {isExpanded && (
                  <div className="border-t border-[var(--border)]">
                    {dayExercises.length === 0 && addingExerciseTo !== day.id && (
                      <p className="text-sm text-[var(--muted)] p-4">
                        No exercises yet — add your first one below
                      </p>
                    )}

                    {dayExercises.map((ex, idx) => (
                      <div
                        key={ex.id}
                        className="p-4 border-b border-[var(--border)] last:border-b-0"
                      >
                        {editingExercise === ex.id ? (
                          /* Edit Exercise Form */
                          <ExerciseForm
                            data={editExerciseData}
                            onChange={setEditExerciseData}
                            onSave={() => saveExercise(day.id, ex.id)}
                            onCancel={() => setEditingExercise(null)}
                            saveLabel="Save"
                          />
                        ) : (
                          /* Exercise Display */
                          <div>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium">
                                  {idx + 1}. {ex.exercise_name}
                                </p>
                                <p className="text-sm text-[var(--muted)] mt-1">
                                  {ex.target_sets} sets × {ex.target_reps} reps
                                  {ex.target_weight_kg != null &&
                                    ` @ ${ex.target_weight_kg}kg`}
                                  {ex.rest_seconds != null &&
                                    ` · ${ex.rest_seconds}s rest`}
                                </p>
                                {ex.notes && (
                                  <p className="text-sm text-[var(--muted)] mt-0.5 italic">
                                    {ex.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => moveExercise(day.id, ex.id, "up")}
                                disabled={idx === 0}
                                className="px-2 py-1 text-xs rounded bg-[var(--border)] disabled:opacity-30"
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => moveExercise(day.id, ex.id, "down")}
                                disabled={idx === dayExercises.length - 1}
                                className="px-2 py-1 text-xs rounded bg-[var(--border)] disabled:opacity-30"
                              >
                                ↓
                              </button>
                              <button
                                onClick={() => startEditExercise(ex)}
                                className="px-2 py-1 text-xs rounded bg-[var(--border)] text-[var(--accent)]"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteExercise(day.id, ex.id)}
                                className="px-2 py-1 text-xs rounded text-red-400 hover:bg-red-400/10"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add Exercise */}
                    {addingExerciseTo === day.id ? (
                      <div className="p-4">
                        <ExerciseForm
                          data={newExercise}
                          onChange={setNewExercise}
                          onSave={() => addExercise(day.id)}
                          onCancel={() => {
                            setAddingExerciseTo(null);
                            resetNewExercise();
                          }}
                          saveLabel="Add Exercise"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAddingExerciseTo(day.id);
                          resetNewExercise();
                        }}
                        className="w-full p-3 text-sm text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                      >
                        + Add Exercise
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

/* ---- Reusable Exercise Form ---- */
type ExerciseFormData = {
  exercise_name: string;
  target_sets: number;
  target_reps: string;
  target_weight_kg: string;
  rest_seconds: string;
  notes: string;
};

function ExerciseForm({
  data,
  onChange,
  onSave,
  onCancel,
  saveLabel,
}: {
  data: ExerciseFormData;
  onChange: (data: ExerciseFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  return (
    <div className="space-y-3">
      <input
        value={data.exercise_name}
        onChange={(e) => onChange({ ...data, exercise_name: e.target.value })}
        className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
        placeholder="Exercise name (e.g. Barbell Bench Press)"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">Sets</label>
          <input
            type="number"
            value={data.target_sets}
            onChange={(e) =>
              onChange({ ...data, target_sets: parseInt(e.target.value) || 0 })
            }
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
            min={1}
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">Reps</label>
          <input
            value={data.target_reps}
            onChange={(e) => onChange({ ...data, target_reps: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
            placeholder="e.g. 8-12"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">
            Weight (kg)
          </label>
          <input
            type="number"
            value={data.target_weight_kg}
            onChange={(e) =>
              onChange({ ...data, target_weight_kg: e.target.value })
            }
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
            placeholder="Optional"
            step="0.5"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">
            Rest (sec)
          </label>
          <input
            type="number"
            value={data.rest_seconds}
            onChange={(e) => onChange({ ...data, rest_seconds: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
            placeholder="Optional"
          />
        </div>
      </div>
      <input
        value={data.notes}
        onChange={(e) => onChange({ ...data, notes: e.target.value })}
        className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
        placeholder="Notes (e.g. RPE 8, slow eccentric)"
      />
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="flex-1 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium"
        >
          {saveLabel}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-[var(--border)] text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
