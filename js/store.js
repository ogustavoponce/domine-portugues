// js/store.js

// 'data' vai guardar nossos dados em memória
let data = {};

/**
 * Carrega os dados. Pega do localStorage ou, se não existir,
 * usa os dados iniciais do 'database.js' (window.NEXUS_DB_SEED)
 */
export function loadData() {
  const localData = localStorage.getItem('NEXUS_DATA');
  if (localData) {
    data = JSON.parse(localData);
  } else {
    data = window.NEXUS_DB_SEED; // Pega os dados iniciais
    saveData(); // Salva no localStorage pela primeira vez
  }
  console.log('Dados carregados:', data);
}

/**
 * Salva os dados atuais no localStorage
 */
export function saveData() {
  localStorage.setItem('NEXUS_DATA', JSON.stringify(data));
}

/**
 * Funções para pegar dados (fácil de usar)
 */
export const getUsers = () => data.users;
export const getTurmas = () => data.turmas;
export const getAlunos = () => data.alunos;

/**
 * Funções para modificar os dados (exemplo)
 */
export function findUserByEmail(email) {
  return data.users.find(u => u.email === email);
}

export function findTurmaByCode(code) {
  return data.turmas.find(t => t.code === code);
}

export function registerNewUser(userData, turma) {
  const id = 'u' + Date.now();
  const newUser = {
    id: id,
    email: userData.email,
    password: userData.password, // Pode ser 'null' se for do Google
    name: userData.name,
    role: 'aluno'
  };

  data.users.push(newUser);
  data.alunos.push({ id, name: newUser.name, email: newUser.email });
  turma.alunos.push(id);

  saveData();
  return newUser;
}