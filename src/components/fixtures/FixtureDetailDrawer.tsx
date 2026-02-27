"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  arrayUnion,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import {
  PROCUREMENT_STATUSES,
  SUBMITTAL_STATUSES,
  getPhaseLabel,
  type JobFixture,
  type ProcurementStatus,
  type SubmittalStatus,
} from "@/types/fixtures";
import { Timestamp } from "firebase/firestore";

// ── Helpers ──────────────────────────────────────────────────────────────────

function tsToIso(ts: Timestamp | null | undefined): string {
  if (!ts) return "";
  return ts.toDate().toISOString().slice(0, 10);
}

function isoToTs(val: string): Timestamp | null {
  if (!val) return null;
  return Timestamp.fromDate(new Date(val));
}

async function lookupSpecSheet(manufacturer: string | null, model: string | null): Promise<string | null> {
  if (!manufacturer || !model) return null;
  const snap = await getDocs(
    query(
      collection(db, "specSheetLibrary"),
      where("manufacturerKey", "==", manufacturer.toLowerCase()),
      where("modelKey", "==", model.toLowerCase())
    )
  );
  return snap.empty ? null : (snap.docs[0].data().url as string);
}

async function saveToLibrary(manufacturer: string, model: string, url: string) {
  const key = `${manufacturer.toLowerCase()}__${model.toLowerCase()}`;
  await setDoc(doc(db, "specSheetLibrary", key), {
    manufacturerKey: manufacturer.toLowerCase(),
    modelKey: model.toLowerCase(),
    manufacturer,
    model,
    url,
    uploadedBy: auth.currentUser?.uid ?? "unknown",
    uploadedAt: serverTimestamp(),
  });
}

// ── Form state type ───────────────────────────────────────────────────────────

interface FormData {
  // Procurement
  vendor: string;
  actualUnitPrice: string;
  dateNeededBy: string;
  dateOrdered: string;
  eta: string;
  dateDelivered: string;
  poNumber: string;
  notes: string;
  webLink: string;
  // Status
  procurementStatus: ProcurementStatus;
  submittalStatus: SubmittalStatus;
}

function fixtureToForm(f: JobFixture): FormData {
  return {
    vendor: f.vendor ?? "",
    actualUnitPrice: f.actualUnitPrice !== null ? String(f.actualUnitPrice) : "",
    dateNeededBy: tsToIso(f.dateNeededBy),
    dateOrdered: tsToIso(f.dateOrdered),
    eta: tsToIso(f.eta),
    dateDelivered: tsToIso(f.dateDelivered),
    poNumber: f.poNumber ?? "",
    notes: f.notes ?? "",
    webLink: f.webLink ?? "",
    procurementStatus: f.procurementStatus,
    submittalStatus: f.submittalStatus,
  };
}

