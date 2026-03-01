/**
 * One-time script to grant Firestore read access on localhost for a dev account.
 * Run: node scripts/set-dev-claim.js <YOUR_UID>
 * Get your UID from Firebase Console → Authentication → your user.
 * Requires service-account.json in project root (same as seed-users.js).
 */
const admin = require("firebase-admin");
const path = require("path");
const serviceAccountPath = path.join(__dirname, "..", "service-account.json");

let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch (e) {
  console.error("Missing service-account.json in project root. Use Firebase Console → Project Settings → Service Accounts → Generate new private key.");
  process.exit(1);
}

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: node scripts/set-dev-claim.js <YOUR_UID>");
  console.error("Get your UID from Firebase Console → Authentication → your user.");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

admin
  .auth()
  .setCustomUserClaims(uid, { dev: true })
  .then(() => {
    console.log("Done. Custom claim dev: true set for UID:", uid);
    console.log("Sign out and sign in again on localhost, then reload the dashboard.");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
