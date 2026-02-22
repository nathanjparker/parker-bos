"use client";

import { use } from "react";
import AppShell from "@/components/AppShell";
import EstimateBuilder from "@/components/EstimateBuilder";

export default function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell>
      <EstimateBuilder estimateId={id} />
    </AppShell>
  );
}
