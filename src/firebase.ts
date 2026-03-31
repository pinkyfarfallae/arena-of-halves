import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDOfh_-qNM8RzPrNzobnqqMsEc5uJR1DwE",
  authDomain: "arena-of-halves.firebaseapp.com",
  databaseURL:
    "https://arena-of-halves-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "arena-of-halves",
  storageBucket: "arena-of-halves.firebasestorage.app",
  messagingSenderId: "859742258906",
  appId: "1:859742258906:web:5dd7fa6a5fa412254387e3",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const firestore = getFirestore(app);

// Enable offline persistence for Firestore (optional)
enableIndexedDbPersistence(firestore).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time
    console.warn('Firestore persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // The current browser doesn't support persistence
    console.warn('Firestore persistence not supported in this browser');
  }
});

export const functions = getFunctions(app, "asia-southeast1");
export const auth = getAuth(app);
