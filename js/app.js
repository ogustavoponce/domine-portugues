import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, OAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, setDoc, doc, getDoc, addDoc, deleteDoc, serverTimestamp, onSnapshot, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// SUAS CHAVES DO FIREBASE AQUI
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

// === LISTA DE ADMINS (Emails que VIRAM GESTOR AUTOMATICAMENTE) ===
const ADMIN_EMAILS = [
    "domenico.suriale@ifpr.edu.br",
    "admin@teste.com" // Senha sugerida: admin123
];

const state = { user: null, profile: null, isAdmin: false, currentClassId: null };
const el = (id) => document.getElementById(id);

// --- INIT ---
function init() {
    setupUI();
    onAuthStateChanged(auth, async (user) => {
        if (user) await handleSession(user);
        else logoutUI();
    });
}

// --- AUTH ---
async function handleSession(user) {
    state.user = user;
    const email = user.email.toLowerCase().trim();
    
    // 1. Force Admin Check
    const isSuper = ADMIN_EMAILS.includes(email);
    state.isAdmin = isSuper;

    // 2. Profile Sync
    const ref = doc(db, "users", user.uid);
    let snap = await getDoc(ref);
    
    if (!snap.exists()) {
        const base = { name: user.displayName || "Usuário", email: user.email, role: isSuper ? 'admin' : 'student', classCode: null };
        await setDoc(ref, base);
        state.profile = base;
    } else {
        state.profile = snap.data();
        // Correção Automática de Role
        if (isSuper && state.profile.role !== 'admin') {
            await updateDoc(ref, { role: 'admin' });
            state.profile.role = 'admin';
        }
    }

    renderSidebar();
    document.getElementById('auth-view').classList.remove('active');
    document.getElementById('app-view').classList.add('active');
    
    if (state.isAdmin) navigateTo('home');
    else if (state.profile.classId) openClassroom(state.profile.classId);
    else navigateTo('profile');
}

function logoutUI() {
    state.user = null;
    document.getElementById('app-view').classList.remove('active');
    document.getElementById('auth-view').classList.add('active');
}

function renderSidebar() {
    const p = state.profile;
    el('u-name').innerText = p.name.split(' ')[0];
    el('u-role').innerText = state.isAdmin ? "Professor" : "Aluno";
    el('u-avatar').innerText = p.name[0];
    
    el('admin-menu').classList.toggle('hidden', !state.isAdmin);
    el('student-menu').classList.toggle('hidden', state.isAdmin);
}

// --- NAVIGATION ---
window.navigateTo = (page) => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
    document.querySelector('.sidebar').classList.remove('open');
    
    const cont = el('content-area');
    const title = el('page-title');
    
    if(page === 'home') renderDashboard(cont, title);
    else if(page === 'classes') renderClasses(cont, title);
    else if(page === 'students') renderStudents(cont, title);
    else if(page === 'classroom') {
        if(state.profile.classId) openClassroom(state.profile.classId);
        else cont.innerHTML = "<div class='card'><h3>Você não tem turma</h3><p>Vá em 'Meu Perfil' e insira o código.</p></div>";
    }
    else if(page === 'profile') renderProfile(cont, title);
};

// --- RENDERERS ---

// 1. DASHBOARD
async function renderDashboard(div, title) {
    title.innerText = "Visão Geral";
    let s = { seg:"", ter:"", qua:"", qui:"", sex:"" };
    try { const sn = await getDoc(doc(db, "config", "schedule")); if(sn.exists()) s = sn.data(); } catch(e){}
    const ro = state.isAdmin ? "" : "readonly";

    div.innerHTML = `
        <div class="card fade-in">
            <div class="card-head"><h3><i class="ph ph-clock"></i> Horários de Atendimento</h3>${state.isAdmin ? '<button class="btn-primary" style="width:auto" onclick="saveSched()">Salvar</button>':''}</div>
            <div class="table-wrap"><table>
                <tr><td width="20%">Segunda</td><td><input id="s-seg" class="sched-in" value="${s.seg||''}" ${ro}></td></tr>
                <tr><td>Terça</td><td><input id="s-ter" class="sched-in" value="${s.ter||''}" ${ro}></td></tr>
                <tr><td>Quarta</td><td><input id="s-qua" class="sched-in" value="${s.qua||''}" ${ro}></td></tr>
                <tr><td>Quinta</td><td><input id="s-qui" class="sched-in" value="${s.qui||''}" ${ro}></td></tr>
                <tr><td>Sexta</td><td><input id="s-sex" class="sched-in" value="${s.sex||''}" ${ro}></td></tr>
            </table></div>
        </div>
        ${!state.isAdmin ? `<div class="card"><h3>Minha Turma</h3><p>Código: <strong>${state.profile.classCode || "Nenhum"}</strong></p><button class="btn-primary" onclick="navigateTo('classroom')" style="margin-top:15px">Entrar na Sala</button></div>` : ''}
    `;
}

