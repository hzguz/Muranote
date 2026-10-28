import { test, before, after, beforeEach } from 'node:test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  writeBatch,
} from 'firebase/firestore';

// Runs against the Firestore emulator; see the test:rules script in package.json.
const RULES_PATH = fileURLToPath(new URL('../firestore.rules', import.meta.url));
const PROJECT_ID = 'demo-muranote';
let testEnv;

const profile = (uid, matchCode, extra = {}) => ({
  uid,
  email: `${uid}@example.com`,
  displayName: uid,
  photoURL: '',
  matchCode,
  matchStatus: 'none',
  ...extra,
});

const dbAs = (uid) => testEnv.authenticatedContext(uid).firestore();

const seed = async (writes) => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of writes) await setDoc(doc(db, path), data);
  });
};

const sendRequest = (requesterId, targetId) => {
  const db = dbAs(requesterId);
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', requesterId), { matchStatus: 'pending_sent', matchPartnerId: targetId });
  batch.update(doc(db, 'users', targetId), { matchStatus: 'pending_received', matchRequestFrom: requesterId });
  return batch.commit();
};

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync(RULES_PATH, 'utf8') },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed([
    ['users/alice', profile('alice', '11111')],
    ['users/bob', profile('bob', '22222')],
    ['users/carol', profile('carol', '33333')],
    ['matchCodes/11111', { uid: 'alice' }],
    ['matchCodes/22222', { uid: 'bob' }],
  ]);
});

test('owner reads own profile; strangers cannot read or list profiles', async () => {
  await assertSucceeds(getDoc(doc(dbAs('alice'), 'users/alice')));
  await assertFails(getDoc(doc(dbAs('bob'), 'users/alice')));
  await assertFails(getDocs(collection(dbAs('bob'), 'users')));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'users/alice')));
});

test('owner can read own missing profile (first sign-in)', async () => {
  await assertSucceeds(getDoc(doc(dbAs('dave'), 'users/dave')));
});

test('match codes: get allowed, list denied, unauthenticated denied', async () => {
  await assertSucceeds(getDoc(doc(dbAs('bob'), 'matchCodes/11111')));
  await assertSucceeds(getDoc(doc(dbAs('bob'), 'matchCodes/99999')));
  await assertFails(getDocs(collection(dbAs('bob'), 'matchCodes')));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'matchCodes/11111')));
});

test('match codes: claim own profile code only, no overwrite', async () => {
  await assertSucceeds(setDoc(doc(dbAs('carol'), 'matchCodes/33333'), { uid: 'carol' }));
  await assertFails(setDoc(doc(dbAs('carol'), 'matchCodes/44444'), { uid: 'carol' }));
  await assertFails(setDoc(doc(dbAs('carol'), 'matchCodes/11111'), { uid: 'carol' }));
  await assertFails(setDoc(doc(dbAs('bob'), 'matchCodes/55555'), { uid: 'carol' }));
});

test('new user creates profile then claims code', async () => {
  const db = dbAs('dave');
  await assertSucceeds(setDoc(doc(db, 'users/dave'), profile('dave', '44444')));
  await assertSucceeds(setDoc(doc(db, 'matchCodes/44444'), { uid: 'dave' }));
});

test('duplicate-code reassignment: update own code then claim it', async () => {
  const db = dbAs('carol');
  await seed([['users/carol', profile('carol', '11111')]]);
  await assertSucceeds(setDoc(doc(db, 'users/carol'), profile('carol', '66666')));
  await assertSucceeds(setDoc(doc(db, 'matchCodes/66666'), { uid: 'carol' }));
});

test('full match flow: request, read requester, accept, partner reads notes', async () => {
  await seed([['users/alice/notes/n1', { id: 'n1' }]]);
  await assertSucceeds(sendRequest('bob', 'alice'));

  // Target can read requester profile to accept; requester can read target.
  await assertSucceeds(getDoc(doc(dbAs('alice'), 'users/bob')));
  await assertSucceeds(getDoc(doc(dbAs('bob'), 'users/alice')));
  await assertFails(getDoc(doc(dbAs('carol'), 'users/alice')));

  const db = dbAs('alice');
  const batch = writeBatch(db);
  batch.update(doc(db, 'users/alice'), {
    matchStatus: 'matched', matchPartnerId: 'bob', matchPartnerName: 'bob',
    matchPartnerPhoto: '', matchPartnerAvatarId: null, matchRequestFrom: null,
  });
  batch.update(doc(db, 'users/bob'), {
    matchStatus: 'matched', matchPartnerId: 'alice', matchPartnerName: 'alice',
    matchPartnerPhoto: '', matchPartnerAvatarId: null, matchRequestFrom: null,
  });
  await assertSucceeds(batch.commit());

  await assertSucceeds(getDocs(collection(dbAs('bob'), 'users/alice/notes')));
  await assertFails(getDocs(collection(dbAs('carol'), 'users/alice/notes')));
});

test('request to a busy user is rejected', async () => {
  await seed([['users/alice', profile('alice', '11111', { matchStatus: 'matched', matchPartnerId: 'carol' })]]);
  await assertFails(sendRequest('bob', 'alice'));
});

test('request cannot touch other fields of the target', async () => {
  const db = dbAs('bob');
  const batch = writeBatch(db);
  batch.update(doc(db, 'users/bob'), { matchStatus: 'pending_sent', matchPartnerId: 'alice' });
  batch.update(doc(db, 'users/alice'), {
    matchStatus: 'pending_received', matchRequestFrom: 'bob', displayName: 'hacked',
  });
  await assertFails(batch.commit());
});

test('request requires the requester profile to point at the target', async () => {
  const db = dbAs('bob');
  await assertFails(
    setDoc(doc(db, 'users/alice'), profile('alice', '11111', { matchStatus: 'pending_received', matchRequestFrom: 'bob' }))
  );
});

test('decline flow works for the target', async () => {
  await assertSucceeds(sendRequest('bob', 'alice'));
  const db = dbAs('alice');
  const batch = writeBatch(db);
  batch.update(doc(db, 'users/alice'), { matchStatus: 'none', matchRequestFrom: null, matchPartnerId: null });
  batch.update(doc(db, 'users/bob'), { matchStatus: 'none', matchPartnerId: null });
  await assertSucceeds(batch.commit());
});
