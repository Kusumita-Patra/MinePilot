"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { login } from "@/lib/api";
import { useAuthStore, type UserRole } from "@/lib/authStore";

const ROLE_HOME: Record<UserRole, string> = {
  administrator: "/admin",
  mine_manager: "/dashboard",
  field_worker: "/field",
};

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { access_token, user } = await login(email, password);
      setAuth(access_token, user);
      router.replace(ROLE_HOME[user.role]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-white p-6">
      <Image src="/Logo.png" alt="MinePilot" width={140} height={66} className="mb-6" priority />

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-xl p-6 space-y-4"
      >
        <div>
          <h1 className="text-lg font-bold">Sign in</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Mine manager and field worker accounts both sign in here.
          </p>
        </div>

        <div>
          <label className="text-[11px] text-neutral-400 block mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md bg-black/30 border border-white/10 p-2 text-sm"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="text-[11px] text-neutral-400 block mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md bg-black/30 border border-white/10 p-2 text-sm"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-md py-2 text-sm font-medium"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-xs text-neutral-500 text-center">
          New here?{" "}
          <Link href="/signup" className="text-blue-400 hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </main>
  );
}
