import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, setDoc, doc, getDoc, addDoc, deleteDoc, serverTimestamp, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- CONFIGURAÇÃO FIREBASE (COLE SUAS CHAVES AQUI) ---
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

// === LISTA DE PROFESSORES (ADMINS) ===
const ADMIN_EMAILS = [
    "domenico.suriale@ifpr.edu.br",
    "domenico@domineportugues.com.br",
    "admin@teste.com"
];

const state = { user: null, profile: null, isAdmin: false };
const el = (id) => document.getElementById(id);

function init() {
    setupListeners();
    onAuthStateChanged(auth, async (user) => {
        if (user) await handleLogin(user);
        else showLogin();
    });
}

// --- AUTENTICAÇÃO ---
async function handleLogin(user) {
    state.user = user;
    const email = user.email.toLowerCase().trim();
    
    // 1. Verifica se é Admin pela lista fixa
    state.isAdmin = ADMIN_EMAILS.includes(email);

    // 2. Busca ou Cria Perfil
    const userRef = doc(db, "users", user.uid);
    let snap = await getDoc(userRef);
    
    if (!snap.exists()) {
        const baseProfile = {
            name: user.displayName || "Usuário",
            email: email,
            role: state.isAdmin ? 'admin' : 'student',
            classCode: null
        };
        await setDoc(userRef, baseProfile);
        state.profile = baseProfile;
    } else {
        state.profile = snap.data();
        // Corrige permissão se for admin na lista mas não no banco
        if (state.isAdmin && state.profile.role !== 'admin') {
            await updateDoc(userRef, { role: 'admin' });
            state.profile.role = 'admin';
        }
    }

    // Atualiza Interface
    updateSidebar();
    document.getElementById('auth-view').classList.remove('active');
    document.getElementById('app-view').classList.add('active');
    
    if (state.isAdmin) navigateTo('home');
    else if (state.profile.classId) navigateTo('classroom');
    else navigateTo('profile'); // Aluno sem turma vai para perfil
}

function showLogin() {
    state.user = null;
    document.getElementById('app-view').classList.remove('active');
    document.getElementById('auth-view').classList.add('active');
}

// --- UI HELPERS ---
function updateSidebar() {
    const p = state.profile;
    el('u-name').innerText = p.name.split(' ')[0];
    el('u-role').innerText = state.isAdmin ? "Professor" : "Aluno";
    
    if (state.isAdmin) {
        el('admin-menu').classList.remove('hidden');
        el('student-menu').classList.add('hidden');
    } else {
        el('admin-menu').classList.add('hidden');
        el('student-menu').classList.remove('hidden');
    }
}

window.switchTab = (tab) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    if (tab === 'login') {
        el('login-form').classList.remove('hidden');
        el('register-form').classList.add('hidden');
    } else {
        el('login-form').classList.add('hidden');
        el('register-form').classList.remove('hidden');
    }
};

// --- NAVEGAÇÃO ---
window.navigateTo = (page) => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
    document.querySelector('.sidebar').classList.remove('open');
    
    const content = el('content-area');
    const title = el('page-title');
    
    if (page === 'home') renderHome(content, title);
    else if (page === 'classes') renderClasses(content, title);
    else if (page === 'students') renderStudents(content, title);
    else if (page === 'classroom') renderClassroom(content, title);
    else if (page === 'profile') renderProfile(content, title);
};

// --- RENDERIZADORES ---

// 1. HOME
function renderHome(div, title) {
    title.innerText = "Visão Geral";
    div.innerHTML = `
        <div class="card">
            <h3>Bem-vindo, ${state.profile.name}</h3>
            <p style="color:var(--text-sec)">Selecione uma opção no menu para começar.</p>
        </div>
        ${!state.isAdmin ? `<div class="card"><h3>Minha Turma</h3><p>Status: <strong>${state.profile.classCode || "Não matriculado"}</strong></p></div>` : ''}
    `;
}

// 2. TURMAS (ADMIN)
function renderClasses(div, title) {
    title.innerText = "Gestão de Turmas";
    div.innerHTML = `
        <div style="text-align:right; margin-bottom:20px">
            <button class="btn-primary" style="width:auto" onclick="openModal('New Class', formClass())">+ Nova Turma</button>
        </div>
        <div id="class-list">Carregando...</div>
    `;
    
    onSnapshot(collection(db, "classes"), snap => {
        const list = el('class-list');
        if (snap.empty) { list.innerHTML = "<p>Nenhuma turma.</p>"; return; }
        list.innerHTML = snap.docs.map(d => {
            const c = d.data();
            return `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center">
                <div><strong>${c.name}</strong><br><small>${c.code}</small></div>
                <button class="btn-primary" style="padding:8px 12px" onclick="alert('Entrar na turma: Em breve')">Gerenciar</button>
            </div>`;
        }).join('');
    });
}

