"use client";

import { useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db, getFirebaseAuth } from "@/lib/firebase";

// ---------------------------------------------------------------------------
// Hardcoded Airtable data — 13 jobs + 10 companies + activity log entries
// ---------------------------------------------------------------------------

type RawJob = {
  jobName: string;
  projectPhase: string;
  gcName?: string;
  siteAddress?: string;
  siteCity?: string;
  siteState?: string;
  siteZip?: string;
  originalContractValue?: number;
  notes?: string; // combined notes → activity entry
};

const AIRTABLE_JOBS: RawJob[] = [
  {
    jobName: "81 Vine St (Olsen Resi)",
    projectPhase: "Active",
    gcName: "Chain Construction",
    siteAddress: "81 Vine St",
    siteCity: "Seattle",
    siteState: "WA",
  },
  {
    jobName: "Cherry Street Farms (HHIG)",
    projectPhase: "Active",
    gcName: "Sawhorse Revolution",
    siteAddress: "1911 E Cherry St",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98122",
  },
  {
    jobName: "Circle Wellness",
    projectPhase: "Active",
    gcName: "Dovetail",
    siteAddress: "1326 N Northlake Way",
    siteCity: "Seattle",
    siteState: "WA",
  },
  {
    jobName: "Death & Co",
    projectPhase: "Active",
    gcName: "Wilcox",
    siteAddress: "419 Occidental Ave S",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98104",
    originalContractValue: 315352.59,
  },
  {
    jobName: "FS8 Dexter",
    projectPhase: "Active",
    gcName: "Jalen WA LLC",
    siteAddress: "700 Dexter Ave N",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98109",
    originalContractValue: 61000,
  },
  {
    jobName: "Good Mart",
    projectPhase: "Active",
    gcName: "Dovetail",
    siteAddress: "5130 Ballard Ave NW",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98107",
  },
  {
    jobName: "Graduate Hotel 3",
    projectPhase: "Active",
    gcName: "Metis Construction",
    siteAddress: "4507 Brooklyn Ave NE",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98105",
    originalContractValue: 75275.65,
  },
  {
    jobName: "Insignia Towers",
    projectPhase: "Awarded",
    gcName: "Driftwood",
    siteAddress: "583 Battery St",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98121",
  },
  {
    jobName: "Miro Tea House",
    projectPhase: "Active",
    gcName: "Dolan Build",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98104",
    originalContractValue: 35985.39,
  },
  {
    jobName: "Shane Robinson (OliveST)",
    projectPhase: "Active",
    siteAddress: "2814 E Olive St",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98122",
  },
  {
    jobName: "Shawn O'Donells",
    projectPhase: "Active",
    siteAddress: "508 2nd Ave",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98104",
  },
  {
    jobName: "Stevie's Famous",
    projectPhase: "Active",
    gcName: "BMDC",
    siteAddress: "6000 Phinney Ave N",
    siteCity: "Seattle",
    siteState: "WA",
    originalContractValue: 106000,
  },
  {
    jobName: "T&C Pavillion",
    projectPhase: "Active",
    gcName: "Mallet",
    siteAddress: "1420 NW 56th St",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98107",
  },
];

const AIRTABLE_COMPANIES = [
  "Chain Construction",
  "Sawhorse Revolution",
  "Dovetail",
  "Wilcox",
  "Jalen WA LLC",
  "Metis Construction",
  "Dolan Build",
  "Driftwood",
  "BMDC",
  "Mallet",
];

// ---------------------------------------------------------------------------

type StepStatus = "idle" | "running" | "done" | "error";

type ImportLog = {
  message: string;
  type: "info" | "success" | "error" | "warn";
};