// 2. TURMAS (ADMIN)
function renderClasses(div, title) {
    if(!state.isAdmin) return;
    title.innerText = "Gestão de Turmas";
    div.innerHTML = `<div style="text-align:right; margin-bottom:20px"><button class="btn-primary" style="width:auto" onclick="openClassModal()">+ Nova Turma</button></div><div id="c-list"></div>`;
    
    onSnapshot(collection(db, "classes"), snap => {
        el('c-list').innerHTML = snap.docs.map(d => {
            const c = d.data();
            return `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
                <div><strong>${c.name}</strong><br><span style="font-size:12px; color:#666">${c.code}</span></div>
                <div style="display:flex; gap:10px">
                    <button class="btn-primary" style="padding:8px 16px" onclick="openClassroom('${d.id}')">Gerenciar</button>
                    <button class="btn-outline" style="color:red" onclick="deleteDoc(doc(db,'classes','${d.id}'))"><i class="ph ph-trash"></i></button>
                </div>
            </div>`;
        }).join('') || '<p>Sem turmas.</p>';
    });
}

// 3. SECRETARIA (ADMIN)
async function renderStudents(div, title) {
    if(!state.isAdmin) return;
    title.innerText = "Secretaria";
    
    // Lista de Turmas para Mover
    const cs = await getDocs(collection(db, "classes"));
    let opts = '<option value="">Selecionar Turma...</option>';
    cs.forEach(c => opts += `<option value="${c.id}">${c.data().name}</option>`);
    el('move-select').innerHTML = opts;

    div.innerHTML = `<div class="card"><div class="table-wrap"><table id="std-table"></table></div></div>`;
    
    onSnapshot(query(collection(db, "users"), where("role", "!=", "admin")), snap => {
        const rows = snap.docs.map(d => {
            const u = d.data();
            return `<tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td><span style="background:#eee; padding:4px 8px; border-radius:6px; font-size:11px">${u.classCode || '-'}</span></td>
                <td>
                    <button class="btn-outline" style="padding:6px" title="Mover" onclick="openMove('${d.id}')"><i class="ph ph-arrows-left-right"></i></button>
                    <button class="btn-outline" style="padding:6px; color:red" title="Banir" onclick="if(confirm('Banir?')) deleteDoc(doc(db,'users','${d.id}'))"><i class="ph ph-user-minus"></i></button>
                </td>
            </tr>`;
        }).join('');
        el('std-table').innerHTML = `<thead><tr><th>Nome</th><th>Email</th><th>Turma</th><th>Ações</th></tr></thead><tbody>${rows}</tbody>`;
    });
}

