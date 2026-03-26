"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type HeaderProps = {
  title?: string;
  backHref?: string;
  userName?: string;
  userRole?: string;
  showSignOut?: boolean;
};

export default function Header({
  title = "FitTrack",
  backHref,
  userName,
  userRole,
  showSignOut = true,
}: HeaderProps) {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <header className="border-b border-[var(--border)] px-4 py-4">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {backHref && (
            <button
              onClick={() => router.push(backHref)}
              className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
              aria-label="Go back"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 10H5M5 10L10 5M5 10L10 15" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold">{title}</h1>
            {userName && (
              <p className="text-sm text-[var(--muted)]">
                {userName} ({userRole})
              </p>
            )}
          </div>
        </div>
        {showSignOut && (
          <button
            onClick={handleSignOut}
            className="text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
