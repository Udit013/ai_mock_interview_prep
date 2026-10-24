// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB6F7PqTUjFIDZzDeCNYC2U3kRFfZfDCkQ",
  authDomain: "prepwise-d59e4.firebaseapp.com",
  projectId: "prepwise-d59e4",
  storageBucket: "prepwise-d59e4.firebasestorage.app",
  messagingSenderId: "439771822604",
  appId: "1:439771822604:web:2aa60e5a6f8f0e35890c29",
  measurementId: "G-VE6HN839GQ"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Only Firebase Auth runs in the browser — all Firestore access goes through
// the Admin SDK on the server. Importing the Firestore client here used to pull
// its whole SDK into the sign-in bundle for nothing.
export const auth = getAuth(app);
