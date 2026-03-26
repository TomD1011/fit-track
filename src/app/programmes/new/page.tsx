"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

export default function NewProgrammePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Programme name is required");
      return;
    }

    setSaving(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    // Create the programme
    const { data: programme, error: insertError } = await supabase
      .from("programmes")
      .insert({
        coach_id: session.user.id,
        name: name.trim(),
        description: description.trim() || null,
        days_per_week: daysPerWeek,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    // Auto-create the days
    const dayNames: Record<number, string[]> = {
      2: ["Day 1", "Day 2"],
      3: ["Day 1", "Day 2", "Day 3"],
      4: ["Day 1", "Day 2", "Day 3", "Day 4"],
    };

    const days = (dayNames[daysPerWeek] || dayNames[3]).map((dayName, i) => ({
      programme_id: programme.id,
      day_number: i + 1,
      day_name: dayName,
    }));

    await supabase.from("programme_days").insert(days);

    // Go straight to editing
    router.push(`/programmes/${programme.id}`);
  }

  return (
    <div className="min-h-screen">
      <Header title="New Programme" backHref="/programmes" showSignOut={false} />

      <main className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm mb-1 text-[var(--muted)]">
              Programme Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
              placeholder="e.g. 4-Day Upper/Lower Split"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm mb-1 text-[var(--muted)]"
            >
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)] resize-none"
              placeholder="Brief description of this programme"
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-[var(--muted)]">
              Days per Week
            </label>
            <div className="flex gap-3">
              {[2, 3, 4].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDaysPerWeek(d)}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                    daysPerWeek === d
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Programme"}
          </button>
        </form>
      </main>
    </div>
  );
}
