import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, setDoc, doc, getDoc, addDoc, deleteDoc, serverTimestamp, onSnapshot, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// CONFIGURAÇÃO FIREBASE
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

// === E-MAIL DO PROFESSOR (MESTRE) ===
// Qualquer usuário que logar com este e-mail vira Admin automaticamente
const MASTER_EMAIL = "domenico@domineportugues.com.br";

const state = { user: null, profile: null, isAdmin: false, currentClassId: null, editingId: null };
const el = (id) => document.getElementById(id);

// --- INICIALIZAÇÃO ---
function init() {
    setupListeners();
    onAuthStateChanged(auth, async (user) => {
        if (user) await handleSession(user);
        else logoutUI();
    });
}

// --- AUTENTICAÇÃO E SESSÃO ---
async function handleSession(user) {
    state.user = user;
    const emailNormal = user.email.toLowerCase().trim();
    
    // 1. Verificação de Segurança: É o Professor?
    const isProfessor = (emailNormal === MASTER_EMAIL);
    state.isAdmin = isProfessor;

    // 2. Sincronizar Perfil no Banco de Dados
    const userRef = doc(db, "users", user.uid);
    let snap = await getDoc(userRef);
    
    if (!snap.exists()) {
        // Primeiro acesso: Cria o perfil
        const baseProfile = { 
            name: user.displayName || "Usuário", 
            email: emailNormal, 
            role: isProfessor ? 'admin' : 'student', // Define role baseado no email
            classCode: null 
        };
        await setDoc(userRef, baseProfile);
        state.profile = baseProfile;
    } else {
        state.profile = snap.data();
        
        // CORREÇÃO AUTOMÁTICA: Se for o email do professor mas estiver como aluno, corrige agora.
        if (isProfessor && state.profile.role !== 'admin') {
            await updateDoc(userRef, { role: 'admin' });
            state.profile.role = 'admin';
        }
    }

    // Atualiza Interface
    updateSidebarUI();
    el('auth-view').classList.remove('active');
    el('app-view').classList.add('active');
    
    // Roteamento Inteligente
    if (state.isAdmin) navigateTo('home');
    else if (state.profile.classId) openClassroom(state.profile.classId);
    else navigateTo('profile'); // Aluno sem turma vai para perfil
}

function logoutUI() {
    state.user = null; state.profile = null;
    el('app-view').classList.remove('active');
    el('auth-view').classList.add('active');
}

function updateSidebarUI() {
    const p = state.profile;
    el('user-name').innerText = p.name.split(' ')[0];
    el('user-role').innerText = state.isAdmin ? "Professor" : "Aluno";
    el('user-avatar').innerText = p.name[0].toUpperCase();
    
    // Mostra menus baseados no cargo
    el('admin-menu').classList.toggle('hidden', !state.isAdmin);
    el('student-menu').classList.toggle('hidden', state.isAdmin);
}

