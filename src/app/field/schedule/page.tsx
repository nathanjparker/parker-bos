"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FieldSchedulePage() {
  const router = useRouter();

  // Redirect to the existing standalone field schedule page
  useEffect(() => {
    router.replace("/field-schedule");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2A2E3B] border-t-[#3B82F6]" />
    </div>
  );
}
