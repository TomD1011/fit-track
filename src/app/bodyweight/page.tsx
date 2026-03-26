"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

type WeightEntry = {
  id: string;
  weight_kg: number;
  measured_date: string;
  notes: string | null;
};

export default function BodyWeightPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // New entry form
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    const { data } = await supabase
      .from("body_weight_log")
      .select("*")
      .eq("user_id", session.user.id)
      .order("measured_date", { ascending: false })
      .limit(90);

    setEntries(data || []);
    setLoading(false);
  }

  async function addEntry() {
    if (!weight) return;
    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const todayStr = new Date().toISOString().split("T")[0];

    // Check if we already have an entry for today
    const existing = entries.find((e) => e.measured_date === todayStr);

    if (existing) {
      // Update today's entry
      const { data } = await supabase
        .from("body_weight_log")
        .update({
          weight_kg: parseFloat(weight),
          notes: notes.trim() || null,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (data) {
        setEntries((prev) =>
          prev.map((e) => (e.id === existing.id ? data : e))
        );
      }
    } else {
      // Create new entry
      const { data } = await supabase
        .from("body_weight_log")
        .insert({
          user_id: session.user.id,
          weight_kg: parseFloat(weight),
          measured_date: todayStr,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (data) {
        setEntries((prev) => [data, ...prev]);
      }
    }

    setWeight("");
    setNotes("");
    setShowForm(false);
    setSaving(false);
  }

  async function deleteEntry(id: string) {
    await supabase.from("body_weight_log").delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  // Stats
  const latest = entries[0]?.weight_kg;
  const oldest = entries.length > 1 ? entries[entries.length - 1]?.weight_kg : null;
  const change = latest && oldest ? (latest - oldest).toFixed(1) : null;

  // Simple chart data (last 30 entries, reversed for left-to-right)
  const chartData = [...entries].slice(0, 30).reverse();
  const chartMin = chartData.length > 0 ? Math.min(...chartData.map((e) => e.weight_kg)) - 1 : 0;
  const chartMax = chartData.length > 0 ? Math.max(...chartData.map((e) => e.weight_kg)) + 1 : 100;
  const chartRange = chartMax - chartMin || 1;

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Body Weight" backHref="/dashboard" showSignOut={false} />
        <div className="flex items-center justify-center py-20">
          <p className="text-[var(--muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Body Weight" backHref="/dashboard" showSignOut={false} />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Stats Bar */}
        {latest && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-center">
              <p className="text-xs text-[var(--muted)]">Current</p>
              <p className="text-lg font-bold">{latest}kg</p>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-center">
              <p className="text-xs text-[var(--muted)]">Entries</p>
              <p className="text-lg font-bold">{entries.length}</p>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-center">
              <p className="text-xs text-[var(--muted)]">Change</p>
              <p className={`text-lg font-bold ${change && parseFloat(change) < 0 ? "text-green-400" : change && parseFloat(change) > 0 ? "text-red-400" : ""}`}>
                {change ? `${parseFloat(change) > 0 ? "+" : ""}${change}kg` : "-"}
              </p>
            </div>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 1 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
            <h3 className="text-sm text-[var(--muted)] mb-3">Weight Trend</h3>
            <div className="relative h-40">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-[10px] text-[var(--muted)]">
                <span>{chartMax.toFixed(0)}</span>
                <span>{((chartMax + chartMin) / 2).toFixed(0)}</span>
                <span>{chartMin.toFixed(0)}</span>
              </div>
              {/* Chart area */}
              <svg className="ml-10 w-[calc(100%-40px)] h-full" viewBox={`0 0 ${chartData.length * 20} 100`} preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="25" x2={chartData.length * 20} y2="25" stroke="var(--border)" strokeWidth="0.5" />
                <line x1="0" y1="50" x2={chartData.length * 20} y2="50" stroke="var(--border)" strokeWidth="0.5" />
                <line x1="0" y1="75" x2={chartData.length * 20} y2="75" stroke="var(--border)" strokeWidth="0.5" />
                {/* Line */}
                <polyline
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  points={chartData
                    .map((e, i) => {
                      const x = i * 20 + 10;
                      const y = 100 - ((e.weight_kg - chartMin) / chartRange) * 100;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
                {/* Dots */}
                {chartData.map((e, i) => {
                  const x = i * 20 + 10;
                  const y = 100 - ((e.weight_kg - chartMin) / chartRange) * 100;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="3"
                      fill="var(--accent)"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* Add Entry Button / Form */}
        {showForm ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
            <h3 className="font-medium">Log Weight</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Weight (kg)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder={latest?.toString() || "80.0"}
                  step="0.1"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Notes (optional)</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder="e.g. morning, fasted"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={addEntry}
                disabled={saving || !weight}
                className="flex-1 py-2 rounded-lg bg-[var(--accent)] text-white font-medium disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg bg-[var(--border)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors"
          >
            + Log Today&apos;s Weight
          </button>
        )}

        {/* History */}
        {entries.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--muted)]">No weight entries yet</p>
            <p className="text-sm text-[var(--muted)]">Log your first weigh-in above</p>
          </div>
        ) : (
          <div className="space-y-2">
            <h3 className="text-sm text-[var(--muted)]">Recent Entries</h3>
            {entries.slice(0, 20).map((entry) => (
              <div
                key={entry.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <span className="font-medium">{entry.weight_kg}kg</span>
                  <span className="text-sm text-[var(--muted)] ml-3">
                    {formatDate(entry.measured_date)}
                  </span>
                  {entry.notes && (
                    <span className="text-sm text-[var(--muted)] ml-2 italic">
                      {entry.notes}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="text-xs text-red-400 hover:bg-red-400/10 px-2 py-1 rounded"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
