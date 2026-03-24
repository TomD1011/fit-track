"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  name: string;
  email: string;
  role: "coach" | "client";
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (data) setProfile(data as Profile);
      setLoading(false);
    }
    loadProfile();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (<div className="flex items-center justify-center min-h-screen"><p className="text-[var(--muted)]">Loading...</p></div>);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">FitTrack</h1>
            <p className="text-sm text-[var(--muted)]">{profile?.name} ({profile?.role})</p>
          </div>
          <button onClick={handleSignOut} className="text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors">Sign out</button>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        {profile?.role === "coach" ? <CoachDashboard /> : <ClientDashboard />}
      </main>
    </div>
  );
}

function CoachDashboard() {
  return (
    <div className="space-y-6">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-2">Coach Dashboard</h2>
        <p className="text-[var(--muted)]">This is where you'll build and manage programmes for your clients.</p>
      </div>
      <div className="space-y-3">
        <DashboardCard title="Programmes" description="Create and manage workout programmes" count={0} />
        <DashboardCard title="Clients" description="View your assigned clients" count={0} />
      </div>
      <p className="text-center text-sm text-[var(--muted)] pt-4">Programme builder coming in Phase 2</p>
    </div>
  );
}

function ClientDashboard() {
  return (
    <div className="space-y-6">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-2">Your Workouts</h2>
        <p className="text-[var(--muted)]">Your assigned programmes will appear here.</p>
      </div>
      <div className="space-y-3">
        <DashboardCard title="Today's Workout" description="No programme assigned yet" count={0} />
        <DashboardCard title="Body Weight" description="Track your weight over time" count={0} />
      </div>
      <p className="text-center text-sm text-[var(--muted)] pt-4">Workout tracking coming in Phase 3</p>
    </div>
  );
}

function DashboardCard({ title, description, count }: { title: string; description: string; count: number }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between">
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-[var(--muted)]">{description}</p>
      </div>
      {count > 0 && <span className="bg-[var(--accent)] text-white text-sm px-3 py-1 rounded-full">{count}</span>}
    </div>
  );
}
