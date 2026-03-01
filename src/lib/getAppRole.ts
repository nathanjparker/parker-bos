import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AppRole = "admin" | "office" | "field";

export async function getAppRole(uid: string): Promise<AppRole | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    const role = snap.data()?.appRole;
    if (role === "admin" || role === "office" || role === "field") return role;
    return null;
  } catch {
    return null;
  }
}
