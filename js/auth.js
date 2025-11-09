// js/auth.js
import { doGoogleLogin } from './firebase.js';
import * as store from './store.js';

/**
 * Pega a sessão do usuário no sessionStorage
 */
export function getSession() {
  const s = sessionStorage.getItem('NEXUS_SESSION');
  return s ? JSON.parse(s) : null;
}

/**
 * Salva a sessão do usuário
 */
function setSession(user) {
  sessionStorage.setItem('NEXUS_SESSION', JSON.stringify(user));
}

/**
 * Tenta logar um usuário com email e senha
 */
export function login(email, password) {
  const user = store.findUserByEmail(email);
  if (user && user.password === password) {
    setSession(user);
    return user;
  }
  return null; // Falha no login
}

/**
 * Faz o logout
 */
export function logout() {
  sessionStorage.removeItem('NEXUS_SESSION');
  location.href = 'login.html';
}

/**
 * Tenta cadastrar um novo usuário
 */
export function register(name, email, password, code) {
  if (store.findUserByEmail(email)) {
    throw new Error('Email já cadastrado.');
  }
  
  const turma = store.findTurmaByCode(code);
  if (!turma) {
    throw new Error('Código da turma inválido.');
  }

  // Registra o usuário no nosso 'store'
  store.registerNewUser({ name, email, password }, turma);
}

/**
 * Lida com o Login do Google
 */
export async function loginWithGoogle() {
  try {
    const result = await doGoogleLogin();
    const fbUser = result.user;
    
    // 1. Usuário já existe no nosso sistema?
    let localUser = store.findUserByEmail(fbUser.email);
    
    if (localUser) {
      // Já existe, apenas loga
      setSession(localUser);
      location.href = 'index.html';
      return;
    }

    // 2. É um usuário novo. Precisamos pedir o código da turma.
    const code = prompt(`Bem-vindo, ${fbUser.displayName}!\nÉ seu primeiro acesso.\n\nPor favor, insira o CÓDIGO DA TURMA:`);
    if (!code) throw new Error('Cadastro cancelado.');

    const turma = store.findTurmaByCode(code.trim());
    if (!turma) {
      throw new Error('Código da turma inválido. Tente novamente.');
    }

    // 3. Código válido! Criamos o usuário no nosso sistema.
    const newUser = store.registerNewUser({
      name: fbUser.displayName,
      email: fbUser.email,
      password: null // Veio do Google, não tem senha local
    }, turma);
    
    setSession(newUser);
    location.href = 'index.html';

  } catch (error) {
    console.error("Erro no Login Google:", error);
    // Retorna a mensagem de erro para ser exibida
    return error.message;
  }
}