function isDirty(form: FormData, original: JobFixture): boolean {
  const orig = fixtureToForm(original);
  return (Object.keys(form) as (keyof FormData)[]).some((k) => form[k] !== orig[k]);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  fixture: JobFixture | null;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FixtureDetailDrawer({ fixture, onClose }: Props) {
  const [form, setForm] = useState<FormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Spec sheet upload
  const [specUploadProgress, setSpecUploadProgress] = useState<number | null>(null);
  const [specUploadError, setSpecUploadError] = useState("");
  const specFileRef = useRef<HTMLInputElement>(null);

  // Attachments upload
  const [attUploadProgress, setAttUploadProgress] = useState<number | null>(null);
  const [attUploadError, setAttUploadError] = useState("");
  const attFileRef = useRef<HTMLInputElement>(null);

  // Spec details collapsible
  const [showDetails, setShowDetails] = useState(false);

  // Initialize / reset form when fixture changes
  useEffect(() => {
    if (!fixture) {
      setForm(null);
      setShowDetails(false);
      setSpecUploadProgress(null);
      setSpecUploadError("");
      setAttUploadProgress(null);
      setAttUploadError("");
      setSaveError("");
      return;
    }
    setForm(fixtureToForm(fixture));
  }, [fixture?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fixture || !form) return null;

  function set(field: keyof FormData, value: string) {
    setForm((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  function handleClose() {
    if (isDirty(form, fixture!)) {
      if (!window.confirm("You have unsaved changes. Discard them?")) return;
    }
    onClose();
  }

  async function handleSave() {
    if (!fixture) return;
    setSaving(true);
    setSaveError("");
    try {
      const actualPrice = form.actualUnitPrice.trim()
        ? parseFloat(form.actualUnitPrice)
        : null;
      await updateDoc(doc(db, "jobFixtures", fixture.id), {
        vendor: form.vendor.trim() || null,
        actualUnitPrice: isNaN(actualPrice as number) ? null : actualPrice,
        dateNeededBy: isoToTs(form.dateNeededBy),
        dateOrdered: isoToTs(form.dateOrdered),
        eta: isoToTs(form.eta),
        dateDelivered: isoToTs(form.dateDelivered),
        poNumber: form.poNumber.trim() || null,
        notes: form.notes.trim() || null,
        webLink: form.webLink.trim() || null,
        procurementStatus: form.procurementStatus,
        submittalStatus: form.submittalStatus,
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch {
      setSaveError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSpecSheetUpload(file: File) {
    if (!fixture) return;
    setSpecUploadError("");
    setSpecUploadProgress(0);
    const storageRef = ref(storage, `specSheets/${fixture.jobId}/${fixture.id}.pdf`);
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      "state_changed",
      (snap) => setSpecUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      () => {
        setSpecUploadError("Upload failed. Please try again.");
        setSpecUploadProgress(null);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await updateDoc(doc(db, "jobFixtures", fixture.id), {
          specSheetUrl: url,
          updatedAt: serverTimestamp(),
        });
        // Save to spec sheet library if manufacturer + model known
        if (fixture.manufacturer && fixture.model) {
          await saveToLibrary(fixture.manufacturer, fixture.model, url);
        }
        setSpecUploadProgress(null);
        if (specFileRef.current) specFileRef.current.value = "";
      }
    );
  }

  async function handleAttachmentUpload(file: File) {
    if (!fixture) return;
    const currentCount = fixture.attachments?.length ?? 0;
    if (currentCount >= 3) {
      setAttUploadError("Maximum 3 attachments per fixture.");
      return;
    }
    setAttUploadError("");
    setAttUploadProgress(0);
    const storageRef = ref(storage, `attachments/${fixture.jobId}/${fixture.id}/${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      "state_changed",
      (snap) => setAttUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      () => {
        setAttUploadError("Upload failed. Please try again.");
        setAttUploadProgress(null);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await updateDoc(doc(db, "jobFixtures", fixture.id), {
          attachments: arrayUnion(url),
          updatedAt: serverTimestamp(),
        });
        setAttUploadProgress(null);
        if (attFileRef.current) attFileRef.current.value = "";
      }
    );
  }

  const phaseBadge = `inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-gray-900/40"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[620px] max-w-full bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={phaseBadge}>{getPhaseLabel(fixture.costCode)}</span>
              {fixture.manufacturer && (
                <span className="text-xs text-gray-400">{fixture.manufacturer}</span>
              )}
            </div>
            <h2 className="text-base font-semibold text-gray-900 leading-snug">
              {fixture.description}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Qty {fixture.quantity}
              {fixture.size ? ` · ${fixture.size}` : ""}
              {fixture.model ? ` · ${fixture.model}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Section A — Status */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Procurement</label>
                <select
                  value={form.procurementStatus}
                  onChange={(e) => set("procurementStatus", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {PROCUREMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Submittal</label>
                <select
                  value={form.submittalStatus}
                  onChange={(e) => set("submittalStatus", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {SUBMITTAL_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Section B — Sourcing */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Sourcing</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
                <input
                  type="text"
                  value={form.vendor}
                  onChange={(e) => set("vendor", e.target.value)}
                  placeholder="Vendor name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Actual Unit Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.actualUnitPrice}
                    onChange={(e) => set("actualUnitPrice", e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 pl-6 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {fixture.budgetUnitPrice !== null && (
                  <p className="text-xs text-gray-400 mt-1">Budget: {fmt(fixture.budgetUnitPrice)}</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">PO Number</label>
              <input
                type="text"
                value={form.poNumber}
                onChange={(e) => set("poNumber", e.target.value)}
                placeholder="PO-1234"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Web Link</label>
              <input
                type="url"
                value={form.webLink}
                onChange={(e) => set("webLink", e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </section>

          {/* Section C — Dates */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Dates</h3>
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ["dateNeededBy", "Needed By"],
                  ["dateOrdered", "Ordered"],
                  ["eta", "ETA"],
                  ["dateDelivered", "Delivered"],
                ] as [keyof FormData, string][]
              ).map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    type="date"
                    value={form[field] as string}
                    onChange={(e) => set(field, e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Section D — Notes */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Notes</h3>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="Internal notes…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </section>

          {/* Section E — Spec sheet */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Spec Sheet</h3>
            {fixture.specSheetUrl ? (
              <div className="flex items-center gap-3">
                <a
                  href={fixture.specSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 hover:underline truncate"
                >
                  View current spec sheet →
                </a>
                <span className="text-xs text-gray-400 shrink-0">Replace:</span>
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              <input
                ref={specFileRef}
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleSpecSheetUpload(file);
                }}
                className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
              {specUploadProgress !== null && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-24 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${specUploadProgress}%` }}
                    />
                  </div>
                  {specUploadProgress}%
                </div>
              )}
            </div>
            {specUploadError && <p className="text-xs text-red-500">{specUploadError}</p>}
          </section>

          {/* Section F — Attachments */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Attachments
              <span className="ml-1.5 font-normal text-gray-400 normal-case">
                ({fixture.attachments?.length ?? 0}/3)
              </span>
            </h3>
            {(fixture.attachments ?? []).length > 0 && (
              <ul className="space-y-1">
                {(fixture.attachments ?? []).map((url, i) => {
                  const name = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? `File ${i + 1}`);
                  return (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-600 hover:underline truncate block"
                      >
                        {name}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
            {(fixture.attachments?.length ?? 0) < 3 && (
              <div className="flex items-center gap-3">
                <input
                  ref={attFileRef}
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAttachmentUpload(file);
                  }}
                  className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-100"
                />
                {attUploadProgress !== null && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-24 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${attUploadProgress}%` }}
                      />
                    </div>
                    {attUploadProgress}%
                  </div>
                )}
              </div>
            )}
            {attUploadError && <p className="text-xs text-red-500">{attUploadError}</p>}
          </section>

          {/* Section G — Item details (collapsible) */}
          <section>
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600"
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-90" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
              Item Details
            </button>
            {showDetails && (
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ["Material Group", fixture.materialGroup],
                  ["Cost Code", fixture.costCode],
                  ["Phase", getPhaseLabel(fixture.costCode)],
                  ["Manufacturer", fixture.manufacturer ?? "—"],
                  ["Model", fixture.model ?? "—"],
                  ["Budget Unit Price", fixture.budgetUnitPrice !== null ? fmt(fixture.budgetUnitPrice) : "—"],
                  ["Size", fixture.size ?? "—"],
                  ["Estimate ID", fixture.estimateId],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-gray-400">{label}</dt>
                    <dd className="font-medium text-gray-800 break-all">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-4">
          {saveError && <p className="text-sm text-red-500">{saveError}</p>}
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isDirty(form, fixture)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
