import { type ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="grain flex h-screen w-screen overflow-hidden bg-canvas">
      <Sidebar />
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </main>
      <div className="grain-overlay" />
    </div>
  );
}