// --- NAVEGAÇÃO ---
window.navigateTo = (page) => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-target="${page}"]`)?.classList.add('active');
    document.querySelector('.sidebar').classList.remove('open');
    
    const cont = el('dynamic-content');
    const tit = el('page-title');
    
    if(page === 'home') renderHome(cont, tit);
    else if(page === 'admin-classes') renderAdminClasses(cont, tit);
    else if(page === 'admin-students') renderAdminStudents(cont, tit);
    else if(page === 'profile') renderProfile(cont, tit);
    else if(page === 'classroom') {
        if(state.profile.classId) openClassroom(state.profile.classId);
        else cont.innerHTML = `<div class="card"><h3>Você não está matriculado</h3><p>Vá em 'Meu Perfil' e insira o código da turma fornecido pelo professor.</p></div>`;
    }
};

// --- RENDERIZADORES ---

// 1. DASHBOARD
async function renderHome(div, title) {
    title.innerText = "Visão Geral";
    let s = { seg:"", ter:"", qua:"", qui:"", sex:"" };
    try { const d = await getDoc(doc(db, "config", "schedule")); if(d.exists()) s = d.data(); } catch(e){}
    const ro = state.isAdmin ? "" : "readonly";

    div.innerHTML = `
        <div class="card">
            <div class="card-head"><h3><i class="ph ph-clock"></i> Horário de Atendimento</h3>${state.isAdmin?`<button class="btn-primary" style="width:auto" onclick="saveSchedule()">Salvar</button>`:''}</div>
            <div class="table-wrap"><table>
                <tr><td width="20%">Segunda</td><td><input id="s-seg" class="sched-input" value="${s.seg||''}" ${ro} placeholder="-"></td></tr>
                <tr><td>Terça</td><td><input id="s-ter" class="sched-input" value="${s.ter||''}" ${ro} placeholder="-"></td></tr>
                <tr><td>Quarta</td><td><input id="s-qua" class="sched-input" value="${s.qua||''}" ${ro} placeholder="-"></td></tr>
                <tr><td>Quinta</td><td><input id="s-qui" class="sched-input" value="${s.qui||''}" ${ro} placeholder="-"></td></tr>
                <tr><td>Sexta</td><td><input id="s-sex" class="sched-input" value="${s.sex||''}" ${ro} placeholder="-"></td></tr>
            </table></div>
        </div>
        ${!state.isAdmin ? `<div class="card"><h3>Minha Turma</h3><p>Código: <strong>${state.profile.classCode || 'N/A'}</strong></p><button class="btn-primary" style="margin-top:15px" onclick="navigateTo('classroom')">Ir para Sala de Aula</button></div>`:''}
    `;
}

// 2. TURMAS
function renderAdminClasses(div, title) {
    if(!state.isAdmin) return;
    title.innerText = "Gerir Turmas";
    div.innerHTML = `<div style="text-align:right; margin-bottom:20px"><button class="btn-primary" style="width:auto" onclick="openClassModal()">+ Nova Turma</button></div><div id="list-classes"></div>`;
    
    onSnapshot(collection(db, "classes"), snap => {
        el('list-classes').innerHTML = snap.docs.map(d => {
            const c = d.data();
            return `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px">
                <div><strong>${c.name}</strong><br><small style="color:#666">${c.code}</small></div>
                <div class="action-row">
                    <button class="btn-icon" title="Entrar" onclick="openClassroom('${d.id}')"><i class="ph ph-arrow-right"></i></button>
                    <button class="btn-icon" title="Editar" onclick="openClassModal('${d.id}','${c.name}','${c.code}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn-icon del" title="Excluir" onclick="deleteItem('classes','${d.id}')"><i class="ph ph-trash"></i></button>
                </div>
            </div>`;
        }).join('') || '<p>Nenhuma turma encontrada.</p>';
    });
}

// 3. ALUNOS
async function renderAdminStudents(div, title) {
    if(!state.isAdmin) return;
    title.innerText = "Controle de Alunos";
    
    const classes = await getDocs(collection(db, "classes"));
    let opts = '<option value="">Selecionar Turma...</option>';
    classes.forEach(c => opts += `<option value="${c.id}">${c.data().name}</option>`);
    el('edit-class-select').innerHTML = opts;

    div.innerHTML = `<div class="card"><div class="table-wrap"><table id="table-students"></table></div></div>`;
    
    onSnapshot(query(collection(db, "users"), where("role", "!=", "admin")), snap => {
        const rows = snap.docs.map(d => {
            const u = d.data();
            return `<tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td><span class="badge">${u.classCode || '-'}</span></td>
                <td>
                    <div class="action-row">
                        <button class="btn-icon" onclick="openStudentModal('${d.id}','${u.name}','${u.email}','${u.classId}')"><i class="ph ph-pencil-simple"></i></button>
                        <button class="btn-icon del" onclick="deleteItem('users','${d.id}')"><i class="ph ph-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        el('table-students').innerHTML = `<thead><tr><th>Nome</th><th>Email</th><th>Turma</th><th>Ações</th></tr></thead><tbody>${rows}</tbody>`;
    });
}

