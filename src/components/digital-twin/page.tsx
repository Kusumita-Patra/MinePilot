"use client";

import dynamic from "next/dynamic";

/**
 * WebGL cannot run during server rendering, so the screen is loaded with
 * `ssr: false`. `next/dynamic` with that flag is only allowed inside a Client
 * Component, which is why this file carries the "use client" directive.
 */
const DigitalTwinScreen = dynamic(() => import("./DigitalTwinScreen"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-[#0a0d12] text-slate-400">
      Loading mine view…
    </div>
  ),
});

export default function Page() {
  return <DigitalTwinScreen />;
}
