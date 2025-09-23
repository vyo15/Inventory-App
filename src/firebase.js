import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Konfigurasi Firebase dari Project Settings di Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAGB6rmd80Y-8IARwdv-fGbT6Jtcxww5ik",
  authDomain: "ziyocraft-inventory-app.firebaseapp.com",
  projectId: "ziyocraft-inventory-app",
  storageBucket: "ziyocraft-inventory-app.appspot.com", // 
  messagingSenderId: "15690184314",
  appId: "1:15690184314:web:78a7c31941da5023a1adc3",
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore
const db = getFirestore(app);

// Export biar bisa dipakai di file lain
export { db };
