"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFieldContext } from "@/lib/fieldContext";
import StatusBadge from "@/components/field/StatusBadge";
import { contactDisplayName, type Contact } from "@/types/companies";
import { formatPhoneDisplay } from "@/lib/format";
import type { Job } from "@/types/jobs";

interface ChangeOrder {
  id: string;
  coNumber: string;
  subject: string;
  status: string;
  createdAt?: { toDate?: () => Date } | null;
}

function fmtDate(d?: { toDate?: () => Date } | null): string {
  if (!d?.toDate) return "";
  return d.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type TeamRole = "estimator" | "pm" | "superintendent";

const ROLE_LABELS: Record<TeamRole, string> = {
  estimator: "Estimator",
  pm: "Project Manager",
  superintendent: "Superintendent",
};

// ── Contact row ──────────────────────────────────────────────────────────────

function ContactRow({
  role,
  name,
  phone,
  onEdit,
}: {
  role: string;
  name?: string;
  phone?: string;
  onEdit?: () => void;
}) {
  const initials = name
    ? name
        .split(" ")
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 2)
    : "—";

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#2A2E3B] last:border-0">
      {/* Avatar */}
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
          name
            ? "bg-[rgba(59,130,246,0.12)] text-[#3B82F6]"
            : "bg-[#222633] text-[#585D6E]"
        }`}
      >
        {initials}
      </div>

      {/* Name + role */}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#585D6E]">
          {role}
        </div>
        <div
          className={`text-sm font-medium truncate ${
            name ? "text-[#F1F3F7]" : "text-[#585D6E] italic"
          }`}
        >
          {name ?? "Not assigned"}
        </div>
        {phone && (
          <div className="text-xs text-[#8B90A0]">{formatPhoneDisplay(phone)}</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#585D6E] transition-colors active:bg-[#222633]"
            aria-label="Change contact"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        {name && phone && (
          <a
            href={`tel:${phone}`}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[rgba(34,197,94,0.12)] transition-colors active:bg-[rgba(34,197,94,0.2)]"
            aria-label={`Call ${name}`}
          >
            <svg
              className="h-5 w-5 text-[#22C55E]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function FieldJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setCurrentJob } = useFieldContext();

  const [job, setJob] = useState<Job | null>(null);
  const [cos, setCos] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Contact editor
  const [editingRole, setEditingRole] = useState<TeamRole | null>(null);
  const [gcContacts, setGcContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newContact, setNewContact] = useState({
    firstName: "",
    lastName: "",
    title: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Load job ──

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "Jobs", id), (snap) => {
      if (!snap.exists()) {
        setJob(null);
        setLoading(false);
        return;
      }
      const data = { id: snap.id, ...(snap.data() as Omit<Job, "id">) };
      setJob(data);
      setCurrentJob({
        id: snap.id,
        jobNumber: (snap.data() as Record<string, string>).jobNumber ?? "",
        jobName: (snap.data() as Record<string, string>).jobName ?? "",
      });
      setLoading(false);
    });
    return () => unsub();
  }, [id, setCurrentJob]);

  useEffect(() => {
    return () => setCurrentJob(null);
  }, [setCurrentJob]);

  // ── Load change orders ──

  useEffect(() => {
    const q = query(
      collection(db, "changeOrders"),
      where("jobId", "==", id),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setCos(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChangeOrder, "id">),
        }))
      );
    });
  }, [id]);

  // ── Load GC contacts when picker opens ──

  useEffect(() => {
    if (!editingRole) {
      setGcContacts([]);
      setContactSearch("");
      setShowNewForm(false);
      setNewContact({ firstName: "", lastName: "", title: "", phone: "" });
      return;
    }
    setContactsLoading(true);
    const q = job?.gcId
      ? query(
          collection(db, "contacts"),
          where("companyId", "==", job.gcId),
          orderBy("lastName", "asc")
        )
      : query(collection(db, "contacts"), orderBy("lastName", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setGcContacts(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contact, "id">) }))
      );
      setContactsLoading(false);
    });
    setTimeout(() => searchRef.current?.focus(), 150);
    return () => unsub();
  }, [editingRole, job?.gcId]);

  // ── Contact assignment handlers ──

  async function assignContact(contact: Contact) {
    if (!editingRole || !job) return;
    const name = contactDisplayName(contact);
    const updates: Record<string, string> = {};
    if (editingRole === "estimator") {
      updates.estimatorId = contact.id;
      updates.estimatorName = name;
      if (contact.phone) updates.estimatorPhone = contact.phone;
    } else if (editingRole === "pm") {
      updates.pmId = contact.id;
      updates.pmName = name;
      if (contact.phone) updates.projectManagerPhone = contact.phone;
    } else {
      updates.superintendentId = contact.id;
      updates.superintendentName = name;
      if (contact.phone) updates.superintendentPhone = contact.phone;
    }
    await updateDoc(doc(db, "Jobs", job.id), updates);
  }

  async function handleSelectContact(contact: Contact) {
    setSaving(true);
    try {
      await assignContact(contact);
      setEditingRole(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAndAssign() {
    if (!editingRole || !job) return;
    if (!newContact.firstName.trim() || !newContact.lastName.trim()) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        firstName: newContact.firstName.trim(),
        lastName: newContact.lastName.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (newContact.title.trim()) data.title = newContact.title.trim();
      if (newContact.phone.trim()) data.phone = newContact.phone.trim();
      if (job.gcId) data.companyId = job.gcId;
      if (job.gcName) data.companyName = job.gcName;

      const ref = await addDoc(collection(db, "contacts"), data);
      await assignContact({
        id: ref.id,
        firstName: newContact.firstName.trim(),
        lastName: newContact.lastName.trim(),
        title: newContact.title.trim() || undefined,
        phone: newContact.phone.trim() || undefined,
        companyId: job.gcId || undefined,
        companyName: job.gcName || undefined,
      });
      setEditingRole(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Derived ──

  const filteredContacts = gcContacts.filter((c) => {
    const term = contactSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      contactDisplayName(c).toLowerCase().includes(term) ||
      (c.title ?? "").toLowerCase().includes(term)
    );
  });

  const currentContactId =
    editingRole === "estimator"
      ? job?.estimatorId
      : editingRole === "pm"
      ? job?.pmId
      : job?.superintendentId;

  // ── Loading / not found ──

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2A2E3B] border-t-[#3B82F6]" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="px-4 pt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-1.5 text-sm text-[#3B82F6]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>
        <p className="text-[#8B90A0]">Job not found.</p>
      </div>
    );
  }

  const jobNumber = (job as unknown as Record<string, string>).jobNumber ?? "";
  const fullAddress = [job.siteAddress, job.siteCity, job.siteState, job.siteZip]
    .filter(Boolean)
    .join(", ");
  const mapsUrl = fullAddress
    ? `https://maps.apple.com/?q=${encodeURIComponent(fullAddress)}`
    : null;
  const pendingCOs = cos.filter(
    (co) => co.status === "Draft" || co.status === "Submitted" || co.status === "Under Review"
  );

  // ── Render ──

  return (
    <>
      <div className="px-4 pt-5 pb-6">
        {/* Back + header */}
        <button
          type="button"
          onClick={() => router.push("/field/jobs")}
          className="mb-4 flex items-center gap-1.5 text-sm text-[#3B82F6]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Jobs
        </button>

        {/* Job title block */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            {jobNumber && (
              <span className="font-mono text-xs font-bold text-[#3B82F6]">
                {jobNumber}
              </span>
            )}
            <StatusBadge status={job.projectPhase} size="sm" />
            {pendingCOs.length > 0 && (
              <span className="rounded-full bg-[rgba(234,179,8,0.15)] px-2 py-0.5 text-[10px] font-bold text-[#EAB308]">
                {pendingCOs.length} pending CO{pendingCOs.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-[#F1F3F7]">{job.jobName}</h1>
          {job.gcName && (
            <p className="mt-0.5 text-sm text-[#8B90A0]">{job.gcName}</p>
          )}
        </div>

        {/* Address */}
        {fullAddress && (
          <div className="mb-4 rounded-2xl border border-[#2A2E3B] bg-[#1A1D27]">
            <a
              href={mapsUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[rgba(59,130,246,0.12)]">
                <svg
                  className="h-5 w-5 text-[#3B82F6]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-[#F1F3F7]">{job.siteAddress}</div>
                <div className="text-xs text-[#8B90A0]">
                  {[job.siteCity, job.siteState, job.siteZip].filter(Boolean).join(", ")}
                </div>
              </div>
              <svg
                className="h-4 w-4 text-[#585D6E]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                strokeLinecap="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </a>
          </div>
        )}

        {/* Key Contacts */}
        <div className="mb-4 rounded-2xl border border-[#2A2E3B] bg-[#1A1D27] px-4">
          <div className="flex items-center gap-2 py-3 border-b border-[#2A2E3B]">
            <span className="text-xs font-bold uppercase tracking-widest text-[#585D6E]">
              Key Contacts
            </span>
            <span className="text-xs text-[#585D6E]">—</span>
            <span className="text-xs text-[#585D6E]">{job.gcName ?? "GC"}</span>
          </div>
          <ContactRow
            role="Project Manager"
            name={job.pmName}
            phone={job.projectManagerPhone}
            onEdit={() => setEditingRole("pm")}
          />
          <ContactRow
            role="Estimator"
            name={job.estimatorName}
            phone={job.estimatorPhone}
            onEdit={() => setEditingRole("estimator")}
          />
          <ContactRow
            role="Superintendent"
            name={job.superintendentName}
            phone={job.superintendentPhone}
            onEdit={() => setEditingRole("superintendent")}
          />
        </div>

        {/* Change Orders */}
        <div className="mb-4 rounded-2xl border border-[#2A2E3B] bg-[#1A1D27]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2E3B]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[#585D6E]">
                Change Orders
              </span>
              {cos.length > 0 && (
                <span className="rounded-full bg-[rgba(59,130,246,0.12)] px-2 py-0.5 text-[10px] font-bold text-[#3B82F6]">
                  {cos.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => router.push(`/field/forms/change-order/${id}`)}
              className="text-xs font-semibold text-[#3B82F6]"
            >
              + New CO
            </button>
          </div>

          {cos.length === 0 ? (
            <div className="px-4 py-5 text-sm text-[#585D6E]">No change orders yet.</div>
          ) : (
            <div>
              {cos.map((co) => (
                <div
                  key={co.id}
                  className="flex items-start gap-3 px-4 py-3.5 border-b border-[#2A2E3B] last:border-0"
                >
                  <span className="mt-0.5 font-mono text-xs font-bold text-[#3B82F6] whitespace-nowrap">
                    {co.coNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#F1F3F7] truncate">
                      {co.subject}
                    </div>
                    {co.createdAt && (
                      <div className="text-xs text-[#585D6E]">{fmtDate(co.createdAt)}</div>
                    )}
                  </div>
                  <StatusBadge status={co.status} size="sm" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Contact picker modal ───────────────────────────────────────────── */}
      {editingRole && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => { if (!saving) setEditingRole(null); }}
          />

          {/* Sheet */}
          <div
            className="relative flex flex-col bg-[#1A1D27] rounded-t-3xl"
            style={{ maxHeight: "88vh" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-[#2A2E3B]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2A2E3B]">
              {showNewForm ? (
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-sm text-[#3B82F6] disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                  Back
                </button>
              ) : (
                <span className="text-sm font-semibold text-[#F1F3F7]">
                  Assign {ROLE_LABELS[editingRole]}
                </span>
              )}
              <button
                type="button"
                onClick={() => { if (!saving) setEditingRole(null); }}
                disabled={saving}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#222633] text-[#8B90A0] disabled:opacity-50"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── Contact list view ── */}
            {!showNewForm && (
              <>
                {/* Search */}
                <div className="px-4 py-3 border-b border-[#2A2E3B]">
                  <div className="flex items-center gap-2.5 rounded-xl bg-[#222633] px-3.5 py-2.5">
                    <svg className="h-4 w-4 flex-shrink-0 text-[#585D6E]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                      ref={searchRef}
                      type="text"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      placeholder="Search by name or title…"
                      className="flex-1 bg-transparent text-sm text-[#F1F3F7] placeholder:text-[#585D6E] focus:outline-none"
                    />
                    {contactSearch && (
                      <button
                        type="button"
                        onClick={() => setContactSearch("")}
                        className="text-[#585D6E]"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Context hint */}
                {job.gcName && (
                  <div className="px-5 pt-2.5 pb-1">
                    <span className="text-[11px] text-[#585D6E]">
                      Showing contacts for {job.gcName}
                      {!job.gcId && " (no GC linked — showing all)"}
                    </span>
                  </div>
                )}

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                  {contactsLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2A2E3B] border-t-[#3B82F6]" />
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-sm text-[#8B90A0]">
                        {contactSearch
                          ? `No contacts match "${contactSearch}"`
                          : "No contacts found for this GC."}
                      </p>
                    </div>
                  ) : (
                    filteredContacts.map((c) => {
                      const isSelected = c.id === currentContactId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={saving}
                          onClick={() => handleSelectContact(c)}
                          className={`flex w-full items-center gap-3 px-5 py-3.5 text-left border-b border-[#2A2E3B] last:border-0 transition-colors active:bg-[#222633] disabled:opacity-50 ${
                            isSelected ? "bg-[rgba(59,130,246,0.06)]" : ""
                          }`}
                        >
                          {/* Avatar */}
                          <div
                            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                              isSelected
                                ? "bg-[rgba(59,130,246,0.2)] text-[#3B82F6]"
                                : "bg-[#222633] text-[#8B90A0]"
                            }`}
                          >
                            {contactDisplayName(c)
                              .split(" ")
                              .map((w) => w[0]?.toUpperCase() ?? "")
                              .join("")
                              .slice(0, 2)}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[#F1F3F7] truncate">
                              {contactDisplayName(c)}
                            </div>
                            <div className="text-xs text-[#8B90A0] truncate">
                              {[c.title, c.phone ? formatPhoneDisplay(c.phone) : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>

                          {/* Selected check */}
                          {isSelected && (
                            <svg
                              className="h-4 w-4 flex-shrink-0 text-[#3B82F6]"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2.5}
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Add new contact */}
                <div className="border-t border-[#2A2E3B] px-4 py-3" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowNewForm(true)}
                    className="flex w-full items-center gap-3 rounded-xl bg-[#222633] px-4 py-3 text-left transition-colors active:bg-[#2A2E3B] disabled:opacity-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.12)]">
                      <svg
                        className="h-4 w-4 text-[#3B82F6]"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#F1F3F7]">Add new contact</div>
                      <div className="text-xs text-[#8B90A0]">
                        {job.gcName ? `Add to ${job.gcName}` : "Add to contacts"}
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}

            {/* ── New contact form ── */}
            {showNewForm && (
              <div className="flex flex-col flex-1 overflow-y-auto">
                <div className="px-5 py-4 flex-1 space-y-4">
                  {job.gcName && (
                    <p className="text-xs text-[#8B90A0]">
                      This person will be added to the contacts directory under{" "}
                      <span className="font-medium text-[#F1F3F7]">{job.gcName}</span> and
                      assigned as {ROLE_LABELS[editingRole]} on this job.
                    </p>
                  )}

                  {/* First name */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#585D6E]">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={newContact.firstName}
                      onChange={(e) => setNewContact((n) => ({ ...n, firstName: e.target.value }))}
                      placeholder="First"
                      autoComplete="given-name"
                      className="block w-full rounded-xl border border-[#2A2E3B] bg-[#222633] px-4 py-3 text-sm text-[#F1F3F7] placeholder:text-[#585D6E] focus:border-[#3B82F6] focus:outline-none"
                    />
                  </div>

                  {/* Last name */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#585D6E]">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={newContact.lastName}
                      onChange={(e) => setNewContact((n) => ({ ...n, lastName: e.target.value }))}
                      placeholder="Last"
                      autoComplete="family-name"
                      className="block w-full rounded-xl border border-[#2A2E3B] bg-[#222633] px-4 py-3 text-sm text-[#F1F3F7] placeholder:text-[#585D6E] focus:border-[#3B82F6] focus:outline-none"
                    />
                  </div>

                  {/* Title */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#585D6E]">
                      Title
                    </label>
                    <input
                      type="text"
                      value={newContact.title}
                      onChange={(e) => setNewContact((n) => ({ ...n, title: e.target.value }))}
                      placeholder={ROLE_LABELS[editingRole]}
                      className="block w-full rounded-xl border border-[#2A2E3B] bg-[#222633] px-4 py-3 text-sm text-[#F1F3F7] placeholder:text-[#585D6E] focus:border-[#3B82F6] focus:outline-none"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#585D6E]">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={newContact.phone}
                      onChange={(e) => setNewContact((n) => ({ ...n, phone: e.target.value }))}
                      placeholder="206-555-1234"
                      autoComplete="tel"
                      className="block w-full rounded-xl border border-[#2A2E3B] bg-[#222633] px-4 py-3 text-sm text-[#F1F3F7] placeholder:text-[#585D6E] focus:border-[#3B82F6] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div
                  className="flex gap-3 border-t border-[#2A2E3B] px-5 py-4"
                  style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
                >
                  <button
                    type="button"
                    onClick={() => setShowNewForm(false)}
                    disabled={saving}
                    className="flex-1 rounded-xl border border-[#2A2E3B] py-3 text-sm font-semibold text-[#8B90A0] transition-colors active:bg-[#222633] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateAndAssign}
                    disabled={
                      saving ||
                      !newContact.firstName.trim() ||
                      !newContact.lastName.trim()
                    }
                    className="flex-1 rounded-xl bg-[#3B82F6] py-3 text-sm font-semibold text-white transition-colors active:bg-[#2563EB] disabled:opacity-40"
                  >
                    {saving ? "Saving…" : "Add & Assign"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
