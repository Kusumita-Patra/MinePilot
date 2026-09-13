"use client";

import WorkerLocationsPanel from "@/components/workers/WorkerLocationsPanel";

export default function AdminWorkerLocationsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Worker Locations</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Live geotagged position of every field worker inside the mine, on the same 3D digital twin used elsewhere
          in this platform.
        </p>
      </div>
      <WorkerLocationsPanel />
    </div>
  );
}
