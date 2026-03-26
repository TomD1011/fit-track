"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import InstallPrompt from "@/components/InstallPrompt";

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
  const [programmeCount, setProgrammeCount] = useState(0);
  const [clientCount, setClientCount] = useState(0);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (data) {
        setProfile(data as Profile);

        // Load counts for coach
        if (data.role === "coach") {
          const { count: progCount } = await supabase
            .from("programmes")
            .select("*", { count: "exact", head: true })
            .eq("coach_id", session.user.id);
          setProgrammeCount(progCount || 0);

          const { count: cCount } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("role", "client");
          setClientCount(cCount || 0);
        }
      }
      setLoading(false);
    }

    loadProfile();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        userName={profile?.name}
        userRole={profile?.role}
      />

      <InstallPrompt />

      <main className="max-w-lg mx-auto px-4 py-6">
        {profile?.role === "coach" ? (
          <CoachDashboard
            programmeCount={programmeCount}
            clientCount={clientCount}
          />
        ) : (
          <ClientDashboard />
        )}
      </main>
    </div>
  );
}

function CoachDashboard({
  programmeCount,
  clientCount,
}: {
  programmeCount: number;
  clientCount: number;
}) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      <button
        onClick={() => router.push("/programmes")}
        className="w-full text-left bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between hover:border-[var(--accent)] transition-colors"
      >
        <div>
          <h3 className="font-medium">Programmes</h3>
          <p className="text-sm text-[var(--muted)]">
            Build and manage workout programmes
          </p>
        </div>
        {programmeCount > 0 && (
          <span className="bg-[var(--accent)] text-white text-sm px-3 py-1 rounded-full">
            {programmeCount}
          </span>
        )}
      </button>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between">
        <div>
          <h3 className="font-medium">Clients</h3>
          <p className="text-sm text-[var(--muted)]">
            {clientCount > 0
              ? `${clientCount} registered client${clientCount !== 1 ? "s" : ""}`
              : "No clients registered yet"}
          </p>
        </div>
        {clientCount > 0 && (
          <span className="bg-[var(--accent)] text-white text-sm px-3 py-1 rounded-full">
            {clientCount}
          </span>
        )}
      </div>
    </div>
  );
}

function ClientDashboard() {
  const router = useRouter();

  return (
    <div className="space-y-3">
      <button
        onClick={() => router.push("/workout")}
        className="w-full text-left bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between hover:border-[var(--accent)] transition-colors"
      >
        <div>
          <h3 className="font-medium">Start Workout</h3>
          <p className="text-sm text-[var(--muted)]">
            View your programme and log today&apos;s session
          </p>
        </div>
        <span className="text-[var(--accent)] text-lg">&#8594;</span>
      </button>

      <button
        onClick={() => router.push("/workout/history")}
        className="w-full text-left bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between hover:border-[var(--accent)] transition-colors"
      >
        <div>
          <h3 className="font-medium">Workout History</h3>
          <p className="text-sm text-[var(--muted)]">
            See your completed workouts
          </p>
        </div>
        <span className="text-[var(--accent)] text-lg">&#8594;</span>
      </button>

      <button
        onClick={() => router.push("/bodyweight")}
        className="w-full text-left bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between hover:border-[var(--accent)] transition-colors"
      >
        <div>
          <h3 className="font-medium">Body Weight</h3>
          <p className="text-sm text-[var(--muted)]">
            Track your weight over time
          </p>
        </div>
        <span className="text-[var(--accent)] text-lg">&#8594;</span>
      </button>
    </div>
  );
}
