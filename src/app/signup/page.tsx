"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { register, login } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";

// Public signup only ever creates these two roles — administrator accounts
// are never self-registerable (see backend/scripts/promote_to_admin.py).
type SelfRegisterableRole = "mine_manager" | "field_worker";

export default function SignupPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SelfRegisterableRole>("mine_manager");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({ email, password, full_name: fullName, role });
      // Register doesn't return a token, so sign the new user straight in.
      const { access_token, user } = await login(email, password);
      setAuth(access_token, user);
      router.replace(user.role === "mine_manager" ? "/dashboard" : "/field");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
          <h1 className="text-lg font-bold">Create an account</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Sign up as a mine manager or a field worker.
          </p>
        </div>

        <div>
          <label className="text-[11px] text-neutral-400 block mb-1">Full name</label>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md bg-black/30 border border-white/10 p-2 text-sm"
            placeholder="Jane Doe"
          />
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md bg-black/30 border border-white/10 p-2 text-sm"
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label className="text-[11px] text-neutral-400 block mb-2">I am a…</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole("mine_manager")}
              className={`rounded-md py-2 text-sm font-medium border ${
                role === "mine_manager"
                  ? "bg-blue-600 border-blue-500"
                  : "bg-black/30 border-white/10 text-neutral-400"
              }`}
            >
              Mine Manager
            </button>
            <button
              type="button"
              onClick={() => setRole("field_worker")}
              className={`rounded-md py-2 text-sm font-medium border ${
                role === "field_worker"
                  ? "bg-blue-600 border-blue-500"
                  : "bg-black/30 border-white/10 text-neutral-400"
              }`}
            >
              Field Worker
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-md py-2 text-sm font-medium"
        >
          {busy ? "Creating account…" : "Create account"}
        </button>

        <p className="text-xs text-neutral-500 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-400 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
