import type { Timestamp } from "firebase/firestore";

export interface Jurisdiction {
  id: string;
  name: string;
  state?: string;
  phone?: string;
  inspectionPhone?: string;
  address?: string;
  website?: string;
  notes?: string;
  contactNames?: string; // comma-separated display names
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string;
}
