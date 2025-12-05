import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, OAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, setDoc, doc, getDoc, addDoc, deleteDoc, serverTimestamp, onSnapshot, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// SUAS CHAVES DO FIREBASE
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

// === LISTA DE ADMINS (ADICIONE AQUI) ===
const ADMIN_EMAILS = [
    "domenico.suriale@ifpr.edu.br",
    "admin@teste.com" // Email para teste se precisar
];

const state = { user: null, profile: null, isAdmin: false, currentClassId: null };
const el = (id) => document.getElementById(id);

// --- INIT ---
function init() {
    setupUIListeners();
    onAuthStateChanged(auth, async (user) => {
        if (user) await handleSession(user);
        else handleLogout();
    });
}

// --- AUTH & SESSION MANAGER ---
async function handleSession(user) {
    state.user = user;
    const emailNormal = user.email.toLowerCase().trim();
    
    // 1. Check Admin List
    const isSuperAdmin = ADMIN_EMAILS.includes(emailNormal);
    state.isAdmin = isSuperAdmin;

    // 2. Sync Firestore Profile
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    
    if (!snap.exists()) {
        const base = { 
            name: user.displayName || "Usuário", 
            email: user.email, 
            role: isSuperAdmin ? 'admin' : 'student',
            classCode: null 
        };
        await setDoc(ref, base);
        state.profile = base;
    } else {
        state.profile = snap.data();
        // Force update role if in admin list
        if (isSuperAdmin && state.profile.role !== 'admin') {
            await updateDoc(ref, { role: 'admin' });
            state.profile.role = 'admin';
        }
    }

    // Update UI
    updateSidebarUI();
    el('auth-view').classList.remove('active');
    el('app-view').classList.add('active');
    
    // Redirect based on role
    if (state.isAdmin) navigateTo('dashboard');
    else if (state.profile.classId) navigateTo('classroom');
    else navigateTo('profile'); // Force profile check if no class
}

function handleLogout() {
    state.user = null; state.profile = null; state.isAdmin = false;
    el('app-view').classList.remove('active');
    el('auth-view').classList.add('active');
}

function updateSidebarUI() {
    const p = state.profile;
    el('u-name').textContent = p.name.split(' ')[0];
    el('u-email').textContent = p.email;
    el('u-avatar').textContent = p.name[0];
    el('u-role-badge').textContent = state.isAdmin ? "Professor" : "Aluno";

    if (state.isAdmin) {
        el('admin-menu').classList.remove('hidden');
        el('student-menu').classList.add('hidden');
    } else {
        el('admin-menu').classList.add('hidden');
        el('student-menu').classList.remove('hidden');
    }
}

// --- NAVIGATION CONTROLLER ---
window.navigateTo = (page) => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
    document.querySelector('.sidebar').classList.remove('open');
    
    const container = el('content-area');
    const title = el('page-title');
    
    if (page === 'dashboard') renderDashboard(container, title);
    else if (page === 'classes') renderClasses(container, title);
    else if (page === 'students') renderStudents(container, title);
    else if (page === 'classroom') openClassroom(container, title, null, state.profile.classCode);
    else if (page === 'profile') renderProfile(container, title);
};

// --- RENDERERS ---

