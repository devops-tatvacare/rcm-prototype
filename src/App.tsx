import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { PayorIntel } from "@/features/payor-intel/PayorIntel";
import { EligibilityPage } from "@/features/eligibility/EligibilityPage";
import { ClearancesPage } from "@/features/clearances/ClearancesPage";
import { EvidenceDrawer } from "@/features/payor-intel/EvidenceDrawer";
import { WorklistPage } from "@/features/worklist/WorklistPage";
import { getDb } from "@/lib/db";

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    getDb().then(() => setReady(true));
  }, []);

  return (
    <AppShell>
      <EvidenceDrawer />
      <AnimatePresence mode="wait">
        {!ready ? (
          <motion.div
            key="boot"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex h-full items-center justify-center"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-champagne)]/12 ring-1 ring-[var(--color-champagne)]/30" />
                <div className="pulse-ring absolute inset-0 rounded-xl ring-1 ring-[var(--color-champagne)]/40" />
              </div>
              <div className="font-mono-tight text-[11px] tracking-[0.2em] text-ink-faint uppercase">
                Hydrating in-browser ledger…
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/worklist" element={<WorklistPage />} />
              <Route path="/payors" element={<PayorIntel />} />
              {/* Hidden but reachable */}
              <Route path="/eligibility" element={<EligibilityPage />} />
              <Route path="/clearances" element={<ClearancesPage />} />
              {/* Old per-stage pages → redirect into Worklist with silo preset */}
              <Route path="/case-review" element={<Navigate to="/worklist?silo=concurrent" replace />} />
              <Route path="/builder" element={<Navigate to="/worklist?silo=postdischarge" replace />} />
              <Route path="/denials" element={<Navigate to="/worklist?silo=postdischarge&filter=awaitingHuman" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
