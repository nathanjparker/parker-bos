"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { Timestamp } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import {
  ATTACHMENT_TYPES,
  PROCUREMENT_STATUSES,
  SUBMITTAL_STATUSES,
  getPhaseLabel,
  type AttachmentType,
  type FixtureAttachment,
  type JobFixture,
  type ProcurementStatus,
  type SpecSheetLibraryEntry,
  type SubmittalStatus,
} from "@/types/fixtures";
import SpecSheetLibraryModal from "./SpecSheetLibraryModal";

// ── Helpers ──────────────────────────────────────────────────────────────────

function tsToIso(ts: Timestamp | null | undefined): string {
  if (!ts || typeof ts.toDate !== "function") return "";
  return ts.toDate().toISOString().slice(0, 10);
}

function isoToTs(val: string): Timestamp | null {
  if (!val) return null;
  return Timestamp.fromDate(new Date(val));
}

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ── Form state ───────────────────────────────────────────────────────────────

interface FormData {
  description: string;
  quantity: string;
  size: string;
  manufacturer: string;
  model: string;
  webLink: string;
  vendor: string;
  actualUnitPrice: string;
  procurementStatus: ProcurementStatus;
  dateNeededBy: string;
  dateOrdered: string;
  eta: string;
  dateDelivered: string;
  poNumber: string;
  submittalStatus: SubmittalStatus;
  notes: string;
}

function fixtureToForm(f: JobFixture): FormData {
  return {
    description: f.description ?? "",
    quantity: String(f.quantity ?? ""),
    size: f.size ?? "",
    manufacturer: f.manufacturer ?? "",
    model: f.model ?? "",
    webLink: f.webLink ?? "",
    vendor: f.vendor ?? "",
    actualUnitPrice: f.actualUnitPrice !== null && f.actualUnitPrice !== undefined
      ? String(f.actualUnitPrice) : "",
    procurementStatus: f.procurementStatus,
    dateNeededBy: tsToIso(f.dateNeededBy),
    dateOrdered: tsToIso(f.dateOrdered),
    eta: tsToIso(f.eta),
    dateDelivered: tsToIso(f.dateDelivered),
    poNumber: f.poNumber ?? "",
    submittalStatus: f.submittalStatus,
    notes: f.notes ?? "",
  };
}

