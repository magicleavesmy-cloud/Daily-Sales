import { initializeApp } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;

export const isFirestoreEnabled = Boolean(db);

export const subscribeToCollection = (collectionName, onData, onError) => {
  if (!db) return () => {};

  return onSnapshot(
    collection(db, collectionName),
    (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
      onData(items, snapshot.metadata);
    },
    onError,
  );
};

export const saveCollectionItems = async (collectionName, nextItems, previousItems) => {
  if (!db) return;

  const nextIds = new Set(nextItems.map((item) => item.id));
  const deletedItems = previousItems.filter((item) => !nextIds.has(item.id));

  await Promise.all([
    ...nextItems.map((item) =>
      setDoc(doc(db, collectionName, item.id), item, { merge: true }),
    ),
    ...deletedItems.map((item) => deleteDoc(doc(db, collectionName, item.id))),
  ]);
};

export const saveDailyReport = async (date, report) => {
  if (!db) return;
  await setDoc(doc(db, "dailyReports", date), report, { merge: true });
};

export const deleteDailyReport = async (date) => {
  if (!db) return;
  await deleteDoc(doc(db, "dailyReports", date));
};

export const saveDailyReports = async (reports) => {
  if (!db) return;

  await Promise.all(
    Object.entries(reports).map(([date, report]) => saveDailyReport(date, report)),
  );
};
