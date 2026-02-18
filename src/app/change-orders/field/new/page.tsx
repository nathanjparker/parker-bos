"use client";

import { useRouter } from "next/navigation";
import { FieldChangeOrderForm } from "@/components/FieldChangeOrderForm";

export default function FieldNewChangeOrderPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
        <h1 className="text-lg font-bold text-gray-900 sm:text-2xl">
          New Change Order - Field
        </h1>
        <div className="mt-4 sm:mt-6">
          <FieldChangeOrderForm
            onSuccess={() => router.push("/dashboard")}
            onCancel={() => router.push("/dashboard")}
          />
        </div>
      </div>
    </div>
  );
}
