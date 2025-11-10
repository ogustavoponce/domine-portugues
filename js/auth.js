// js/auth.js
import { 
  auth, db, GoogleAuthProvider, OAuthProvider, signInWithPopup, 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signOut, onAuthStateChanged, doc, getDoc, setDoc, firebaseUpdateProfile
} from './firebase.js';
import * as store from './store.js';

// --- REGRA DO DONO ---
const DONO_EMAIL = 'domenico.suriale@ifpr.edu.br';

export function onAuthCheck(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      let profile = await store.getUserProfile(user.uid);
      // Se não tem perfil (ex: primeiro login Google), cria um
      if (!profile) {
        profile = await createUserProfile(user.uid, user.displayName || 'Usuário', user.email);
      }
      // Força atualização se for o Domenico (garantia)
      if (user.email === DONO_EMAIL && profile.role !== 'admin') {
         profile.role = 'admin';
         await setDoc(doc(db, 'users', user.uid), { role: 'admin' }, { merge: true });
      }
      callback(profile);
    } else {
      callback(null);
    }
  });
}

async function createUserProfile(uid, name, email) {
  // Define o papel com base no email
  let role = 'aluno';
  if (email === DONO_EMAIL) role = 'admin'; // Admin tem poder de Professor e Gestor

  const userRef = doc(db, 'users', uid);
  const profileData = { uid, name, email, role, createdAt: new Date() };
  await setDoc(userRef, profileData);
  return profileData;
}

export async function login(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  signOut(auth);
}

export async function register(name, email, password, code) {
  // Se NÃO for o dono, exige código de turma
  if (email !== DONO_EMAIL) {
      const turma = await store.findTurmaByCode(code);
      if (!turma) throw new Error('Código da turma inválido.');
  }

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  await firebaseUpdateProfile(user, { displayName: name });
  await createUserProfile(user.uid, name, email);
  
  // Se for aluno, adiciona na turma
  if (email !== DONO_EMAIL) {
      const turma = await store.findTurmaByCode(code);
      if (turma) await store.addUserToTurma(turma.id, user.uid);
  }
}

export async function socialLogin(providerName) {
  let provider;
  if (providerName === 'google') provider = new GoogleAuthProvider();
  if (providerName === 'apple') provider = new OAuthProvider('apple.com');

  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  let profile = await store.getUserProfile(user.uid);
  
  if (profile) return; // Já existe

  // Se for o Dono, passa direto sem pedir turma
  if (user.email === DONO_EMAIL) {
      await createUserProfile(user.uid, user.displayName, user.email);
      return;
  }

  // Se for aluno novo, exige turma
  const code = prompt(`Bem-vindo, ${user.displayName}!\nInsira o CÓDIGO DA TURMA para continuar:`);
  if (!code) {
      await deleteUser(user); // Cancela a criação da conta no Auth se não der código
      throw new Error('Cadastro cancelado: Turma obrigatória.');
  }
  const turma = await store.findTurmaByCode(code.trim());
  if (!turma) {
       // Idealmente deletaria o user do Auth aqui também para não ficar conta órfã
       throw new Error('Código inválido.');
  }

  await createUserProfile(user.uid, user.displayName, user.email);
  await store.addUserToTurma(turma.id, user.uid);
}