function isDirty(form: FormData, original: JobFixture): boolean {
  const orig = fixtureToForm(original);
  return (Object.keys(form) as (keyof FormData)[]).some((k) => form[k] !== orig[k]);
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  fixture: JobFixture | null;
  onClose: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FixtureDetailDrawer({ fixture, onClose }: Props) {
  const [form, setForm] = useState<FormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Spec library modal
  const [showSpecLibrary, setShowSpecLibrary] = useState(false);
  const [linkedSpec, setLinkedSpec] = useState<{ id: string; description: string; pdfUrl: string } | null>(null);

  // Attachment upload
  const [attUploadProgress, setAttUploadProgress] = useState<number | null>(null);
  const [attUploadError, setAttUploadError] = useState("");
  const [attType, setAttType] = useState<AttachmentType>("Spec Sheet");
  const attFileRef = useRef<HTMLInputElement>(null);

  // Library prompt (shown after attachment upload)
  const [libraryPrompt, setLibraryPrompt] = useState<{ url: string; storagePath: string; filename: string } | null>(null);
  const [libFormVisible, setLibFormVisible] = useState(false);
  const [libManufacturer, setLibManufacturer] = useState("");
  const [libModel, setLibModel] = useState("");
  const [libDescription, setLibDescription] = useState("");
  const [libSaving, setLibSaving] = useState(false);

  // ── Init/reset on fixture change ─────────────────────────────────────

  useEffect(() => {
    if (!fixture) {
      setForm(null);
      setLinkedSpec(null);
      setAttUploadProgress(null);
      setAttUploadError("");
      setSaveError("");
      setLibraryPrompt(null);
      setLibFormVisible(false);
      setLibSaving(false);
      return;
    }
    setForm(fixtureToForm(fixture));

    // Load linked spec sheet info
    if (fixture.specSheetLibraryId) {
      getDoc(doc(db, "specSheetLibrary", fixture.specSheetLibraryId)).then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setLinkedSpec({
            id: snap.id,
            description: d.description ?? `${d.manufacturer} ${d.model}`,
            pdfUrl: d.pdfUrl ?? d.url ?? "",
          });
        } else {
          setLinkedSpec(null);
        }
      });
    } else {
      setLinkedSpec(null);
    }
  }, [fixture?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fixture || !form) return null;

  function set(field: keyof FormData, value: string) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  // ── Save ─────────────────────────────────────────────────────────────

  async function save() {
    if (!fixture || !form) return;
    if (!isDirty(form, fixture)) return;
    setSaving(true);
    setSaveError("");
    try {
      const qty = parseInt(form.quantity, 10);
      const actualPrice = form.actualUnitPrice.trim()
        ? parseFloat(form.actualUnitPrice)
        : null;
      await updateDoc(doc(db, "jobFixtures", fixture.id), {
        description: form.description.trim() || fixture.description,
        quantity: isNaN(qty) ? fixture.quantity : qty,
        size: form.size.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        model: form.model.trim() || null,
        webLink: form.webLink.trim() || null,
        vendor: form.vendor.trim() || null,
        actualUnitPrice: actualPrice !== null && !isNaN(actualPrice) ? actualPrice : null,
        procurementStatus: form.procurementStatus,
        dateNeededBy: isoToTs(form.dateNeededBy),
        dateOrdered: isoToTs(form.dateOrdered),
        eta: isoToTs(form.eta),
        dateDelivered: isoToTs(form.dateDelivered),
        poNumber: form.poNumber.trim() || null,
        submittalStatus: form.submittalStatus,
        notes: form.notes.trim() || null,
        updatedAt: serverTimestamp(),
      });
    } catch {
      setSaveError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndClose() {
    await save();
    onClose();
  }

  function handleClose() {
    // Auto-save on close if dirty
    if (form && fixture && isDirty(form, fixture)) {
      save();
    }
    onClose();
  }

  // ── Spec library link/unlink ─────────────────────────────────────────

  async function handleLinkSpec(entry: SpecSheetLibraryEntry) {
    if (!fixture) return;
    await updateDoc(doc(db, "jobFixtures", fixture.id), {
      specSheetLibraryId: entry.id,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "specSheetLibrary", entry.id), {
      usageCount: increment(1),
    });
    setLinkedSpec({ id: entry.id, description: entry.description, pdfUrl: entry.pdfUrl });
  }

  async function handleUnlinkSpec() {
    if (!fixture || !fixture.specSheetLibraryId) return;
    const libId = fixture.specSheetLibraryId;
    await updateDoc(doc(db, "jobFixtures", fixture.id), {
      specSheetLibraryId: null,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "specSheetLibrary", libId), {
      usageCount: increment(-1),
    });
    setLinkedSpec(null);
  }

  // ── Attachment upload ────────────────────────────────────────────────

  async function handleAttachmentUpload(file: File) {
    if (!fixture) return;
    const currentCount = fixture.attachments?.length ?? 0;
    if (currentCount >= 3) {
      setAttUploadError("Maximum 3 attachments per fixture.");
      return;
    }
    setAttUploadError("");
    setAttUploadProgress(0);

    const storagePath = `attachments/${fixture.jobId}/${fixture.id}/${file.name}`;
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      (snap) => setAttUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => {
        console.error("Attachment upload failed:", err);
        setAttUploadError(`Upload failed: ${err.message || "Please try again."}`);
        setAttUploadProgress(null);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const newAtt: FixtureAttachment = {
          url,
          filename: file.name,
          type: attType,
          uploadedAt: Timestamp.now(),
          storagePath,
        };
        // Write full array (can't use arrayUnion with Timestamp objects reliably)
        const currentAtts = fixture.attachments ?? [];
        await updateDoc(doc(db, "jobFixtures", fixture.id), {
          attachments: [...currentAtts, newAtt],
          updatedAt: serverTimestamp(),
        });
        setAttUploadProgress(null);
        if (attFileRef.current) attFileRef.current.value = "";

        // Show "Add to library?" prompt
        setLibraryPrompt({ url, storagePath, filename: file.name });
        setLibFormVisible(false);
        setLibManufacturer(form?.manufacturer ?? fixture.manufacturer ?? "");
        setLibModel(form?.model ?? fixture.model ?? "");
        setLibDescription(fixture.description ?? "");
      }
    );
  }

  async function handleDeleteAttachment(att: FixtureAttachment) {
    if (!fixture) return;
    if (!window.confirm(`Delete ${att.filename}?`)) return;
    try {
      if (att.storagePath) {
        await deleteObject(ref(storage, att.storagePath));
      }
    } catch {
      // Storage file may already be gone
    }
    const updated = (fixture.attachments ?? []).filter((a) => a.url !== att.url);
    await updateDoc(doc(db, "jobFixtures", fixture.id), {
      attachments: updated,
      updatedAt: serverTimestamp(),
    });
  }

  // ── Add to library after upload ──────────────────────────────────────

  function handleDismissLibraryPrompt() {
    setLibraryPrompt(null);
    setLibFormVisible(false);
  }

  async function handleAddToLibrary() {
    if (!fixture || !libraryPrompt) return;
    if (!libManufacturer.trim() || !libModel.trim() || !libDescription.trim()) return;
    setLibSaving(true);

    try {
      // Check for duplicate
      const dupeSnap = await getDocs(
        query(
          collection(db, "specSheetLibrary"),
          where("manufacturerKey", "==", libManufacturer.trim().toLowerCase()),
          where("modelKey", "==", libModel.trim().toLowerCase())
        )
      );

      let libDocId: string;

      if (!dupeSnap.empty) {
        // Already exists — link to existing instead of creating duplicate
        libDocId = dupeSnap.docs[0].id;
        await updateDoc(doc(db, "specSheetLibrary", libDocId), {
          usageCount: increment(1),
        });
      } else {
        // Create new library entry reusing the already-uploaded PDF URL
        const docRef = await addDoc(collection(db, "specSheetLibrary"), {
          manufacturer: libManufacturer.trim(),
          model: libModel.trim(),
          description: libDescription.trim(),
          manufacturerKey: libManufacturer.trim().toLowerCase(),
          modelKey: libModel.trim().toLowerCase(),
          pdfUrl: libraryPrompt.url,
          storagePath: libraryPrompt.storagePath,
          version: 1,
          versionHistory: [],
          uploadedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          usageCount: 1,
        });
        libDocId = docRef.id;
      }

      // Link fixture to library entry
      await updateDoc(doc(db, "jobFixtures", fixture.id), {
        specSheetLibraryId: libDocId,
        updatedAt: serverTimestamp(),
      });

      setLinkedSpec({
        id: libDocId,
        description: libDescription.trim(),
        pdfUrl: libraryPrompt.url,
      });
      setLibraryPrompt(null);
      setLibFormVisible(false);
    } catch (err) {
      console.error("Failed to add to library:", err);
    } finally {
      setLibSaving(false);
    }
  }

  // ── Calculated fields ────────────────────────────────────────────────

  const qty = parseInt(form.quantity, 10) || 0;
  const actualPrice = parseFloat(form.actualUnitPrice) || 0;
  const total = qty * actualPrice;

  const phaseBadge = "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600";

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-gray-900/40" onClick={handleClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[620px] max-w-full bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={phaseBadge}>{getPhaseLabel(fixture.costCode)}</span>
            </div>
            <h2 className="text-base font-semibold text-gray-900 leading-snug">
              {fixture.description}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Qty {fixture.quantity}
              {fixture.size ? ` · ${fixture.size}` : ""}
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

          {/* SECTION 1 — Specification */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Specification</h3>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => set("quantity", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Size</label>
                <input
                  type="text"
                  value={form.size}
                  onChange={(e) => set("size", e.target.value)}
                  placeholder="e.g. 1/2&quot;"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Manufacturer</label>
                <input
                  type="text"
                  value={form.manufacturer}
                  onChange={(e) => set("manufacturer", e.target.value)}
                  placeholder="Manufacturer"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => set("model", e.target.value)}
                  placeholder="Model number"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Spec library link */}
            {linkedSpec ? (
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                <svg className="h-4 w-4 text-green-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
                </svg>
                <span className="text-sm text-green-800 truncate flex-1">{linkedSpec.description}</span>
                {linkedSpec.pdfUrl && (
                  <a
                    href={linkedSpec.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline shrink-0"
                  >
                    View
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleUnlinkSpec}
                  className="text-xs text-red-500 hover:text-red-700 shrink-0"
                >
                  Unlink
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSpecLibrary(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                Search spec library →
              </button>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Web Link</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={form.webLink}
                  onChange={(e) => set("webLink", e.target.value)}
                  placeholder="https://..."
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {form.webLink.trim() && (
                  <a
                    href={form.webLink.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Open →
                  </a>
                )}
              </div>
            </div>

            {fixture.budgetUnitPrice !== null && fixture.budgetUnitPrice !== undefined && (
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-400">Estimate Reference — not the purchase price</p>
                <p className="text-sm font-medium text-gray-700">{fmt(fixture.budgetUnitPrice)}</p>
              </div>
            )}
          </section>

          {/* SECTION 2 — Procurement */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Procurement</h3>

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
              </div>
            </div>

            {/* Total */}
            {actualPrice > 0 && qty > 0 && (
              <div className="rounded-lg bg-blue-50 px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-blue-600">Total ({qty} × {fmt(actualPrice)})</span>
                <span className="text-sm font-semibold text-blue-800">{fmt(total)}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Procurement Status</label>
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

            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ["dateNeededBy", "Date Needed By"],
                  ["dateOrdered", "Date Ordered"],
                  ["eta", "ETA"],
                  ["dateDelivered", "Date Delivered"],
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

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">PO # (optional — future feature)</label>
              <input
                type="text"
                value={form.poNumber}
                onChange={(e) => set("poNumber", e.target.value)}
                placeholder="PO-1234"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </section>

          {/* SECTION 3 — Submittal */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Submittal</h3>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Submittal Status</label>
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

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                placeholder="Internal notes..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
          </section>

          {/* SECTION 4 — Attachments */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Attachments
              <span className="ml-1.5 font-normal text-gray-400 normal-case">
                ({fixture.attachments?.length ?? 0}/3)
              </span>
            </h3>

            {/* Existing attachments */}
            {(fixture.attachments ?? []).length > 0 && (
              <ul className="space-y-2">
                {(fixture.attachments ?? []).map((att, i) => (
                  <li key={att.url || i} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
                    <svg className="h-4 w-4 text-gray-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{att.filename || "Unnamed file"}</p>
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 mt-0.5">
                        {att.type || "Other"}
                      </span>
                    </div>
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline shrink-0"
                    >
                      View
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(att)}
                      className="text-gray-300 hover:text-red-500 shrink-0"
                      title="Delete attachment"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Upload new attachment */}
            {(fixture.attachments?.length ?? 0) < 3 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <select
                    value={attType}
                    onChange={(e) => setAttType(e.target.value as AttachmentType)}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {ATTACHMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    ref={attFileRef}
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAttachmentUpload(file);
                    }}
                    className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-100"
                  />
                </div>
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

            {/* Library prompt after upload */}
            {libraryPrompt && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3">
                {!libFormVisible ? (
                  <>
                    <p className="text-sm text-blue-800">Add this to the Spec Sheet Library for future use?</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLibFormVisible(true)}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Yes, add to library
                      </button>
                      <button
                        type="button"
                        onClick={handleDismissLibraryPrompt}
                        className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        No, keep it just for this fixture
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium text-blue-700">Confirm library entry details:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-medium text-blue-600 mb-0.5">Manufacturer</label>
                        <input
                          type="text"
                          value={libManufacturer}
                          onChange={(e) => setLibManufacturer(e.target.value)}
                          className="w-full rounded border border-blue-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-blue-600 mb-0.5">Model</label>
                        <input
                          type="text"
                          value={libModel}
                          onChange={(e) => setLibModel(e.target.value)}
                          className="w-full rounded border border-blue-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-blue-600 mb-0.5">Description</label>
                      <input
                        type="text"
                        value={libDescription}
                        onChange={(e) => setLibDescription(e.target.value)}
                        className="w-full rounded border border-blue-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddToLibrary}
                        disabled={libSaving || !libManufacturer.trim() || !libModel.trim() || !libDescription.trim()}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {libSaving ? "Saving..." : "Add to Library"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDismissLibraryPrompt}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
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
              onClick={handleSaveAndClose}
              disabled={saving || !isDirty(form, fixture)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Spec library modal (opened from drawer) */}
      <SpecSheetLibraryModal
        open={showSpecLibrary}
        onClose={() => setShowSpecLibrary(false)}
        linkMode={{ fixtureId: fixture.id, jobId: fixture.jobId }}
        onLink={handleLinkSpec}
      />
    </>
  );
}