// 1. DASHBOARD & HORÁRIO
async function renderDashboard(container, title) {
    title.innerText = "Visão Geral";
    let s = { seg:"", ter:"", qua:"", qui:"", sex:"" };
    try { const docSnap = await getDoc(doc(db, "config", "schedule")); if(docSnap.exists()) s = docSnap.data(); } catch(e){}
    
    const ro = state.isAdmin ? "" : "readonly";
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="ph ph-clock"></i> Quadro de Horários</h3>
                ${state.isAdmin ? `<button class="btn-primary" style="width:auto" onclick="saveSchedule()">Salvar</button>` : ''}
            </div>
            <table>
                <tr><td width="20%">Segunda</td><td><input id="h-seg" class="sched-input" value="${s.seg||''}" ${ro} placeholder="-"></td></tr>
                <tr><td>Terça</td><td><input id="h-ter" class="sched-input" value="${s.ter||''}" ${ro} placeholder="-"></td></tr>
                <tr><td>Quarta</td><td><input id="h-qua" class="sched-input" value="${s.qua||''}" ${ro} placeholder="-"></td></tr>
                <tr><td>Quinta</td><td><input id="h-qui" class="sched-input" value="${s.qui||''}" ${ro} placeholder="-"></td></tr>
                <tr><td>Sexta</td><td><input id="h-sex" class="sched-input" value="${s.sex||''}" ${ro} placeholder="-"></td></tr>
            </table>
        </div>
        ${!state.isAdmin ? `<div class="card"><h3>Minha Turma</h3><p>Código: <strong>${state.profile.classCode || "N/A"}</strong></p><button class="btn-primary" style="margin-top:15px" onclick="navigateTo('classroom')">Ir para Sala de Aula</button></div>` : ''}
    `;
}

// 2. TURMAS (ADMIN)
function renderClasses(container, title) {
    if(!state.isAdmin) return;
    title.innerText = "Turmas";
    container.innerHTML = `<div style="text-align:right; margin-bottom:20px"><button class="btn-primary" style="width:auto" onclick="openClassModal()">+ Nova Turma</button></div><div id="class-list"></div>`;
    
    onSnapshot(collection(db, "classes"), snap => {
        const div = el('class-list');
        if(snap.empty) { div.innerHTML = "<p>Nenhuma turma.</p>"; return; }
        div.innerHTML = snap.docs.map(d => {
            const c = d.data();
            return `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
                <div><strong>${c.name}</strong><br><span style="font-size:12px; color:#666">Código: ${c.code}</span></div>
                <div style="display:flex; gap:10px">
                    <button class="btn-outline" onclick="openClassroom(el('content-area'), el('page-title'), '${d.id}')">Gerenciar</button>
                    <button class="btn-outline" style="color:red; border-color:#fee2e2" onclick="deleteDoc(doc(db,'classes','${d.id}'))"><i class="ph ph-trash"></i></button>
                </div>
            </div>`;
        }).join('');
    });
}

// 3. ESTUDANTES (ADMIN)
async function renderStudents(container, title) {
    if(!state.isAdmin) return;
    title.innerText = "Alunos Cadastrados";
    
    // Dropdown para mover
    const classes = await getDocs(collection(db, "classes"));
    let opts = '<option value="">Selecionar Turma...</option>';
    classes.forEach(c => { opts += `<option value="${c.id}">${c.data().name}</option>` });
    el('move-class-select').innerHTML = opts;

    container.innerHTML = `<div class="card"><div class="table-responsive"><table id="std-table"></table></div></div>`;
    
    onSnapshot(query(collection(db, "users"), where("role", "!=", "admin")), snap => {
        const tbody = snap.docs.map(d => {
            const u = d.data();
            return `<tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td><span class="badge" style="background:#eee">${u.classCode || 'Sem Turma'}</span></td>
                <td>
                    <button class="btn-outline" style="padding:6px" title="Mover" onclick="openMoveModal('${d.id}')"><i class="ph ph-arrows-left-right"></i></button>
                    <button class="btn-outline" style="padding:6px; color:red" title="Remover" onclick="if(confirm('Banir?')) deleteDoc(doc(db,'users','${d.id}'))"><i class="ph ph-user-minus"></i></button>
                </td>
            </tr>`;
        }).join('');
        el('std-table').innerHTML = `<thead><tr><th>Nome</th><th>Email</th><th>Turma</th><th>Ações</th></tr></thead><tbody>${tbody}</tbody>`;
    });
}

// 4. SALA DE AULA (MURAL)
async function openClassroom(container, title, cid, code) {
    // Resolve ID via Code (Aluno)
    if (!cid && code) {
        const q = query(collection(db, "classes"), where("code", "==", code));
        const s = await getDocs(q);
        if (!s.empty) cid = s.docs[0].id;
        else { container.innerHTML = "<div class='card'><h3>Turma não encontrada.</h3></div>"; return; }
    }
    state.currentClassId = cid;
    
    // Info da Turma
    const cSnap = await getDoc(doc(db, "classes", cid));
    const cData = cSnap.data();
    title.innerText = cData ? cData.name : "Sala de Aula";

    const adminBtn = state.isAdmin ? `<button class="btn-primary" style="width:auto" onclick="openPostModal()">Criar Postagem</button>` : '';

    container.innerHTML = `
        <div style="display:flex; justify-content:flex-end; margin-bottom:20px">${adminBtn}</div>
        <div id="posts-feed"></div>
    `;

    onSnapshot(query(collection(db, `classes/${cid}/posts`), orderBy("createdAt", "desc")), snap => {
        const feed = el('posts-feed');
        if(snap.empty) { feed.innerHTML = "<p style='text-align:center; color:#999'>Mural vazio.</p>"; return; }
        
        feed.innerHTML = snap.docs.map(d => {
            const p = d.data();
            const date = p.createdAt ? new Date(p.createdAt.toDate()).toLocaleDateString() : '';
            return `
            <div class="post-card">
                <div class="post-meta">
                    <span class="badge badge-${p.type}">${p.type}</span>
                    <span>${date}</span>
                </div>
                <h3>${p.title}</h3>
                <p>${p.content}</p>
                ${p.link ? `<a href="${p.link}" target="_blank" class="post-link"><i class="ph ph-link"></i> Abrir Anexo</a>` : ''}
                ${state.isAdmin ? `<div class="post-action"><button class="btn-text" style="color:red; font-size:12px" onclick="deleteDoc(doc(db,'classes/${cid}/posts','${d.id}'))">Excluir Postagem</button></div>` : ''}
            </div>`;
        }).join('');
    });
}

// 5. PERFIL
function renderProfile(div, title) {
    title.innerText = "Meu Perfil";
    const p = state.profile;
    div.innerHTML = `
        <div class="card" style="max-width:500px">
            <h3>Dados Pessoais</h3>
            <div class="input-group"><label>Nome</label><input class="form-input" value="${p.name}" disabled></div>
            <div class="input-group"><label>E-mail</label><input class="form-input" value="${p.email}" disabled></div>
            <div class="input-group">
                <label>Código da Turma</label>
                <input class="form-input" id="pf-code" value="${p.classCode||''}" placeholder="Ex: PORT-3A">
                <small style="color:#666">Mude aqui se trocou de turma.</small>
            </div>
            <button class="btn-primary" onclick="saveProfileCode()">Atualizar Código</button>
        </div>
    `;
}

// --- ACTIONS ---
window.saveSchedule = async () => {
    const s = { seg: el('h-seg').value, ter: el('h-ter').value, qua: el('h-qua').value, qui: el('h-qui').value, sex: el('h-sex').value };
    await setDoc(doc(db, "config", "schedule"), s);
    alert("Horário atualizado!");
};

window.saveProfileCode = async () => {
    const code = el('pf-code').value;
    const q = query(collection(db, "classes"), where("code", "==", code));
    const s = await getDocs(q);
    
    if(s.empty) return alert("Código inválido!");
    
    await updateDoc(doc(db, "users", state.user.uid), { classCode: code, classId: s.docs[0].id });
    alert("Turma atualizada! Recarregue.");
};

window.createClassAction = async () => {
    const n = el('cls-name').value; const c = el('cls-code').value;
    if(!n || !c) return;
    await addDoc(collection(db, "classes"), { name: n, code: c });
    closeModals();
};

window.createPostAction = async () => {
    const title = el('post-title').value;
    const type = el('post-type').value;
    const content = el('post-content').value;
    const link = el('post-link').value;
    
    if(!title || !content) return alert("Preencha título e conteúdo");
    
    await addDoc(collection(db, `classes/${state.currentClassId}/posts`), {
        title, type, content, link, createdAt: serverTimestamp()
    });
    closeModals();
};

window.confirmMoveStudent = async () => {
    const uid = el('move-uid').value;
    const newId = el('move-class-select').value;
    if(!newId) return;
    
    // Get Code
    const cSnap = await getDoc(doc(db, "classes", newId));
    await updateDoc(doc(db, "users", uid), { classId: newId, classCode: cSnap.data().code });
    closeModals();
    alert("Aluno movido!");
};

// --- UTILS ---
window.toggleAuth = (mode) => {
    if(mode === 'register') { el('register-panel').classList.remove('hidden'); el('auth-container').classList.add('expand'); } 
    else { el('register-panel').classList.add('hidden'); }
    // Simplificado na versão clean para abas
    if(mode === 'register') { el('login-form').classList.add('hidden'); el('register-form').classList.remove('hidden'); }
    else { el('login-form').classList.remove('hidden'); el('register-form').classList.add('hidden'); }
};

window.openClassModal = () => { el('modal-overlay').classList.remove('hidden'); el('modal-class').classList.remove('hidden'); };
window.openPostModal = () => { el('modal-overlay').classList.remove('hidden'); el('modal-post').classList.remove('hidden'); };
window.openMoveModal = (uid) => { el('move-uid').value = uid; el('modal-overlay').classList.remove('hidden'); el('modal-move').classList.remove('hidden'); };
window.closeModals = () => { el('modal-overlay').classList.add('hidden'); document.querySelectorAll('.modal-window').forEach(m => m.classList.add('hidden')); };

// --- SETUP LISTENERS ---
function setupUIListeners() {
    el('login-form').addEventListener('submit', e => { e.preventDefault(); signInWithEmailAndPassword(auth, el('login-email').value, el('login-pass').value).catch(err => alert(err.message)); });
    el('register-form').addEventListener('submit', async e => {
        e.preventDefault();
        const code = el('reg-code').value;
        const q = query(collection(db, "classes"), where("code", "==", code));
        const s = await getDocs(q);
        const cid = !s.empty ? s.docs[0].id : null;
        
        try {
            const u = await createUserWithEmailAndPassword(auth, el('reg-email').value, el('reg-pass').value);
            await setDoc(doc(db, "users", u.user.uid), {
                name: el('reg-name').value, email: el('reg-email').value, role: 'student', classCode: code, classId: cid
            });
        } catch(err) { alert(err.message); }
    });
    
    el('btn-toggle-auth').addEventListener('click', () => window.toggleAuth('register'));
    el('btn-logout').addEventListener('click', () => signOut(auth));
    
    document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => navigateTo(b.dataset.page)));
    el('mobile-btn').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
    
    // Social
    el('btn-google').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
    el('btn-apple').addEventListener('click', () => signInWithPopup(auth, new OAuthProvider('apple.com')));
}

init();
