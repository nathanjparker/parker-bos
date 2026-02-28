"use client";

import { useEffect, useMemo, useState } from "react";
import {
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db, getFirebaseAuth } from "@/lib/firebase";
import {
  GAP_REASON_LABELS,
  getSessionCapacity,
  SESSION_TYPE_LABELS,
  type GapReason,
  type ScheduleSession,
} from "@/types/scheduling";

interface Props {
  session: ScheduleSession;
  onClose: () => void;
  onComplete: () => void;
}

type GapOption = "ready" | GapReason;

const GAP_OPTIONS: Array<{ value: GapOption; label: string }> = [
  { value: "ready", label: "Ready for next session" },
  ...Object.entries(GAP_REASON_LABELS).map(([k, v]) => ({
    value: k as GapReason,
    label: v,
  })),
];

export default function SessionCompletionModal({ session, onClose, onComplete }: Props) {
  const [note, setNote] = useState("");
  const [enhanced, setEnhanced] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [loggedHours, setLoggedHours] = useState(() =>
    String(Math.round(getSessionCapacity(session)))
  );
  const [gapOption, setGapOption] = useState<GapOption>("ready");
  const [gapNote, setGapNote] = useState("");
  const [gapDate, setGapDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);

  // Check for SpeechRecognition support
  const hasSpeech = useMemo(() => {
    if (typeof window === "undefined") return false;
    return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  }, []);

  // Start voice recognition
  function startListening() {
    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new (SpeechRecognition as new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: () => void;
      stop: () => void;
      onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
    })();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setNote((prev) => (prev ? prev + " " + transcript : transcript));
      setEnhanced(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    setListening(true);
    recognition.start();
  }

  // AI Enhancement
  async function handleEnhance() {
    if (!note.trim()) return;
    setEnhancing(true);
    try {
      const res = await fetch("/api/enhance-session-note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });
      const data = await res.json();
      if (data.enhanced) {
        setNote(data.enhanced);
        setEnhanced(true);
      }
    } catch {
      // Silently fail — user keeps their raw note
    } finally {
      setEnhancing(false);
    }
  }

  // Save
  async function handleSave() {
    setSaving(true);
    try {
      const auth = getFirebaseAuth();
      const uid = auth.currentUser?.uid ?? "unknown";

      const gapInfo =
        gapOption !== "ready"
          ? {
              waitingOn: gapOption,
              waitingNote: gapNote.trim() || null,
              earliestReturnDate: gapDate
                ? Timestamp.fromDate(new Date(gapDate + "T00:00:00"))
                : null,
            }
          : null;

      await updateDoc(doc(db, "scheduleSessions", session.id), {
        status: "completed",
        completionNote: note.trim() || null,
        completedAt: serverTimestamp(),
        completedBy: uid,
        loggedHours: loggedHours ? Number(loggedHours) : null,
        gapInfo,
        updatedAt: serverTimestamp(),
      });

      onComplete();
    } catch (err) {
      console.error("Failed to complete session:", err);
    } finally {
      setSaving(false);
    }
  }

  // Format dates for summary
  const startStr = session.startDate?.toDate?.()?.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endStr = session.endDate?.toDate?.()?.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900/60 p-0 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4 rounded-t-2xl">
          <h2 className="text-base font-bold text-gray-900">Complete Session</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Session Summary */}
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 space-y-1 text-sm">
            <div className="font-semibold text-gray-900">{session.jobName}</div>
            <div className="text-gray-600">
              {session.sessionType === "phase-work"
                ? session.phaseLabel
                : SESSION_TYPE_LABELS[session.sessionType]}
            </div>
            <div className="text-gray-500 text-xs">
              {startStr}
              {endStr && endStr !== startStr ? ` – ${endStr}` : ""}
              {" · "}
              {session.assignedCrew.map((c) => c.employeeName.split(" ")[0]).join(", ")}
            </div>
          </div>

          {/* Completion Note */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-gray-700">Completion Note</label>
              <div className="flex items-center gap-2">
                {enhanced && (
                  <span className="text-[10px] font-semibold text-green-600">Enhanced ✓</span>
                )}
                {hasSpeech && (
                  <button
                    type="button"
                    onClick={startListening}
                    disabled={listening}
                    className={`rounded-lg p-1.5 transition-colors ${
                      listening
                        ? "bg-red-100 text-red-600 animate-pulse"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                    title={listening ? "Listening…" : "Voice input"}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setEnhanced(false);
              }}
              rows={4}
              placeholder="What was accomplished? Any issues or notes…"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {note.trim() && !enhanced && (
              <button
                type="button"
                onClick={handleEnhance}
                disabled={enhancing}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {enhancing ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                    Enhancing…
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                    Enhance with AI
                  </>
                )}
              </button>
            )}
          </div>

          {/* Logged Hours */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Total Hours Worked
            </label>
            <input
              type="number"
              value={loggedHours}
              onChange={(e) => setLoggedHours(e.target.value)}
              min="0"
              step="0.5"
              className="block w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Gap Tracking */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              What&apos;s next for this phase?
            </label>
            <select
              value={gapOption}
              onChange={(e) => setGapOption(e.target.value as GapOption)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {GAP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {gapOption !== "ready" && (
              <div className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    What specifically are you waiting on?
                  </label>
                  <textarea
                    value={gapNote}
                    onChange={(e) => setGapNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. Waiting on east wing framing inspection"
                    className="block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Earliest expected return date
                  </label>
                  <input
                    type="date"
                    value={gapDate}
                    onChange={(e) => setGapDate(e.target.value)}
                    className="block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-gray-100 bg-white px-5 py-4 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Mark Complete"}
          </button>
        </div>
      </div>
    </div>
  );
}
