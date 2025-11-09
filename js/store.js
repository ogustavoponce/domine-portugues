// js/store.js
import { db, doc, getDoc, setDoc, collection, getDocs, where, query, updateDoc, arrayUnion } from './firebase.js';

/**
 * Busca o perfil de um usuário no Firestore
 */
export async function getUserProfile(uid) {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    return userSnap.data();
  } else {
    // Usuário logou (ex: Google) mas não tem perfil salvo
    return null;
  }
}

/**
 * Cria o perfil de um usuário no Firestore
 */
export async function createUserProfile(uid, name, email, role = 'aluno') {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    uid: uid,
    name: name,
    email: email,
    role: role
  });
  return { uid, name, email, role };
}

/**
 * Encontra uma turma pelo código
 */
export async function findTurmaByCode(code) {
  const turmasRef = collection(db, 'turmas');
  const q = query(turmasRef, where('code', '==', code));
  
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    return null; // Nenhuma turma encontrada
  }
  // Retorna o primeiro documento encontrado e seu ID
  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Adiciona um aluno a uma turma
 */
export async function addUserToTurma(turmaId, uid) {
  const turmaRef = doc(db, 'turmas', turmaId);
  await updateDoc(turmaRef, {
    alunos: arrayUnion(uid) // Adiciona o UID ao array 'alunos'
  });
}

/**
 * Busca todas as turmas de um usuário
 */
export async function getTurmasForUser(user) {
  const turmasRef = collection(db, 'turmas');
  let q;
  
  if (user.role === 'professor') {
    // Busca turmas onde o professorId é o UID do usuário
    q = query(turmasRef, where('professorId', '==', user.uid));
  } else {
    // Busca turmas onde o array 'alunos' contém o UID do usuário
    q = query(turmasRef, where('alunos', 'array-contains', user.uid));
  }

  const querySnapshot = await getDocs(q);
  const turmas = [];
  querySnapshot.forEach(doc => {
    turmas.push({ id: doc.id, ...doc.data() });
  });
  return turmas;
}