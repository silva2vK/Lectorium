
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAROw7quwsp8lIKjnXnT9dhg6C3iwvepTc",
  authDomain: "lectorium-v2.firebaseapp.com",
  projectId: "lectorium-v2",
  storageBucket: "lectorium-v2.firebasestorage.app",
  messagingSenderId: "880199487015",
  appId: "1:880199487015:web:547fdd08fbc51a57890802",
  measurementId: "G-Q94QEDSTYC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
