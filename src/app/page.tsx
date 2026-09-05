import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center">
      <Image src="/Logo.png" alt="MinePilot" width={190} height={90} className="h-65 w-65" priority /> 
      {/* <h1 className="text-3xl font-bold mb-2">MinePilot</h1> */}
      <p className="text-neutral-400 max-w-md mb-10">
        AI-based smart mine digital twin — live hazard telemetry, predictive
        risk scoring, and incident governance.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/login"
          className="bg-white/10 hover:bg-white/20 rounded-xl px-6 py-4 min-w-[220px] text-left transition-colors"
        >
          <p className="font-semibold">Mine Manager</p>
          <p className="text-sm text-neutral-400">
            Live risk overview & incident sign-off
          </p>
        </Link>
        <Link
          href="/login"
          className="bg-white/10 hover:bg-white/20 rounded-xl px-6 py-4 min-w-[220px] text-left transition-colors"
        >
          <p className="font-semibold">Field Worker</p>
          <p className="text-sm text-neutral-400">
            Assigned alerts & resolution workflow
          </p>
        </Link>
      </div>
    </main>
  );
}