import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

document.addEventListener('DOMContentLoaded', () => {
  const pageId = document.body.id;
  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (pageId === 'page-login' || pageId === 'page-register') window.location.href = 'index.html';
      if (pageId === 'page-app') loadApp(user);
    } else {
      if (pageId === 'page-app') window.location.href = 'login.html';
    }
  });

  if (pageId === 'page-login') setupLogin();
  if (pageId === 'page-register') setupRegister();
});

function setupLogin() {
  const form = document.getElementById('loginForm');
  const err = document.getElementById('loginError');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await signInWithEmailAndPassword(auth, document.getElementById('emailLogin').value, document.getElementById('passwordLogin').value);
      } catch (e) { err.textContent = 'Erro: Verifique e-mail e senha.'; }
    };
  }
  document.getElementById('googleLoginBtn')?.addEventListener('click', () => socialLogin(new GoogleAuthProvider()));
  document.getElementById('appleLoginBtn')?.addEventListener('click', () => socialLogin(new OAuthProvider('apple.com')));
}

function setupRegister() {
  const form = document.getElementById('registerForm');
  const err = document.getElementById('registerError');
  const succ = document.getElementById('registerSuccess');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        succ.textContent = 'Processando...';
        const code = document.getElementById('codeTurma').value;
        const turma = await findTurma(code);
        if (!turma) throw new Error('Código da turma inválido.');
        
        const cred = await createUserWithEmailAndPassword(auth, document.getElementById('emailRegister').value, document.getElementById('passwordRegister').value);
        await createUserProfile(cred.user.uid, document.getElementById('nameRegister').value, cred.user.email);
        await addUserToTurma(turma.id, cred.user.uid);
        
        succ.textContent = 'Sucesso! Redirecionando...';
      } catch (e) {
        succ.textContent = '';
        err.textContent = e.message;
      }
    };
  }
}

async function loadApp(user) {
  const profile = await getDoc(doc(db, 'users', user.uid));
  const userData = profile.exists() ? profile.data() : { name: user.displayName, role: 'aluno' };
  
  document.querySelector('.user-name').textContent = userData.name;
  document.querySelector('.user-role').textContent = userData.role === 'admin' ? 'Professor' : 'Aluno';
  document.querySelector('.sidebar-avatar').textContent = userData.name.charAt(0).toUpperCase();
  document.getElementById('btnLogout').onclick = () => signOut(auth);

  const container = document.getElementById('dynamic-content');
  
  // --- GRADE DE HORÁRIOS (AULAS À TARDE) ---
  const gradeHtml = `
    <div class="dp-card">
      <div class="dp-card-title">Grade de Horários - Prof. Domenico</div>
      <div style="overflow-x:auto;">
      <table class="table">
        <thead><tr><th>Horário</th><th>Segunda</th><th>Terça</th><th>Quarta</th><th>Quinta</th><th>Sexta</th></tr></thead>
        <tbody>
          <tr style="background:#eaf4fb">
            <td>10:00 - 12:00</td>
            <td>Atendimento</td>
            <td style="color:#999">-</td>
            <td>Atendimento</td>
            <td>Atendimento</td>
            <td>Atendimento</td>
          </tr>
          <tr>
            <td>13:30 - 15:30</td>
            <td>Mecânica 1</td>
            <td>Automação 1</td>
            <td>Jogos 1</td>
            <td>-</td>
            <td>-</td>
          </tr>
          <tr>
            <td>16:00 - 18:00</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>Informática 1</td>
            <td>-</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
    <h3 style="margin: 20px 0; color:#114060;">Minhas Turmas</h3>
    <div id="turmas-list" style="display: grid; gap: 15px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">Carregando...</div>
  `;

  container.innerHTML = gradeHtml;

  const q = userData.role === 'admin' ? query(collection(db, 'turmas')) : query(collection(db, 'turmas'), where('alunos', 'array-contains', user.uid));
  const snap = await getDocs(q);
  const list = document.getElementById('turmas-list');
  list.innerHTML = '';
  
  if (snap.empty) list.innerHTML = '<p>Você não está em nenhuma turma.</p>';
  snap.forEach(d => {
    const t = d.data();
    list.innerHTML += `<div class="dp-card"><div class="dp-card-title">${t.name}</div>Código: <strong>${t.code}</strong></div>`;
  });
}

async function socialLogin(provider) {
  try {
    const res = await signInWithPopup(auth, provider);
    const profile = await getDoc(doc(db, 'users', res.user.uid));
    if (!profile.exists()) {
      if (res.user.email === 'domenico.suriale@ifpr.edu.br') {
         await createUserProfile(res.user.uid, res.user.displayName, res.user.email);
      } else {
         const code = prompt("Primeiro acesso! Código da turma:");
         if (!code) { await signOut(auth); throw new Error('Turma obrigatória.'); }
         const turma = await findTurma(code);
         if (!turma) { await signOut(auth); throw new Error('Inválido.'); }
         await createUserProfile(res.user.uid, res.user.displayName, res.user.email);
         await addUserToTurma(turma.id, res.user.uid);
      }
    }
  } catch (e) { alert(e.message); }
}

async function createUserProfile(uid, name, email) {
  let role = 'aluno';
  if (email === 'domenico.suriale@ifpr.edu.br') role = 'admin';
  await setDoc(doc(db, 'users', uid), { uid, name, email, role });
}

async function findTurma(code) {
  const q = query(collection(db, 'turmas'), where('code', '==', code));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function addUserToTurma(tid, uid) {
  await updateDoc(doc(db, 'turmas', tid), { alunos: arrayUnion(uid) });
}