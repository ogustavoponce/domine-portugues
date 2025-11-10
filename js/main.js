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

// --- FUNÇÕES AUXILIARES ---
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

// --- GERENCIADOR DE ROTAS E PÁGINAS ---
document.addEventListener('DOMContentLoaded', () => {
  const pageId = document.body.id;
  
  // Ouve o estado da autenticação globalmente
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      // Usuário logado
      if (pageId === 'page-login' || pageId === 'page-register') {
        window.location.href = 'index.html';
      } else if (pageId === 'page-app') {
        const profile = await getUserProfile(firebaseUser.uid);
        if (profile) initApp(profile);
        // Se não tiver perfil (raro), poderia forçar logout ou completar cadastro
      }
    } else {
      // Usuário deslogado
      if (pageId === 'page-app') {
        window.location.href = 'login.html';
      }
    }
  });

  // Inicializa listeners específicos de cada página
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
      await signInWithEmailAndPassword(auth, form.emailLogin.value, form.passwordLogin.value);
    } catch (error) {
      errorMsg.textContent = 'E-mail ou senha incorretos.';
    }
  };

  googleLoginBtn.onclick = async () => {
    errorMsg.textContent = '';
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const user = result.user;
      // Verifica se precisa criar perfil básico após login Google
      const profile = await getUserProfile(user.uid);
      if (!profile) {
        const code = prompt("Primeiro acesso! Digite o código da sua turma:");
        if (!code) { await signOut(auth); return; } // Cancela se não der código
        
        const turma = await findTurma(code);
        if (!turma) { 
          alert("Código inválido."); await signOut(auth); return; 
        }
        
        await createUserProfile(user.uid, user.displayName, user.email);
        await updateDoc(doc(db, 'turmas', turma.id), { alunos: arrayUnion(user.uid) });
      }
    } catch (error) {
      console.error(error);
      errorMsg.textContent = 'Erro ao entrar com Google. Tente novamente.';
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
      const turma = await findTurma(form.codeTurma.value);
      if (!turma) throw new Error('Código da turma inválido.');

      const cred = await createUserWithEmailAndPassword(auth, form.emailRegister.value, form.passwordRegister.value);
      await createUserProfile(cred.user.uid, form.nameRegister.value, form.emailRegister.value);
      await updateDoc(doc(db, 'turmas', turma.id), { alunos: arrayUnion(cred.user.uid) });
    } catch (error) {
      errorMsg.textContent = error.message.includes('auth/') ? 'Erro ao criar conta (verifique o e-mail).' : error.message;
    }
  };
}

async function initApp(user) {
  // Renderiza Sidebar
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
  // (Adicione mais links aqui conforme necessário)

  // Carrega conteúdo inicial (Exemplo: Turmas)
  loadTurmas(user);
}

async function loadTurmas(user) {
  const main = document.querySelector('.main-content');
  main.innerHTML = '<h2 class="main-header">Minhas Turmas</h2><div id="turmas-list">Carregando...</div>';
  
  const q = user.role === 'professor' 
    ? query(collection(db, 'turmas'), where('professorId', '==', user.uid))
    : query(collection(db, 'turmas'), where('alunos', 'array-contains', user.uid));

  const snap = await getDocs(q);
  const list = document.getElementById('turmas-list');
  
  if (snap.empty) {
    list.innerHTML = '<p>Nenhuma turma encontrada.</p>';
    return;
  }

  list.innerHTML = '';
  snap.forEach(doc => {
    const t = doc.data();
    list.innerHTML += `
      <div class="dp-card">
        <div class="dp-card-title">${t.name}</div>
        <p>Código: <span class="dp-code-badge">${t.code}</span></p>
      </div>
    `;
  });
}