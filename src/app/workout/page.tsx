"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

type Assignment = {
  id: string;
  programme_id: string;
  active: boolean;
  programmes: {
    id: string;
    name: string;
    description: string | null;
    days_per_week: number;
  };
};

type ProgrammeDay = {
  id: string;
  day_number: number;
  day_name: string;
  notes: string | null;
  exercise_count: number;
  last_completed: string | null;
};

export default function WorkoutPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [days, setDays] = useState<ProgrammeDay[]>([]);
  const [selectedProgramme, setSelectedProgramme] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignments();
  }, []);

  async function loadAssignments() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    const { data } = await supabase
      .from("programme_assignments")
      .select("id, programme_id, active, programmes(id, name, description, days_per_week)")
      .eq("client_id", session.user.id)
      .eq("active", true);

    const assigns = (data || []) as unknown as Assignment[];
    setAssignments(assigns);

    // Auto-select if only one programme
    if (assigns.length === 1) {
      setSelectedProgramme(assigns[0]);
      await loadDays(assigns[0].programme_id, session.user.id);
    }

    setLoading(false);
  }

  async function loadDays(programmeId: string, userId: string) {
    const { data: daysData } = await supabase
      .from("programme_days")
      .select("id, day_number, day_name, notes")
      .eq("programme_id", programmeId)
      .order("day_number");

    if (!daysData) return;

    // Get exercise counts and last completion dates
    const enrichedDays: ProgrammeDay[] = [];

    for (const day of daysData) {
      // Count exercises
      const { count } = await supabase
        .from("programme_exercises")
        .select("*", { count: "exact", head: true })
        .eq("programme_day_id", day.id);

      // Get last completed date for this day
      const { data: lastLog } = await supabase
        .from("workout_logs")
        .select("completed_date")
        .eq("client_id", userId)
        .in(
          "programme_exercise_id",
          (
            await supabase
              .from("programme_exercises")
              .select("id")
              .eq("programme_day_id", day.id)
          ).data?.map((e) => e.id) || []
        )
        .order("completed_date", { ascending: false })
        .limit(1);

      enrichedDays.push({
        ...day,
        exercise_count: count || 0,
        last_completed: lastLog?.[0]?.completed_date || null,
      });
    }

    setDays(enrichedDays);
  }

  async function selectProgramme(assignment: Assignment) {
    setSelectedProgramme(assignment);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      await loadDays(assignment.programme_id, session.user.id);
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "Not yet";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Workout" backHref="/dashboard" showSignOut={false} />
        <div className="flex items-center justify-center py-20">
          <p className="text-[var(--muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="min-h-screen">
        <Header title="Workout" backHref="/dashboard" showSignOut={false} />
        <main className="max-w-lg mx-auto px-4 py-12 text-center">
          <p className="text-[var(--muted)] text-lg mb-2">No programme assigned</p>
          <p className="text-sm text-[var(--muted)]">
            Your coach hasn't assigned a programme yet. Check back soon.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title={selectedProgramme?.programmes.name || "Workout"}
        backHref="/dashboard"
        showSignOut={false}
      />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Programme selector (if multiple) */}
        {assignments.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted)]">Select programme:</p>
            {assignments.map((a) => (
              <button
                key={a.id}
                onClick={() => selectProgramme(a)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedProgramme?.id === a.id
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)] bg-[var(--card)]"
                }`}
              >
                <p className="font-medium">{a.programmes.name}</p>
                <p className="text-sm text-[var(--muted)]">
                  {a.programmes.days_per_week} days/week
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Day selection */}
        {selectedProgramme && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">Select today&apos;s workout:</p>
            {days.map((day) => (
              <button
                key={day.id}
                onClick={() => router.push(`/workout/${day.id}`)}
                className="w-full text-left bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{day.day_name}</h3>
                    <p className="text-sm text-[var(--muted)] mt-1">
                      {day.exercise_count} exercise{day.exercise_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--muted)]">Last done</p>
                    <p className={`text-sm ${day.last_completed ? "text-green-400" : "text-[var(--muted)]"}`}>
                      {formatDate(day.last_completed)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
