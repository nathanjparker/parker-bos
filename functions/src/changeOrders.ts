import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin once per cold start.
if (!getApps().length) {
  initializeApp();
  console.log("[changeOrders] Firebase Admin initialized.");
}

/**
 * Generates a CO number when a new change order is created.
 * Pattern: ${jobNumber}-CO-${paddedCount} (e.g. TEST-001-CO-001).
 */
export const generateCONumber = onDocumentCreated(
  "changeOrders/{coId}",
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.warn("[generateCONumber] Event had no snapshot data.");
      return;
    }

    const data = snap.data();
    const coId = event.params.coId;
    console.log("[generateCONumber] Processing new CO:", coId);

    if (data.coNumber && String(data.coNumber).trim() !== "") {
      console.log("[generateCONumber] coNumber already set, skipping:", data.coNumber);
      return;
    }

    const jobNumber = data.jobNumber;
    if (!jobNumber || typeof jobNumber !== "string") {
      console.warn("[generateCONumber] Missing or invalid jobNumber for CO:", coId);
      return;
    }

    try {
      const db = getFirestore();
      const existingSnapshot = await db
        .collection("changeOrders")
        .where("jobNumber", "==", jobNumber)
        .get();

      const count = existingSnapshot.size;
      const paddedCount = String(count).padStart(3, "0");
      const coNumber = `${jobNumber}-CO-${paddedCount}`;

      console.log("[generateCONumber] jobNumber:", jobNumber, "count:", count, "coNumber:", coNumber);

      await snap.ref.update({ coNumber });
      console.log("[generateCONumber] Updated CO", coId, "with coNumber:", coNumber);
    } catch (err) {
      console.error("[generateCONumber] Error:", err);
      throw err;
    }
  }
);

/**
 * When a CO transitions to Approved, increment the job's currentContractValue.
 */
export const onCOStatusChange = onDocumentUpdated(
  "changeOrders/{coId}",
  async (event) => {
    const beforeSnap = event.data?.before;
    const afterSnap = event.data?.after;

    if (!beforeSnap || !afterSnap) {
      console.warn("[onCOStatusChange] Missing before or after snapshot.");
      return;
    }

    const before = beforeSnap.data();
    const after = afterSnap.data();
    const coId = event.params.coId;

    const prevStatus = before?.status;
    const newStatus = after?.status;

    console.log("[onCOStatusChange] CO:", coId, "status:", prevStatus, "->", newStatus);

    if (prevStatus === "Approved" || newStatus !== "Approved") {
      console.log("[onCOStatusChange] No transition to Approved, skipping.");
      return;
    }

    const jobId = after?.jobId;
    if (!jobId || typeof jobId !== "string") {
      console.warn("[onCOStatusChange] Missing jobId on approved CO:", coId);
      return;
    }

    const amountApproved = Number(after?.amountApproved ?? 0);
    if (!Number.isFinite(amountApproved) || amountApproved <= 0) {
      console.warn(
        "[onCOStatusChange] amountApproved missing or invalid for CO:",
        coId,
        "value:",
        after?.amountApproved
      );
      return;
    }

    try {
      const db = getFirestore();
      const jobRef = db.collection("Jobs").doc(jobId);

      await jobRef.update({
        currentContractValue: FieldValue.increment(amountApproved),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const coNumber = after?.coNumber ?? coId;
      console.log(
        "[onCOStatusChange] CO",
        coNumber,
        "approved — job",
        jobId,
        "currentContractValue incremented by",
        amountApproved
      );
    } catch (err) {
      console.error("[onCOStatusChange] Error updating job:", err);
      throw err;
    }
  }
);
