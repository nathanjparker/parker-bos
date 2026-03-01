"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FieldRoot() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/field/jobs");
  }, [router]);
  return null;
}
