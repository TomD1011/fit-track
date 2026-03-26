"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

type Exercise = {
  id: string;
  exercise_name: string;
  target_sets: number;
  target_reps: string;
  target_weight_kg: number | null;
  rest_seconds: number | null;
  notes: string | null;
  sort_order: number;
};

type SetLog = {
  id?: string;
  set_number: number;
  reps_completed: number | null;
  weight_kg: number | null;
  notes: string;
  saved: boolean;
};

type ExerciseWithSets = Exercise & {
  sets: SetLog[];
  previousSets: SetLog[];
};

type DayInfo = {
  id: string;
  day_name: string;
  day_number: number;
  programme_id: string;
};

export default function WorkoutLogPage() {
  const router = useRouter();
  const params = useParams();
  const dayId = params.id as string;

  const [day, setDay] = useState<DayInfo | null>(null);
  const [exercises, setExercises] = useState<ExerciseWithSets[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workoutComplete, setWorkoutComplete] = useState(false);
  const todayStr = new Date().toISOString().split("T")[0];

  const loadWorkout = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    // Load day info
    const { data: dayData } = await supabase
      .from("programme_days")
      .select("id, day_name, day_number, programme_id")
      .eq("id", dayId)
      .single();

    if (!dayData) {
      router.replace("/workout");
      return;
    }
    setDay(dayData);

    // Load exercises
    const { data: exData } = await supabase
      .from("programme_exercises")
      .select("*")
      .eq("programme_day_id", dayId)
      .order("sort_order");

    if (!exData) {
      setLoading(false);
      return;
    }

    // For each exercise, load today's logs and previous logs
    const enriched: ExerciseWithSets[] = [];

    for (const ex of exData) {
      // Today's logs
      const { data: todayLogs } = await supabase
        .from("workout_logs")
        .select("id, set_number, reps_completed, weight_kg, notes")
        .eq("programme_exercise_id", ex.id)
        .eq("client_id", session.user.id)
        .eq("completed_date", todayStr)
        .order("set_number");

      // Previous workout logs (most recent date before today)
      const { data: prevLogs } = await supabase
        .from("workout_logs")
        .select("set_number, reps_completed, weight_kg, notes, completed_date")
        .eq("programme_exercise_id", ex.id)
        .eq("client_id", session.user.id)
        .lt("completed_date", todayStr)
        .order("completed_date", { ascending: false })
        .limit(ex.target_sets);

      // Group previous logs by most recent date
      const prevDate = prevLogs?.[0]?.completed_date;
      const previousSets: SetLog[] = prevLogs
        ? prevLogs
            .filter((l) => l.completed_date === prevDate)
            .map((l) => ({
              set_number: l.set_number,
              reps_completed: l.reps_completed,
              weight_kg: l.weight_kg,
              notes: l.notes || "",
              saved: true,
            }))
        : [];

      // Build sets - either from today's logs or empty
      let sets: SetLog[];
      if (todayLogs && todayLogs.length > 0) {
        sets = todayLogs.map((log) => ({
          id: log.id,
          set_number: log.set_number,
          reps_completed: log.reps_completed,
          weight_kg: log.weight_kg,
          notes: log.notes || "",
          saved: true,
        }));
      } else {
        // Pre-fill with target sets, optionally carrying forward previous weights
        sets = Array.from({ length: ex.target_sets }, (_, i) => ({
          set_number: i + 1,
          reps_completed: null,
          weight_kg: previousSets[i]?.weight_kg ?? ex.target_weight_kg ?? null,
          notes: "",
          saved: false,
        }));
      }

      enriched.push({
        ...ex,
        sets,
        previousSets,
      });
    }

    setExercises(enriched);
    setLoading(false);
  }, [dayId, router, todayStr]);

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  function updateSet(
    exerciseIdx: number,
    setIdx: number,
    field: "reps_completed" | "weight_kg" | "notes",
    value: string
  ) {
    setExercises((prev) => {
      const updated = [...prev];
      const sets = [...updated[exerciseIdx].sets];
      if (field === "notes") {
        sets[setIdx] = { ...sets[setIdx], notes: value, saved: false };
      } else {
        const numVal = value === "" ? null : parseFloat(value);
        sets[setIdx] = { ...sets[setIdx], [field]: numVal, saved: false };
      }
      updated[exerciseIdx] = { ...updated[exerciseIdx], sets };
      return updated;
    });
  }

  async function saveSet(exerciseIdx: number, setIdx: number) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const exercise = exercises[exerciseIdx];
    const set = exercise.sets[setIdx];

    setSaving(true);

    if (set.id) {
      // Update existing
      await supabase
        .from("workout_logs")
        .update({
          reps_completed: set.reps_completed,
          weight_kg: set.weight_kg,
          notes: set.notes || null,
        })
        .eq("id", set.id);
    } else {
      // Create new
      const { data } = await supabase
        .from("workout_logs")
        .insert({
          client_id: session.user.id,
          programme_exercise_id: exercise.id,
          completed_date: todayStr,
          set_number: set.set_number,
          reps_completed: set.reps_completed,
          weight_kg: set.weight_kg,
          notes: set.notes || null,
          synced: true,
        })
        .select()
        .single();

      if (data) {
        setExercises((prev) => {
          const updated = [...prev];
          const sets = [...updated[exerciseIdx].sets];
          sets[setIdx] = { ...sets[setIdx], id: data.id, saved: true };
          updated[exerciseIdx] = { ...updated[exerciseIdx], sets };
          return updated;
        });
        setSaving(false);
        return;
      }
    }

    setExercises((prev) => {
      const updated = [...prev];
      const sets = [...updated[exerciseIdx].sets];
      sets[setIdx] = { ...sets[setIdx], saved: true };
      updated[exerciseIdx] = { ...updated[exerciseIdx], sets };
      return updated;
    });
    setSaving(false);
  }

  async function saveAllUnsaved() {
    for (let ei = 0; ei < exercises.length; ei++) {
      for (let si = 0; si < exercises[ei].sets.length; si++) {
        if (!exercises[ei].sets[si].saved && exercises[ei].sets[si].reps_completed !== null) {
          await saveSet(ei, si);
        }
      }
    }
  }

  async function markComplete() {
    await saveAllUnsaved();
    setWorkoutComplete(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Loading..." backHref="/workout" showSignOut={false} />
        <div className="flex items-center justify-center py-20">
          <p className="text-[var(--muted)]">Loading workout...</p>
        </div>
      </div>
    );
  }

  if (workoutComplete) {
    return (
      <div className="min-h-screen">
        <Header title="Workout Complete" backHref="/workout" showSignOut={false} />
        <main className="max-w-lg mx-auto px-4 py-12 text-center space-y-4">
          <div className="text-5xl">&#127947;</div>
          <h2 className="text-2xl font-bold">Nice work!</h2>
          <p className="text-[var(--muted)]">
            {day?.day_name} is done for today. All sets have been saved.
          </p>
          <button
            onClick={() => router.push("/workout")}
            className="mt-6 px-6 py-3 rounded-lg bg-[var(--accent)] text-white font-medium"
          >
            Back to Workouts
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <Header
        title={day?.day_name || "Workout"}
        backHref="/workout"
        showSignOut={false}
      />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {exercises.map((exercise, ei) => (
          <div
            key={exercise.id}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden"
          >
            {/* Exercise Header */}
            <div className="p-4 border-b border-[var(--border)]">
              <h3 className="font-medium">
                {ei + 1}. {exercise.exercise_name}
              </h3>
              <p className="text-sm text-[var(--muted)] mt-1">
                Target: {exercise.target_sets} x {exercise.target_reps}
                {exercise.target_weight_kg != null && ` @ ${exercise.target_weight_kg}kg`}
                {exercise.rest_seconds != null && ` · ${exercise.rest_seconds}s rest`}
              </p>
              {exercise.notes && (
                <p className="text-sm text-[var(--muted)] italic mt-0.5">
                  {exercise.notes}
                </p>
              )}
            </div>

            {/* Set Headers */}
            <div className="grid grid-cols-[40px_1fr_1fr_60px] gap-2 px-4 py-2 text-xs text-[var(--muted)] border-b border-[var(--border)]">
              <span>Set</span>
              <span>Reps</span>
              <span>Weight (kg)</span>
              <span></span>
            </div>

            {/* Sets */}
            {exercise.sets.map((set, si) => {
              const prev = exercise.previousSets[si];
              return (
                <div
                  key={si}
                  className={`grid grid-cols-[40px_1fr_1fr_60px] gap-2 px-4 py-2 items-center ${
                    set.saved ? "opacity-70" : ""
                  }`}
                >
                  <span className="text-sm text-[var(--muted)] font-medium">
                    {set.set_number}
                  </span>
                  <div>
                    <input
                      type="number"
                      value={set.reps_completed ?? ""}
                      onChange={(e) =>
                        updateSet(ei, si, "reps_completed", e.target.value)
                      }
                      className="w-full px-2 py-1.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)] text-sm"
                      placeholder={exercise.target_reps}
                    />
                    {prev && (
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">
                        Last: {prev.reps_completed}
                      </p>
                    )}
                  </div>
                  <div>
                    <input
                      type="number"
                      value={set.weight_kg ?? ""}
                      onChange={(e) =>
                        updateSet(ei, si, "weight_kg", e.target.value)
                      }
                      className="w-full px-2 py-1.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)] text-sm"
                      placeholder={exercise.target_weight_kg?.toString() || "-"}
                      step="0.5"
                    />
                    {prev && (
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">
                        Last: {prev.weight_kg}kg
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => saveSet(ei, si)}
                    disabled={saving || set.saved}
                    className={`py-1.5 rounded text-xs font-medium transition-colors ${
                      set.saved
                        ? "bg-green-500/20 text-green-400"
                        : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                    }`}
                  >
                    {set.saved ? "Saved" : "Save"}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </main>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg)] border-t border-[var(--border)] p-4">
        <div className="max-w-lg mx-auto">
          <button
            onClick={markComplete}
            className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
          >
            Complete Workout
          </button>
        </div>
      </div>
    </div>
  );
}
