// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
// Importações de Autenticação
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
// Importações do Firestore
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  where, 
  query, 
  updateDoc, 
  arrayUnion 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Sua config (não muda)
const firebaseConfig = {
  apiKey: "AIzaSyCCiWKDMJ9LkBa_9OLauUNFJ9_TPC60h4o",
  authDomain: "domine-portugues.firebaseapp.com",
  projectId: "domine-portugues",
  storageBucket: "domine-portugues.firebasestorage.app",
  messagingSenderId: "717323019793",
  appId: "1:717323019793:web:46c0baaae240b17dbdf3b0",
  measurementId: "G-WXQNKS0VY7"
};

// Inicializa e exporta os serviços
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Exporta as funções que vamos usar
export {
  // Auth
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  // Firestore
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  where, 
  query, 
  updateDoc, 
  arrayUnion
};