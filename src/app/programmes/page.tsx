"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

type Programme = {
  id: string;
  name: string;
  description: string | null;
  days_per_week: number;
  created_at: string;
  updated_at: string;
};

export default function ProgrammesPage() {
  const router = useRouter();
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadProgrammes();
  }, []);

  async function loadProgrammes() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("programmes")
      .select("*")
      .eq("coach_id", session.user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error loading programmes:", error);
    } else {
      setProgrammes(data || []);
    }
    setLoading(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will remove all days and exercises too.`)) {
      return;
    }
    setDeleting(id);
    const { error } = await supabase.from("programmes").delete().eq("id", id);
    if (error) {
      alert("Failed to delete: " + error.message);
    } else {
      setProgrammes((prev) => prev.filter((p) => p.id !== id));
    }
    setDeleting(null);
  }

  async function handleDuplicate(programme: Programme) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    // 1. Create the new programme
    const { data: newProg, error: progError } = await supabase
      .from("programmes")
      .insert({
        coach_id: session.user.id,
        name: programme.name + " (Copy)",
        description: programme.description,
        days_per_week: programme.days_per_week,
      })
      .select()
      .single();

    if (progError || !newProg) {
      alert("Failed to duplicate: " + (progError?.message || "Unknown error"));
      return;
    }

    // 2. Copy all days
    const { data: days } = await supabase
      .from("programme_days")
      .select("*")
      .eq("programme_id", programme.id)
      .order("day_number");

    if (days && days.length > 0) {
      for (const day of days) {
        const { data: newDay } = await supabase
          .from("programme_days")
          .insert({
            programme_id: newProg.id,
            day_number: day.day_number,
            day_name: day.day_name,
            notes: day.notes,
          })
          .select()
          .single();

        if (newDay) {
          // 3. Copy exercises for this day
          const { data: exercises } = await supabase
            .from("programme_exercises")
            .select("*")
            .eq("programme_day_id", day.id)
            .order("sort_order");

          if (exercises && exercises.length > 0) {
            await supabase.from("programme_exercises").insert(
              exercises.map((ex) => ({
                programme_day_id: newDay.id,
                exercise_name: ex.exercise_name,
                target_sets: ex.target_sets,
                target_reps: ex.target_reps,
                target_weight_kg: ex.target_weight_kg,
                rest_seconds: ex.rest_seconds,
                notes: ex.notes,
                sort_order: ex.sort_order,
              }))
            );
          }
        }
      }
    }

    // Refresh list
    loadProgrammes();
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Programmes" backHref="/dashboard" showSignOut={false} />
        <div className="flex items-center justify-center py-20">
          <p className="text-[var(--muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Programmes" backHref="/dashboard" showSignOut={false} />

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Create button */}
        <button
          onClick={() => router.push("/programmes/new")}
          className="w-full py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors mb-6"
        >
          + New Programme
        </button>

        {/* Programme list */}
        {programmes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--muted)] mb-2">No programmes yet</p>
            <p className="text-sm text-[var(--muted)]">
              Create your first programme to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {programmes.map((prog) => (
              <div
                key={prog.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4"
              >
                <div
                  className="cursor-pointer"
                  onClick={() => router.push(`/programmes/${prog.id}`)}
                >
                  <h3 className="font-medium text-lg">{prog.name}</h3>
                  {prog.description && (
                    <p className="text-sm text-[var(--muted)] mt-1">
                      {prog.description}
                    </p>
                  )}
                  <p className="text-sm text-[var(--muted)] mt-2">
                    {prog.days_per_week} days/week
                  </p>
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                  <button
                    onClick={() => router.push(`/programmes/${prog.id}`)}
                    className="flex-1 py-2 text-sm rounded-lg bg-[var(--border)] hover:bg-[var(--muted)]/20 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDuplicate(prog)}
                    className="flex-1 py-2 text-sm rounded-lg bg-[var(--border)] hover:bg-[var(--muted)]/20 transition-colors"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => handleDelete(prog.id, prog.name)}
                    disabled={deleting === prog.id}
                    className="py-2 px-3 text-sm rounded-lg text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                  >
                    {deleting === prog.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
