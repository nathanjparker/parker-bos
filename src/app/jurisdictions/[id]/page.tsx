"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import { type Jurisdiction } from "@/types/jurisdictions";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-800">{value}</dd>
    </div>
  );
}

export default function JurisdictionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, "jurisdictions", id), (snap) => {
      if (snap.exists()) {
        setJurisdiction({ id: snap.id, ...(snap.data() as Omit<Jurisdiction, "id">) });
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
        </div>
      </AppShell>
    );
  }

  if (!jurisdiction) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-gray-500">Jurisdiction not found.</p>
          <Link href="/jurisdictions" className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline">
            Back to Jurisdictions
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/jurisdictions" className="text-xs font-semibold text-gray-400 hover:text-gray-600">
              ← Jurisdictions
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">{jurisdiction.name}</h1>
            {jurisdiction.state && (
              <p className="mt-0.5 text-sm text-gray-500">{jurisdiction.state}</p>
            )}
          </div>
          <Link
            href={`/jurisdictions/${id}/edit`}
            className="self-start rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Edit
          </Link>
        </div>

        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <dl className="grid gap-5 sm:grid-cols-2">
            {jurisdiction.phone && (
              <DetailRow
                label="Office Phone"
                value={
                  <a href={`tel:${jurisdiction.phone}`} className="text-blue-600 hover:underline">
                    {jurisdiction.phone}
                  </a>
                }
              />
            )}
            {jurisdiction.inspectionPhone && (
              <DetailRow
                label="Inspection Request Line"
                value={
                  <a href={`tel:${jurisdiction.inspectionPhone}`} className="text-orange-600 font-medium hover:underline">
                    {jurisdiction.inspectionPhone}
                  </a>
                }
              />
            )}
            {jurisdiction.address && (
              <DetailRow label="Address" value={jurisdiction.address} />
            )}
            {jurisdiction.website && (
              <DetailRow
                label="Website"
                value={
                  <a
                    href={jurisdiction.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {jurisdiction.website.replace(/^https?:\/\//, "")}
                  </a>
                }
              />
            )}
            {jurisdiction.contactNames && (
              <div className="sm:col-span-2">
                <DetailRow label="Contacts" value={jurisdiction.contactNames} />
              </div>
            )}
            {jurisdiction.notes && (
              <div className="sm:col-span-2">
                <DetailRow
                  label="Notes"
                  value={
                    <p className="whitespace-pre-wrap text-gray-700">{jurisdiction.notes}</p>
                  }
                />
              </div>
            )}
          </dl>
        </div>
      </div>
    </AppShell>
  );
}
