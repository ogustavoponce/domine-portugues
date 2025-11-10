// js/store.js
import { 
  db, doc, getDoc, setDoc, addDoc, collection, getDocs, onSnapshot,
  where, query, orderBy, limit, updateDoc, arrayUnion, serverTimestamp 
} from './firebase.js';

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function findTurmaByCode(code) {
  const q = query(collection(db, 'turmas'), where('code', '==', code));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function addUserToTurma(turmaId, uid) {
  await updateDoc(doc(db, 'turmas', turmaId), { alunos: arrayUnion(uid) });
}

export async function getTurmasForUser(user) {
  let q;
  if (user.role === 'admin' || user.role === 'professor') {
    // Admin/Professor vê todas as turmas (ou filtradas por ID se tiver multiplos profs)
    q = query(collection(db, 'turmas'));
  } else {
    // Aluno só vê as suas
    q = query(collection(db, 'turmas'), where('alunos', 'array-contains', user.uid));
  }
  const snap = await getDocs(q);
  const turmas = [];
  snap.forEach(doc => turmas.push({ id: doc.id, ...doc.data() }));
  return turmas;
}

// --- NOVAS FUNÇÕES (MATERIAIS & CHAT) ---

// Cria um novo material (para o Professor)
export async function createMaterial(turmaId, titulo, tipo, conteudo) {
  await addDoc(collection(db, 'materiais'), {
    turmaId, titulo, tipo, conteudo, createdAt: serverTimestamp()
  });
}

// Busca materiais de uma turma
export async function getMateriais(turmaId) {
  const q = query(collection(db, 'materiais'), where('turmaId', '==', turmaId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({id: d.id, ...d.data()}));
}

// Envia mensagem no chat da turma
export async function sendChatMessage(turmaId, user, text) {
  await addDoc(collection(db, 'chat_mensagens'), {
    turmaId,
    userId: user.uid,
    userName: user.name,
    text,
    createdAt: serverTimestamp()
  });
}

// "Ouve" o chat em tempo real (usaremos no render.js)
export function subscribeToChat(turmaId, callback) {
  const q = query(
    collection(db, 'chat_mensagens'), 
    where('turmaId', '==', turmaId), 
    orderBy('createdAt', 'asc'),
    limit(50)
  );
  return onSnapshot(q, (snapshot) => {
    const mensagens = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
    callback(mensagens);
  });
}