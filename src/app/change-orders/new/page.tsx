"use client";

import { useRouter } from "next/navigation";
import { ChangeOrderForm } from "@/components/ChangeOrderForm";
import AppShell from "@/components/AppShell";

export default function NewChangeOrderPage() {
  const router = useRouter();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          New Change Order
        </h1>
        <div className="mt-6">
          <ChangeOrderForm
            onSuccess={() => router.push("/change-orders")}
            onCancel={() => router.push("/change-orders")}
          />
        </div>
      </div>
    </AppShell>
  );
}
