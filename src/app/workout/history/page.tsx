"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

type WorkoutEntry = {
  date: string;
  dayName: string;
  programmeName: string;
  exerciseCount: number;
  totalSets: number;
};

export default function WorkoutHistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<WorkoutEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    // Get all workout logs grouped by date
    const { data: logs } = await supabase
      .from("workout_logs")
      .select(
        "completed_date, programme_exercise_id, programme_exercises(id, programme_day_id, programme_days(day_name, programme_id, programmes(name)))"
      )
      .eq("client_id", session.user.id)
      .order("completed_date", { ascending: false });

    if (!logs || logs.length === 0) {
      setLoading(false);
      return;
    }

    // Group by date + day
    const grouped = new Map<string, WorkoutEntry & { _exerciseIds: Set<string> }>();

    for (const log of logs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ex = log.programme_exercises as any;
      if (!ex) continue;

      const dayInfo = ex.programme_days;
      if (!dayInfo) continue;

      const progInfo = dayInfo.programmes;
      const dayId = ex.programme_day_id;
      const key = `${log.completed_date}_${dayId}`;

      if (grouped.has(key)) {
        const entry = grouped.get(key)!;
        entry.totalSets++;
        if (!entry._exerciseIds.has(ex.id)) {
          entry.exerciseCount++;
          entry._exerciseIds.add(ex.id);
        }
      } else {
        grouped.set(key, {
          date: log.completed_date,
          dayName: dayInfo.day_name || "Workout",
          programmeName: progInfo?.name || "Programme",
          exerciseCount: 1,
          totalSets: 1,
          _exerciseIds: new Set([ex.id]),
        });
      }
    }

    // Clean up internal tracking and convert to array
    const entries = Array.from(grouped.values()).map(
      ({ _exerciseIds: _, ...entry }) => entry
    );

    setHistory(entries);
    setLoading(false);
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";

    return d.toLocaleDateString("en-NZ", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="History" backHref="/dashboard" showSignOut={false} />
        <div className="flex items-center justify-center py-20">
          <p className="text-[var(--muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Workout History" backHref="/dashboard" showSignOut={false} />

      <main className="max-w-lg mx-auto px-4 py-6">
        {history.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--muted)] mb-2">No workouts logged yet</p>
            <p className="text-sm text-[var(--muted)]">
              Complete your first workout and it&apos;ll show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((entry, i) => (
              <div
                key={i}
                className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{entry.dayName}</h3>
                    <p className="text-sm text-[var(--muted)]">
                      {entry.programmeName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatDate(entry.date)}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {entry.exerciseCount} exercises · {entry.totalSets} sets
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
