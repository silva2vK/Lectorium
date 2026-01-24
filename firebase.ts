
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Configuração do Firebase (Apenas para Autenticação Google)
const firebaseConfig = {
  apiKey: "AIzaSyD_2ww4Km34XnxZtbvBFwxdku8RTFLGCsE",
  authDomain: "lectorium-sa.firebaseapp.com",
  projectId: "lectorium-sa",
  storageBucket: "lectorium-sa.firebasestorage.app",
  messagingSenderId: "315143132640",
  appId: "1:315143132640:web:3cfd2c9027e86c23424785"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