// 3. ESTUDANTES (ADMIN)
function renderStudents(div, title) {
    title.innerText = "Alunos Cadastrados";
    div.innerHTML = `<div class="card"><div class="table-responsive"><table id="std-table"></table></div></div>`;
    
    onSnapshot(query(collection(db, "users"), where("role", "!=", "admin")), snap => {
        const rows = snap.docs.map(d => {
            const u = d.data();
            return `<tr><td>${u.name}</td><td>${u.email}</td><td><span class="tag">${u.classCode || '-'}</span></td></tr>`;
        }).join('');
        el('std-table').innerHTML = `<thead><tr><th>Nome</th><th>Email</th><th>Turma</th></tr></thead><tbody>${rows}</tbody>`;
    });
}

// 4. PERFIL
function renderProfile(div, title) {
    title.innerText = "Meu Perfil";
    const p = state.profile;
    div.innerHTML = `
        <div class="card" style="max-width:500px">
            <div class="input-group" style="margin-bottom:15px"><label>Nome</label><input id="pf-name" value="${p.name}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px"></div>
            <div class="input-group" style="margin-bottom:15px"><label>E-mail</label><input value="${p.email}" disabled style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; background:#eee"></div>
            ${!state.isAdmin ? `<div class="input-group" style="margin-bottom:15px"><label>Código da Turma</label><input id="pf-code" value="${p.classCode||''}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px"></div>` : ''}
            <button class="btn-primary" onclick="saveProfile()">Salvar Alterações</button>
        </div>
    `;
}

// 5. SALA DE AULA (ALUNO)
async function renderClassroom(div, title) {
    title.innerText = "Minha Sala";
    if (!state.profile.classId) {
        div.innerHTML = `<div class="card"><h3>Você não tem turma</h3><p>Vá em 'Meu Perfil' e digite o código da turma.</p></div>`;
        return;
    }
    // Lógica de carregar posts viria aqui
    div.innerHTML = `<div class="card"><h3>Mural da Turma</h3><p>Conteúdo será carregado aqui.</p></div>`;
}

// --- ACTIONS & MODALS ---
window.saveProfile = async () => {
    const name = el('pf-name').value;
    let updates = { name };
    
    if (!state.isAdmin) {
        const code = el('pf-code').value;
        const q = query(collection(db, "classes"), where("code", "==", code));
        const snap = await getDocs(q);
        if (snap.empty && code) return alert("Código inválido!");
        updates.classCode = code;
        if (!snap.empty) updates.classId = snap.docs[0].id;
    }
    await updateDoc(doc(db, "users", state.user.uid), updates);
    alert("Perfil salvo!");
};

window.createClass = async () => {
    const name = el('cls-name').value;
    const code = el('cls-code').value;
    if (!name || !code) return;
    await addDoc(collection(db, "classes"), { name, code });
    closeModal();
};

window.formClass = () => `
    <div class="input-group"><label>Nome</label><input id="cls-name" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px"></div>
    <div class="input-group" style="margin-top:10px"><label>Código</label><input id="cls-code" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px"></div>
    <button class="btn-primary" style="margin-top:20px" onclick="createClass()">Criar</button>
`;

window.openModal = (title, html) => {
    el('modal-title').innerText = title;
    el('modal-body').innerHTML = html;
    el('modal-overlay').classList.remove('hidden');
};
window.closeModal = () => el('modal-overlay').classList.add('hidden');

// --- SETUP ---
function setupListeners() {
    el('login-form').onsubmit = e => { e.preventDefault(); signInWithEmailAndPassword(auth, el('login-email').value, el('login-pass').value).catch(err => alert(err.message)); };
    el('register-form').onsubmit = async e => {
        e.preventDefault();
        try {
            const u = await createUserWithEmailAndPassword(auth, el('reg-email').value, el('reg-pass').value);
            await setDoc(doc(db, "users", u.user.uid), { name: el('reg-name').value, email: el('reg-email').value, role: 'student' });
        } catch(err){alert(err.message)}
    };
    el('btn-logout').onclick = () => signOut(auth);
    el('btn-google').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
    document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => navigateTo(b.dataset.page));
    el('mobile-toggle').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
}

init();