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
  contactIds?: string[];   // IDs of linked contacts documents
  contactNames?: string;   // legacy: comma-separated display names (pre-link)
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string;
}