export default function ImportPage() {
  const [log, setLog] = useState<ImportLog[]>([]);
  const [status, setStatus] = useState<StepStatus>("idle");

  function addLog(message: string, type: ImportLog["type"] = "info") {
    setLog((prev) => [...prev, { message, type }]);
  }

  async function runImport() {
    setLog([]);
    setStatus("running");

    const auth = (() => {
      try {
        return getFirebaseAuth();
      } catch {
        return null;
      }
    })();

    const userEmail = auth?.currentUser?.email ?? "import@parker";

    try {
      // ── 1. Companies ──────────────────────────────────────────────────────
      addLog("Importing companies…");
      const companyIds: Record<string, string> = {};

      for (const name of AIRTABLE_COMPANIES) {
        // Check if already exists
        const existing = await getDocs(
          query(collection(db, "companies"), where("name", "==", name))
        );
        if (!existing.empty) {
          companyIds[name] = existing.docs[0].id;
          addLog(`  ↳ ${name} already exists — skipped`, "warn");
          continue;
        }
        const ref = await addDoc(collection(db, "companies"), {
          name,
          type: "GC",
          createdAt: serverTimestamp(),
          createdBy: userEmail,
        });
        companyIds[name] = ref.id;
        addLog(`  ↳ Created: ${name}`, "success");
      }

      // ── 2. Jobs ───────────────────────────────────────────────────────────
      addLog("\nImporting jobs…");

      for (const raw of AIRTABLE_JOBS) {
        // Check if already exists
        const existing = await getDocs(
          query(collection(db, "Jobs"), where("jobName", "==", raw.jobName))
        );
        if (!existing.empty) {
          addLog(`  ↳ ${raw.jobName} already exists — skipped`, "warn");
          continue;
        }

        const gcId = raw.gcName ? (companyIds[raw.gcName] ?? undefined) : undefined;

        const jobData: Record<string, unknown> = {
          jobName: raw.jobName,
          projectPhase: raw.projectPhase,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userEmail,
        };

        if (raw.gcName) jobData.gcName = raw.gcName;
        if (gcId) jobData.gcId = gcId;
        if (raw.siteAddress) jobData.siteAddress = raw.siteAddress;
        if (raw.siteCity) jobData.siteCity = raw.siteCity;
        if (raw.siteState) jobData.siteState = raw.siteState;
        if (raw.siteZip) jobData.siteZip = raw.siteZip;
        if (raw.originalContractValue) {
          jobData.originalContractValue = raw.originalContractValue;
          jobData.currentContractValue = raw.originalContractValue;
        } else {
          jobData.currentContractValue = 0;
        }

        const jobRef = await addDoc(collection(db, "Jobs"), jobData);

        // Seed activity note if we have notes
        if (raw.notes) {
          await addDoc(collection(db, "Jobs", jobRef.id, "activity"), {
            text: `[Imported from Airtable]\n\n${raw.notes}`,
            tag: "General",
            createdAt: serverTimestamp(),
            createdBy: userEmail,
            createdByName: "Airtable Import",
          });
        }

        addLog(`  ↳ Created: ${raw.jobName} (${raw.projectPhase})`, "success");
      }

      addLog("\nImport complete!", "success");
      setStatus("done");
    } catch (err) {
      addLog(
        `\nError: ${err instanceof Error ? err.message : String(err)}`,
        "error"
      );
      setStatus("error");
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Airtable Import</h1>
          <p className="mt-1 text-sm text-gray-600">
            One-time import of 13 jobs and 10 companies from Airtable into
            Firestore. Safe to run multiple times — existing records are
            skipped.
          </p>
        </div>

        {/* Preview */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">
            What will be imported
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">
                Jobs ({AIRTABLE_JOBS.length})
              </p>
              <ul className="space-y-0.5">
                {AIRTABLE_JOBS.map((j) => (
                  <li key={j.jobName} className="text-xs text-gray-700">
                    {j.jobName}{" "}
                    <span className="text-gray-400">({j.projectPhase})</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">
                Companies ({AIRTABLE_COMPANIES.length})
              </p>
              <ul className="space-y-0.5">
                {AIRTABLE_COMPANIES.map((c) => (
                  <li key={c} className="text-xs text-gray-700">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Run button */}
        <button
          type="button"
          onClick={runImport}
          disabled={status === "running"}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {status === "running" ? "Importing…" : "Run Import"}
        </button>

        {/* Log output */}
        {log.length > 0 && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-900 p-5">
            <pre className="text-xs leading-relaxed">
              {log.map((entry, i) => (
                <div
                  key={i}
                  className={
                    entry.type === "success"
                      ? "text-green-400"
                      : entry.type === "error"
                      ? "text-red-400"
                      : entry.type === "warn"
                      ? "text-yellow-400"
                      : "text-gray-300"
                  }
                >
                  {entry.message}
                </div>
              ))}
            </pre>
          </div>
        )}
      </div>
    </AppShell>
  );
}