// 4. SALA DE AULA
async function openClassroom(cid) {
    if(!cid) return;
    state.currentClassId = cid;
    const content = el('content-area');
    
    const cSnap = await getDoc(doc(db, "classes", cid));
    el('page-title').innerText = cSnap.exists() ? cSnap.data().name : "Sala de Aula";

    content.innerHTML = `
        ${state.isAdmin ? `<div style="text-align:right; margin-bottom:20px"><button class="btn-primary" style="width:auto" onclick="openPostModal()">Novo Post</button></div>` : ''}
        <div id="feed"></div>
    `;

    onSnapshot(query(collection(db, `classes/${cid}/posts`), orderBy("createdAt", "desc")), snap => {
        const feed = el('feed');
        if(snap.empty) { feed.innerHTML = "<p style='text-align:center; color:#999'>Mural vazio.</p>"; return; }
        
        feed.innerHTML = snap.docs.map(d => {
            const p = d.data();
            const date = p.createdAt ? new Date(p.createdAt.toDate()).toLocaleDateString() : '';
            return `
            <div class="post-card">
                <div class="post-meta"><span class="tag tag-${p.type}">${p.type}</span> <span>${date}</span></div>
                <div class="post-title">${p.title}</div>
                <div class="post-body">${p.body}</div>
                ${p.link ? `<a href="${p.link}" target="_blank" class="post-link"><i class="ph ph-link"></i> Abrir Anexo</a>` : ''}
                ${state.isAdmin ? `<div style="margin-top:10px; border-top:1px solid #eee; padding-top:8px"><button class="btn-outline" style="color:red; font-size:12px; border:none" onclick="deleteDoc(doc(db,'classes/${cid}/posts','${d.id}'))">Excluir</button></div>` : ''}
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
            <div class="input-float"><label style="font-size:12px; color:#666">Nome</label><input class="input-clean" value="${p.name}" disabled></div>
            <div class="input-float"><label style="font-size:12px; color:#666">E-mail</label><input class="input-clean" value="${p.email}" disabled></div>
            <div style="margin-top:20px">
                <label style="font-size:12px; font-weight:600">Código da Turma</label>
                <input id="pf-code" class="input-clean" value="${p.classCode||''}" placeholder="Insira o código">
                <button class="btn-primary" style="margin-top:10px" onclick="saveProfile()">Atualizar Turma</button>
            </div>
        </div>
    `;
}

// --- ACTIONS ---
window.saveSched = async () => {
    const s = { seg: el('s-seg').value, ter: el('s-ter').value, qua: el('s-qua').value, qui: el('s-qui').value, sex: el('s-sex').value };
    await setDoc(doc(db, "config", "schedule"), s);
    alert("Horário atualizado!");
};

window.saveProfile = async () => {
    const code = el('pf-code').value;
    const q = query(collection(db, "classes"), where("code", "==", code));
    const snap = await getDocs(q);
    if(snap.empty) return alert("Código inválido!");
    await updateDoc(doc(db, "users", state.user.uid), { classCode: code, classId: snap.docs[0].id });
    alert("Turma atualizada! Recarregue a página.");
};

window.createClassAction = async () => {
    const n = el('cls-name').value; const c = el('cls-code').value;
    if(!n || !c) return;
    await addDoc(collection(db, "classes"), { name: n, code: c });
    window.closeModals();
};

window.createPostAction = async () => {
    const title = el('post-title').value;
    const body = el('post-body').value;
    const type = el('post-type').value;
    const link = el('post-link').value;
    await addDoc(collection(db, `classes/${state.currentClassId}/posts`), { title, body, type, link, createdAt: serverTimestamp() });
    window.closeModals();
};

window.confirmMoveStudent = async () => {
    const uid = el('move-uid').value;
    const cid = el('move-select').value;
    if(!cid) return;
    const cSnap = await getDoc(doc(db, "classes", cid));
    await updateDoc(doc(db, "users", uid), { classId: cid, classCode: cSnap.data().code });
    window.closeModals();
};

// --- UTILS ---
window.openClassModal = () => { el('modal-overlay').classList.remove('hidden'); el('modal-class').classList.remove('hidden'); };
window.openPostModal = () => { el('modal-overlay').classList.remove('hidden'); el('modal-post').classList.remove('hidden'); };
window.openMove = (uid) => { el('move-uid').value = uid; el('modal-overlay').classList.remove('hidden'); el('modal-move').classList.remove('hidden'); };
window.closeModals = () => { el('modal-overlay').classList.add('hidden'); document.querySelectorAll('.modal-window').forEach(m => m.classList.add('hidden')); };
window.toggleAuthMode = (mode) => {
    if(mode === 'login') { el('login-form').classList.remove('hidden'); el('register-form').classList.add('hidden'); }
    else { el('login-form').classList.add('hidden'); el('register-form').classList.remove('hidden'); }
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active'));
};

function setupUI() {
    el('login-form').onsubmit = e => { e.preventDefault(); signInWithEmailAndPassword(auth, el('login-email').value, el('login-pass').value).catch(err=>alert(err.message)); };
    el('register-form').onsubmit = async e => {
        e.preventDefault();
        const code = el('reg-code').value;
        const q = query(collection(db, "classes"), where("code", "==", code));
        const snap = await getDocs(q);
        const cid = !snap.empty ? snap.docs[0].id : null;
        try {
            const u = await createUserWithEmailAndPassword(auth, el('reg-email').value, el('reg-pass').value);
            await setDoc(doc(db, "users", u.user.uid), { name: el('reg-name').value, email: el('reg-email').value, role: 'student', classCode: code, classId: cid });
        } catch(err){alert(err.message)}
    };
    el('btn-logout').onclick = () => signOut(auth);
    document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => navigateTo(b.dataset.page));
    el('mobile-btn').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
    el('btn-google').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
    el('btn-apple').onclick = () => signInWithPopup(auth, new OAuthProvider('apple.com'));
}

init();