// 4. SALA DE AULA
async function openClassroom(cid) {
    if(!cid) return;
    state.currentClassId = cid;
    const content = el('dynamic-content');
    
    const cSnap = await getDoc(doc(db, "classes", cid));
    if(!cSnap.exists()) return alert("Turma não existe.");
    el('page-title').innerText = cSnap.data().name;

    content.innerHTML = `
        ${state.isAdmin ? `<div style="text-align:right; margin-bottom:20px"><button class="btn-primary" style="width:auto" onclick="openPostModal()">Criar Post</button></div>` : ''}
        <div id="feed-area"></div>
    `;

    onSnapshot(query(collection(db, `classes/${cid}/posts`), orderBy("createdAt", "desc")), snap => {
        const feed = el('feed-area');
        if(snap.empty) { feed.innerHTML = "<p style='text-align:center; color:#999'>Mural vazio.</p>"; return; }
        
        feed.innerHTML = snap.docs.map(d => {
            const p = d.data();
            const date = p.createdAt ? new Date(p.createdAt.toDate()).toLocaleDateString() : '';
            return `
            <div class="post-card">
                <div class="post-meta"><span class="badge" style="background:#f0f0f0">${p.type}</span> <span>${date}</span></div>
                <div class="post-title">${p.title}</div>
                <div class="post-body">${p.body}</div>
                ${p.link ? `<a href="${p.link}" target="_blank" class="post-link">Abrir Anexo &rarr;</a>` : ''}
                ${state.isAdmin ? `<div style="margin-top:10px; border-top:1px solid #eee; padding-top:8px"><button class="btn-text" style="color:red; font-size:12px" onclick="deleteDoc(doc(db,'classes/${cid}/posts','${d.id}'))">Excluir</button></div>` : ''}
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
            <label style="font-size:12px; font-weight:600">Nome</label>
            <input class="input-std" id="pf-name" value="${p.name}">
            <label style="font-size:12px; font-weight:600">E-mail</label>
            <input class="input-std" value="${p.email}" disabled style="background:#f9f9f9">
            <label style="font-size:12px; font-weight:600">Código da Turma</label>
            <input class="input-std" id="pf-code" value="${p.classCode||''}" ${state.isAdmin ? 'disabled' : ''} placeholder="Insira o código da turma">
            <button class="btn-primary" onclick="saveProfile()">Salvar Alterações</button>
        </div>
    `;
}

// --- ACTIONS ---
window.saveSchedule = async () => {
    const s = { seg: el('s-seg').value, ter: el('s-ter').value, qua: el('s-qua').value, qui: el('s-qui').value, sex: el('s-sex').value };
    await setDoc(doc(db, "config", "schedule"), s);
    alert("Salvo!");
};

window.saveProfile = async () => {
    const name = el('pf-name').value;
    const code = el('pf-code').value;
    let updates = { name };

    if (!state.isAdmin && code && code !== state.profile.classCode) {
        const q = query(collection(db, "classes"), where("code", "==", code));
        const snap = await getDocs(q);
        if(snap.empty) return alert("Código de turma inválido!");
        updates.classCode = code;
        updates.classId = snap.docs[0].id;
    }
    
    await updateDoc(doc(db, "users", state.user.uid), updates);
    alert("Perfil atualizado! Recarregue a página.");
};

window.openClassModal = (id, name, code) => {
    state.editingId = id || null;
    el('cls-name').value = name || '';
    el('cls-code').value = code || '';
    el('modal-class-title').innerText = id ? "Editar Turma" : "Nova Turma";
    el('modal-overlay').classList.remove('hidden'); el('modal-class').classList.remove('hidden');
};

window.saveClassAction = async () => {
    const name = el('cls-name').value;
    const code = el('cls-code').value;
    if(!name || !code) return;
    
    if(state.editingId) {
        await updateDoc(doc(db, "classes", state.editingId), { name, code });
    } else {
        await addDoc(collection(db, "classes"), { name, code });
    }
    window.closeModals();
};

window.openStudentModal = (uid, name, email, cid) => {
    state.editingId = uid;
    el('edit-name').value = name;
    el('edit-email').value = email;
    el('edit-class-select').value = cid || "";
    el('modal-overlay').classList.remove('hidden'); el('modal-student').classList.remove('hidden');
};

window.saveStudentAction = async () => {
    const uid = state.editingId;
    const name = el('edit-name').value;
    const cid = el('edit-class-select').value;
    
    let updates = { name, classId: cid };
    if(cid) {
        const cSnap = await getDoc(doc(db, "classes", cid));
        if(cSnap.exists()) updates.classCode = cSnap.data().code;
    } else {
        updates.classCode = null;
    }
    
    await updateDoc(doc(db, "users", uid), updates);
    window.closeModals();
};

window.openPostModal = () => { el('modal-overlay').classList.remove('hidden'); el('modal-post').classList.remove('hidden'); };
window.createPostAction = async () => {
    const title = el('post-title').value;
    const type = el('post-type').value;
    const body = el('post-body').value;
    const link = el('post-link').value;
    await addDoc(collection(db, `classes/${state.currentClassId}/posts`), { title, type, body, link, createdAt: serverTimestamp() });
    window.closeModals();
};

window.deleteItem = async (col, id) => {
    if(confirm("Tem certeza? Esta ação não pode ser desfeita.")) await deleteDoc(doc(db, col, id));
};

// Utils
window.closeModals = () => { el('modal-overlay').classList.add('hidden'); document.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden')); };
window.toggleTab = (t) => {
    if(t === 'login') { el('login-form').classList.remove('hidden'); el('register-form').classList.add('hidden'); }
    else { el('login-form').classList.add('hidden'); el('register-form').classList.remove('hidden'); }
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active'));
};

function setupListeners() {
    el('login-form').onsubmit = e => { e.preventDefault(); signInWithEmailAndPassword(auth, el('login-email').value, el('login-pass').value).catch(e=>alert("Erro no login: " + e.message)); };
    el('register-form').onsubmit = async e => {
        e.preventDefault();
        const code = el('reg-code').value;
        // Valida Código (só deixa cadastrar se a turma existir)
        const q = query(collection(db, "classes"), where("code", "==", code));
        const s = await getDocs(q);
        const cid = !s.empty ? s.docs[0].id : null;
        
        if(!cid) return alert("Código de turma inválido! Peça ao professor.");

        try {
            const u = await createUserWithEmailAndPassword(auth, el('reg-email').value, el('reg-pass').value);
            await setDoc(doc(db, "users", u.user.uid), { name: el('reg-name').value, email: el('reg-email').value, role: 'student', classCode: code, classId: cid });
        } catch(e){alert("Erro no cadastro: " + e.message)}
    };
    el('btn-logout').onclick = () => signOut(auth);
    document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => navigateTo(b.dataset.target));
    el('mobile-toggle').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
    el('btn-google').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
}

init();