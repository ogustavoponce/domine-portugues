// js/auth.js
import { 
  auth, db, GoogleAuthProvider, signInWithPopup, 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signOut, onAuthStateChanged, doc, getDoc, setDoc 
} from './firebase.js';
import * as store from './store.js';

let currentUser = null;

/**
 * Verifica o estado da autenticação (o novo "getSession")
 * Isso é o "porteiro" principal do app.
 */
export function onAuthCheck(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Usuário está logado no Firebase
      // Agora, buscamos o perfil dele no Firestore
      let profile = await store.getUserProfile(user.uid);
      
      if (!profile) {
        // Raro, mas pode acontecer se o login foi pelo Google
        // e o cadastro não foi completado. Vamos criar um perfil básico.
        profile = await store.createUserProfile(user.uid, user.displayName, user.email);
      }
      currentUser = profile;
      callback(currentUser);
    } else {
      // Usuário não está logado
      currentUser = null;
      callback(null);
    }
  });
}

/**
 * Login com Email e Senha
 */
export async function login(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
  // O onAuthCheck vai cuidar do resto
}

/**
 * Logout
 */
export function logout() {
  signOut(auth);
}

/**
 * Cadastro com Email e Senha
 */
export async function register(name, email, password, code) {
  // 1. Verifica se a turma existe
  const turma = await store.findTurmaByCode(code);
  if (!turma) {
    throw new Error('Código da turma inválido.');
  }

  // 2. Cria o usuário no Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // 3. Cria o perfil do usuário no Firestore
  await store.createUserProfile(user.uid, name, email, 'aluno');

  // 4. Adiciona o usuário na turma
  await store.addUserToTurma(turma.id, user.uid);
  
  // Login é feito automaticamente após o cadastro
}

/**
 * Login com Google
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // Verifica se o perfil já existe
  const profile = await store.getUserProfile(user.uid);
  
  if (profile) {
    // Perfil já existe, usuário está logado
    return null; // Sucesso
  }

  // É um usuário novo. Precisamos pedir o código da turma.
  const code = prompt(`Bem-vindo, ${user.displayName}!\nÉ seu primeiro acesso.\n\nPor favor, insira o CÓDIGO DA TURMA:`);
  if (!code) throw new Error('Cadastro cancelado.');

  const turma = await store.findTurmaByCode(code.trim());
  if (!turma) {
    throw new Error('Código da turma inválido. Tente novamente.');
  }

  // Cria o perfil e adiciona na turma
  await store.createUserProfile(user.uid, user.displayName, user.email, 'aluno');
  await store.addUserToTurma(turma.id, user.uid);
  
  return null; // Sucesso
}