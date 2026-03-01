var admin = require("firebase-admin");
var serviceAccount = require("../service-account.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
var db = admin.firestore();
var users = [
  { uid: 'aAqgZVFT5vMHsGd93khwQhDfc9P2', email: 'nate@parkerservices.co', displayName: 'Nate Parker', appRole: 'admin' },
  { uid: 'YfYzwQiWX3XnBpRMrNVSvWyFHWz2', email: 'nathanjparker@parkerservices.co', displayName: 'Nate Parker', appRole: 'admin' },
  { uid: '4aKoGvhss5XqcNVPco9ocYPYCA02', email: 'sarah@parkerservices.co', displayName: 'Sarah Parker', appRole: 'office' },
  { uid: '29AM03iubEVORX6Iq96y2VtlfPe2', email: 'ea@parkerservices.co', displayName: 'Brittany Barnum', appRole: 'office' },
  { uid: 'slifjz2HIpWOgTdkhlvkihXb7EF3', email: 'accounting@parkerservices.co', displayName: 'Kristen Frame', appRole: 'office' },
  { uid: '1gITEc2ccyXyQXVa25lT0N4JOBG3', email: 'josh@parkerservices.co', displayName: 'Josh Rossi', appRole: 'field' },
  { uid: 'gBgLw8FbAQTM9xB2sV77Hj5sSRR2', email: 'david@parkerservices.co', displayName: 'David Berckman', appRole: 'field' },
  { uid: 'ZU1h1mJwnmQXmtdJfOpciDRNTcl2', email: 'jameson@parkerservices.co', displayName: 'Jameson Gentry', appRole: 'field' },
  { uid: 'OZ8cMqr5MIXXsZSHGQe3ByxoO0F2', email: 'enrique@parkerservices.co', displayName: 'Enrique Hernandez-Castro', appRole: 'field' },
];
async function seed() {
  var now = admin.firestore.Timestamp.now();
  for (var u of users) {
    await db.collection('users').doc(u.uid).set({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      appRole: u.appRole,
      employeeId: '',
      isActive: true,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    });
    console.log('✅ ' + u.displayName + ' (' + u.appRole + ')');
  }
  console.log('\nDone — 9 users created.');
}
seed().catch(console.error);
