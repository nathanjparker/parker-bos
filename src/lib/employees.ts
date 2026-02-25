import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Employee } from "@/types/employees";

export async function getEmployeeByAuthUid(uid: string): Promise<Employee | null> {
  const snap = await getDocs(
    query(collection(db, "employees"), where("authUid", "==", uid))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<Employee, "id">) };
}

export async function getCurrentEmployee(): Promise<Employee | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  return getEmployeeByAuthUid(uid);
}
