import { use } from "react";
import AppShell from "@/components/AppShell";
import ConstructionEstimateBuilder from "@/components/ConstructionEstimateBuilder";

export default function ConstructionEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AppShell>
      <ConstructionEstimateBuilder estimateId={id} />
    </AppShell>
  );
}
