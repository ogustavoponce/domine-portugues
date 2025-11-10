// js/main.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, where, query, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCiWKDMJ9LkBa_9OLauUNFJ9_TPC60h4o",
  authDomain: "domine-portugues.firebaseapp.com",
  projectId: "domine-portugues",
  storageBucket: "domine-portugues.firebasestorage.app",
  messagingSenderId: "717323019793",
  appId: "1:717323019793:web:46c0baaae240b17dbdf3b0",
  measurementId: "G-WXQNKS0VY7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- FUNÇÕES DE BANCO DE DADOS ---
async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

async function createUserProfile(uid, name, email, role = 'aluno') {
  await setDoc(doc(db, 'users', uid), { uid, name, email, role });
  return { uid, name, email, role };
}

async function findTurma(code) {
  const q = query(collection(db, 'turmas'), where('code', '==', code));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function getTurmasForUser(user) {
  const q = user.role === 'professor' 
    ? query(collection(db, 'turmas'), where('professorId', '==', user.uid))
    : query(collection(db, 'turmas'), where('alunos', 'array-contains', user.uid));
  const snap = await getDocs(q);
  const turmas = [];
  snap.forEach(doc => turmas.push({ id: doc.id, ...doc.data() }));
  return turmas;
}

// --- ROTAS E PÁGINAS ---
document.addEventListener('DOMContentLoaded', () => {
  const pageId = document.body.id;
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (pageId === 'page-login' || pageId === 'page-register') {
        window.location.href = 'index.html';
      } else if (pageId === 'page-app') {
        const profile = await getUserProfile(user.uid);
        if (profile) initApp(profile);
      }
    } else {
      if (pageId === 'page-app') {
        window.location.href = 'login.html';
      }
    }
  });

  if (pageId === 'page-login') setupLogin();
  if (pageId === 'page-register') setupRegister();
});

function setupLogin() {
  const form = document.getElementById('loginForm');
  const googleBtn = document.getElementById('googleLoginBtn');
  const errorMsg = document.getElementById('loginError');

  form.onsubmit = async (e) => {
    e.preventDefault();
    errorMsg.textContent = '';
    try {
      await signInWithEmailAndPassword(auth, document.getElementById('emailLogin').value.trim(), document.getElementById('passwordLogin').value);
    } catch (error) {
      errorMsg.textContent = 'E-mail ou senha incorretos.';
    }
  };

  googleBtn.onclick = async () => {
    errorMsg.textContent = '';
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const user = result.user;
      const profile = await getUserProfile(user.uid);
      if (!profile) {
        const code = prompt("Primeiro acesso! Digite o código da sua turma:");
        if (!code) { await signOut(auth); return; }
        const turma = await findTurma(code);
        if (!turma) { alert("Código inválido."); await signOut(auth); return; }
        await createUserProfile(user.uid, user.displayName, user.email);
        await updateDoc(doc(db, 'turmas', turma.id), { alunos: arrayUnion(user.uid) });
      }
    } catch (error) {
      errorMsg.textContent = 'Erro ao entrar com Google.';
    }
  };
}

function setupRegister() {
  const form = document.getElementById('registerForm');
  const errorMsg = document.getElementById('registerError');

  form.onsubmit = async (e) => {
    e.preventDefault();
    errorMsg.textContent = '';
    try {
      const turma = await findTurma(document.getElementById('codeTurma').value.trim());
      if (!turma) throw new Error('Código da turma inválido.');
      const cred = await createUserWithEmailAndPassword(auth, document.getElementById('emailRegister').value.trim(), document.getElementById('passwordRegister').value);
      await createUserProfile(cred.user.uid, document.getElementById('nameRegister').value.trim(), document.getElementById('emailRegister').value.trim());
      await updateDoc(doc(db, 'turmas', turma.id), { alunos: arrayUnion(cred.user.uid) });
    } catch (error) {
      errorMsg.textContent = error.message;
    }
  };
}

// --- FUNÇÕES DE RENDERIZAÇÃO DO APP ---
async function initApp(user) {
  document.querySelector('.user-name').textContent = user.name;
  document.querySelector('.user-role').textContent = user.role === 'professor' ? 'Professor' : 'Aluno';
  document.querySelector('.sidebar-avatar').textContent = user.name.charAt(0).toUpperCase();
  document.getElementById('btnLogout').onclick = () => signOut(auth);

  const nav = document.querySelector('.sidebar-nav');
  nav.innerHTML = `
    <a href="#turmas" class="active">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
      Minhas Turmas
    </a>
    <a href="#apostilas">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
      Apostilas
    </a>
  `;

  window.addEventListener('hashchange', () => route(user));
  route(user);
}

async function route(user) {
  const hash = location.hash || '#turmas';
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === hash);
  });

  const main = document.querySelector('.main-content');
  
  if (hash === '#turmas') {
    main.innerHTML = '<h2 class="main-header">Minhas Turmas</h2><div id="turmas-list">Carregando...</div>';
    const turmas = await getTurmasForUser(user);
    const list = document.getElementById('turmas-list');
    if (turmas.length === 0) {
      list.innerHTML = '<p>Nenhuma turma encontrada.</p>';
    } else {
      list.innerHTML = '';
      turmas.forEach(t => {
        list.innerHTML += `
          <div class="dp-card">
            <div class="dp-card-title">${t.name}</div>
            <p>Código: <span class="dp-code-badge">${t.code}</span></p>
          </div>
        `;
      });
    }
  } else if (hash === '#apostilas') {
     main.innerHTML = '<h2 class="main-header">Apostilas</h2><p>Em construção...</p>';
  }
}