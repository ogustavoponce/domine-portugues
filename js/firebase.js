// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  OAuthProvider,
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc,
  collection, 
  getDocs, 
  onSnapshot, // Para o chat em tempo real
  where, 
  query, 
  orderBy, // Para ordenar mensagens
  limit,
  updateDoc, 
  arrayUnion,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCiWKDMJ9LkBa_9OLauUNFJ9_TPC60h4o",
  authDomain: "domine-portugues.firebaseapp.com",
  projectId: "domine-portugues",
  storageBucket: "domine-portugues.firebasestorage.app",
  messagingSenderId: "717323019793",
  appId: "1:717323019793:web:46c0baaae240b17dbdf3b0",
  measurementId: "G-WXQNKS0VY7"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  GoogleAuthProvider, OAuthProvider, signInWithPopup, 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signOut, onAuthStateChanged, firebaseUpdateProfile,
  doc, setDoc, getDoc, addDoc, collection, getDocs, onSnapshot,
  where, query, orderBy, limit, updateDoc, arrayUnion, serverTimestamp
};