"use client";

import { createContext, useContext, useState } from "react";

export interface FieldJob {
  id: string;
  jobNumber: string;
  jobName: string;
}

interface FieldContextValue {
  currentJob: FieldJob | null;
  setCurrentJob: (job: FieldJob | null) => void;
}

const FieldContext = createContext<FieldContextValue>({
  currentJob: null,
  setCurrentJob: () => {},
});

export function FieldProvider({ children }: { children: React.ReactNode }) {
  const [currentJob, setCurrentJob] = useState<FieldJob | null>(null);
  return (
    <FieldContext.Provider value={{ currentJob, setCurrentJob }}>
      {children}
    </FieldContext.Provider>
  );
}

export function useFieldContext() {
  return useContext(FieldContext);
}
