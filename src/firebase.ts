import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

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
