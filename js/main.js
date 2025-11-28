// js/main.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  OAuthProvider,
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
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

// --- CONFIGURAÇÃO ---
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

// --- LÓGICA PRINCIPAL ---
document.addEventListener('DOMContentLoaded', () => {
  const pageId = document.body.id;

  // Verifica login globalmente
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Se já está logado e está na tela de login ou registro, vai pro app
      if (pageId === 'page-login' || pageId === 'page-register') {
        window.location.href = 'index.html';
      } 
      // Se está no app, carrega os dados
      else if (pageId === 'page-app') {
        const profile = await getUserProfile(user.uid);
        if (profile) initApp(profile);
      }
    } else {
      // Se não está logado e tenta acessar o app, volta pro login
      if (pageId === 'page-app') {
        window.location.href = 'login.html';
      }
    }
  });

  // Inicializa a página específica
  if (pageId === 'page-login') initLoginPage();
  if (pageId === 'page-register') initRegisterPage();
});

// --- PÁGINA DE LOGIN (SEU HTML ORIGINAL) ---
function initLoginPage() {
  const loginForm = document.getElementById('loginForm');
  const googleBtn = document.getElementById('googleLoginBtn'); // Se existir no seu HTML
  const appleBtn = document.getElementById('appleLoginBtn');   // Se existir no seu HTML
  const errLogin = document.getElementById('loginError');

  // Se você tiver o botão de "Cadastrar" na tela de login que muda de aba via JS, 
  // substitua a lógica dele para: window.location.href = 'register.html';
  const btnIrParaCadastro = document.getElementById('tab-register');
  if(btnIrParaCadastro) {
    btnIrParaCadastro.onclick = () => window.location.href = 'register.html';
  }

  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      if(errLogin) errLogin.textContent = '';
      try {
        const email = document.getElementById('emailLogin').value;
        const pass = document.getElementById('passwordLogin').value;
        await signInWithEmailAndPassword(auth, email, pass);
      } catch (error) {
        console.error(error);
        if(errLogin) errLogin.textContent = 'E-mail ou senha incorretos.';
      }
    };
  }

  if (googleBtn) {
    googleBtn.onclick = async () => handleSocialLogin(new GoogleAuthProvider());
  }
  if (appleBtn) {
    appleBtn.onclick = async () => handleSocialLogin(new OAuthProvider('apple.com'));
  }
}

// --- PÁGINA DE CADASTRO (NOVO HTML) ---
function initRegisterPage() {
  const registerForm = document.getElementById('registerForm');
  const errRegister = document.getElementById('registerError');
  const succRegister = document.getElementById('registerSuccess');

  if (registerForm) {
    registerForm.onsubmit = async (e) => {
      e.preventDefault();
      errRegister.textContent = '';
      succRegister.textContent = '';

      const name = document.getElementById('nameRegister').value;
      const email = document.getElementById('emailRegister').value;
      const pass = document.getElementById('passwordRegister').value;
      const code = document.getElementById('codeTurma').value;

      try {
        // 1. Verifica Turma
        const turma = await findTurma(code);
        if (!turma) throw new Error('Código da turma inválido.');

        // 2. Cria Auth
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        
        // 3. Cria Perfil
        await createUserProfile(cred.user.uid, name, email);
        
        // 4. Adiciona na Turma
        await addUserToTurma(turma.id, cred.user.uid);

        succRegister.textContent = 'Sucesso! Entrando...';
      } catch (error) {
        console.error(error);
        errRegister.textContent = error.message.includes('auth') ? 'Erro no e-mail ou senha.' : error.message;
      }
    };
  }
}

// --- FUNÇÕES DE BANCO DE DADOS ---
async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

async function createUserProfile(uid, name, email) {
  let role = 'aluno';
  if (email === 'domenico.suriale@ifpr.edu.br') role = 'admin';
  
  const data = { uid, name, email, role };
  await setDoc(doc(db, 'users', uid), data);
  return data;
}

async function findTurma(code) {
  const q = query(collection(db, 'turmas'), where('code', '==', code));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function addUserToTurma(turmaId, uid) {
  await updateDoc(doc(db, 'turmas', turmaId), { alunos: arrayUnion(uid) });
}

async function handleSocialLogin(provider) {
  try {
    const res = await signInWithPopup(auth, provider);
    const profile = await getUserProfile(res.user.uid);
    
    // Se não tem perfil, é cadastro novo via social
    if (!profile) {
      if (res.user.email === 'domenico.suriale@ifpr.edu.br') {
        await createUserProfile(res.user.uid, res.user.displayName, res.user.email);
      } else {
        const code = prompt("Primeiro acesso! Digite o código da turma:");
        if (!code) { 
          await signOut(auth); 
          throw new Error('Turma obrigatória.'); 
        }
        const turma = await findTurma(code);
        if (!turma) {
          await signOut(auth);
          throw new Error('Código inválido.');
        }
        await createUserProfile(res.user.uid, res.user.displayName, res.user.email);
        await addUserToTurma(turma.id, res.user.uid);
      }
    }
  } catch (e) {
    alert(e.message);
  }
}

// --- LÓGICA DO APP (DUMMY PARA NÃO DAR ERRO) ---
function initApp(user) {
  // Aqui carregaria o render.js e router.js
  // Como foco é o cadastro, vou deixar apenas o logout funcional
  const btnLogout = document.getElementById('btnLogout');
  if(btnLogout) {
    btnLogout.onclick = () => signOut(auth);
  }
  console.log("App iniciado para:", user.name);
}