"use client";

import SettingsContent from "@/components/settings/SettingsContent";

export default function DashboardSettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Settings</h1>
      <SettingsContent />
    </div>
  );
}
