import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, setDoc, doc, getDoc, addDoc, deleteDoc, serverTimestamp, onSnapshot, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

// === EMAILS ADMIN ===
const ADMIN_EMAILS = [
    "domenico@domineportugues.com.br", // Seu email novo
    "domenico.suriale@ifpr.edu.br",
    "admin@teste.com"
];

const state = { user: null, profile: null, isAdmin: false, currentClassId: null, editId: null };
const el = (id) => document.getElementById(id);

function init() {
    setupUI();
    onAuthStateChanged(auth, async (user) => {
        if (user) await loadSession(user);
        else logoutUI();
    });
}

// --- AUTH ---
async function loadSession(user) {
    state.user = user;
    const email = user.email.toLowerCase().trim();
    state.isAdmin = ADMIN_EMAILS.includes(email);

    const ref = doc(db, "users", user.uid);
    let snap = await getDoc(ref);
    
    if (!snap.exists()) {
        const base = { name: user.displayName || "Usuário", email, role: state.isAdmin ? 'admin' : 'student', classCode: null };
        await setDoc(ref, base);
        state.profile = base;
    } else {
        state.profile = snap.data();
        if (state.isAdmin && state.profile.role !== 'admin') await updateDoc(ref, { role: 'admin' });
    }
    if (state.isAdmin) state.profile.role = 'admin';

    renderSidebar();
    el('auth-view').classList.remove('active');
    el('app-view').classList.add('active');
    
    if (state.isAdmin) navigateTo('home');
    else if (state.profile.classId) openClassroom(state.profile.classId);
    else navigateTo('profile');
}

function logoutUI() {
    state.user = null; state.profile = null;
    el('app-view').classList.remove('active');
    el('auth-view').classList.add('active');
}

function renderSidebar() {
    const p = state.profile;
    el('u-name').innerText = p.name.split(' ')[0];
    el('u-role').innerText = state.isAdmin ? "Gestor" : "Aluno";
    el('u-avatar').innerText = p.name[0];
    
    el('admin-menu').classList.toggle('hidden', !state.isAdmin);
    el('student-menu').classList.toggle('hidden', state.isAdmin);
}

// --- NAV ---
window.navigateTo = (page) => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-target="${page}"]`)?.classList.add('active');
    document.querySelector('.sidebar').classList.remove('open');
    
    const cont = el('content-area');
    const tit = el('page-title');
    
    if (page === 'home') renderHome(cont, tit);
    else if (page === 'admin-classes') renderClasses(cont, tit);
    else if (page === 'admin-students') renderStudents(cont, tit);
    else if (page === 'profile') renderProfile(cont, tit);
    else if (page === 'classroom') {
        if(state.profile.classId) openClassroom(state.profile.classId);
        else cont.innerHTML = `<div class="card"><h3>Sem Turma</h3><p>Vá em 'Meu Perfil' para configurar.</p></div>`;
    }
};

// --- RENDERERS ---

// 1. HOME
async function renderHome(div, title) {
    title.innerText = "Visão Geral";
    let s = { seg:"", ter:"", qua:"", qui:"", sex:"" };
    try { const d = await getDoc(doc(db, "config", "schedule")); if(d.exists()) s = d.data(); } catch(e){}
    const ro = state.isAdmin ? "" : "readonly";

    div.innerHTML = `
        <div class="card">
            <div class="card-head"><h3>Horário de Atendimento</h3>${state.isAdmin?`<button class="btn-primary" style="width:auto" onclick="saveSched()">Salvar</button>`:''}</div>
            <div class="table-responsive"><table>
                <tr><td width="20%">Segunda</td><td><input id="h-seg" style="width:100%; border:none" value="${s.seg||''}" ${ro}></td></tr>
                <tr><td>Terça</td><td><input id="h-ter" style="width:100%; border:none" value="${s.ter||''}" ${ro}></td></tr>
                <tr><td>Quarta</td><td><input id="h-qua" style="width:100%; border:none" value="${s.qua||''}" ${ro}></td></tr>
                <tr><td>Quinta</td><td><input id="h-qui" style="width:100%; border:none" value="${s.qui||''}" ${ro}></td></tr>
                <tr><td>Sexta</td><td><input id="h-sex" style="width:100%; border:none" value="${s.sex||''}" ${ro}></td></tr>
            </table></div>
        </div>
        ${!state.isAdmin ? `<div class="card"><h3>Atalhos</h3><button class="btn-primary" onclick="navigateTo('classroom')">Minha Sala</button></div>`:''}
    `;
}

// 2. TURMAS (ADMIN)
function renderClasses(div, title) {
    title.innerText = "Gestão de Turmas";
    div.innerHTML = `<div style="text-align:right; margin-bottom:15px"><button class="btn-primary" style="width:auto" onclick="openClassModal()">+ Nova Turma</button></div><div id="c-list"></div>`;
    
    onSnapshot(collection(db, "classes"), snap => {
        el('c-list').innerHTML = snap.docs.map(d => {
            const c = d.data();
            return `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
                <div><strong>${c.name}</strong><br><small>${c.code}</small></div>
                <div>
                    <button class="btn-icon" title="Entrar" onclick="openClassroom('${d.id}')"><i class="ph ph-arrow-right"></i></button>
                    <button class="btn-icon" title="Editar" onclick="openClassModal('${d.id}','${c.name}','${c.code}')"><i class="ph ph-pencil"></i></button>
                    <button class="btn-icon del" title="Excluir" onclick="deleteDoc(doc(db,'classes','${d.id}'))"><i class="ph ph-trash"></i></button>
                </div>
            </div>`;
        }).join('') || '<p>Nenhuma turma.</p>';
    });
}

// 3. ALUNOS (ADMIN)
async function renderStudents(div, title) {
    title.innerText = "Controle de Alunos";
    
    const cs = await getDocs(collection(db, "classes"));
    let opts = '<option value="">Sem Turma</option>';
    cs.forEach(c => opts += `<option value="${c.id}">${c.data().name}</option>`);
    el('std-class-select').innerHTML = opts;

    div.innerHTML = `<div class="card"><div class="table-responsive"><table id="s-table"></table></div></div>`;
    
    onSnapshot(query(collection(db, "users"), where("role", "!=", "admin")), snap => {
        const rows = snap.docs.map(d => {
            const u = d.data();
            return `<tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${u.classCode || '-'}</td>
                <td>
                    <button class="btn-icon" onclick="openStudentModal('${d.id}','${u.name}','${u.classId}')"><i class="ph ph-pencil"></i></button>
                    <button class="btn-icon del" onclick="if(confirm('Banir?')) deleteDoc(doc(db,'users','${d.id}'))"><i class="ph ph-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
        el('s-table').innerHTML = `<thead><tr><th>Nome</th><th>Email</th><th>Turma</th><th>Ações</th></tr></thead><tbody>${rows}</tbody>`;
    });
}

// 4. SALA DE AULA
async function openClassroom(cid) {
    state.currentClassId = cid;
    const cont = el('content-area');
    
    const cSnap = await getDoc(doc(db, "classes", cid));
    el('page-title').innerText = cSnap.exists() ? cSnap.data().name : "Sala de Aula";

    cont.innerHTML = `
        ${state.isAdmin ? `<div style="text-align:right; margin-bottom:20px"><button class="btn-primary" style="width:auto" onclick="openPostModal()">Criar Post</button></div>` : ''}
        <div id="feed"></div>
    `;

    onSnapshot(query(collection(db, `classes/${cid}/posts`), orderBy("createdAt", "desc")), snap => {
        el('feed').innerHTML = snap.docs.map(d => {
            const p = d.data();
            return `
            <div class="post-card">
                <div class="post-meta"><span>${p.type.toUpperCase()}</span></div>
                <div class="post-title">${p.title}</div>
                <div class="post-body">${p.content}</div>
                ${p.link ? `<a href="${p.link}" target="_blank" class="post-link">Abrir Anexo</a>` : ''}
                ${state.isAdmin ? `<div style="margin-top:10px; border-top:1px solid #eee; padding-top:5px"><button class="btn-icon del" onclick="deleteDoc(doc(db,'classes/${cid}/posts','${d.id}'))">Excluir</button></div>` : ''}
            </div>`;
        }).join('') || '<p>Mural vazio.</p>';
    });
}

// 5. PERFIL
function renderProfile(div, title) {
    title.innerText = "Meu Perfil";
    div.innerHTML = `
        <div class="card" style="max-width:500px">
            <div class="form-group"><label>Nome</label><input id="pf-name" value="${state.profile.name}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px"></div>
            <div class="form-group"><label>Código Turma</label><input id="pf-code" value="${state.profile.classCode||''}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px"></div>
            <button class="btn-primary" onclick="saveProfile()">Salvar</button>
        </div>
    `;
}

// --- ACTIONS ---
window.saveSched = async () => {
    const s = { seg: el('h-seg').value, ter: el('h-ter').value, qua: el('h-qua').value, qui: el('h-qui').value, sex: el('h-sex').value };
    await setDoc(doc(db, "config", "schedule"), s);
    alert("Salvo!");
};

window.saveProfile = async () => {
    const code = el('pf-code').value;
    const q = query(collection(db, "classes"), where("code", "==", code));
    const snap = await getDocs(q);
    if(snap.empty && code) return alert("Código inválido!");
    
    const cid = snap.empty ? null : snap.docs[0].id;
    await updateDoc(doc(db, "users", state.user.uid), { name: el('pf-name').value, classCode: code, classId: cid });
    alert("Atualizado!");
};

window.saveClassAction = async () => {
    const name = el('cls-name').value;
    const code = el('cls-code').value;
    if(state.editId) await updateDoc(doc(db, "classes", state.editId), { name, code });
    else await addDoc(collection(db, "classes"), { name, code });
    closeModals();
};

window.saveStudentAction = async () => {
    const cid = el('std-class-select').value;
    const cSnap = await getDoc(doc(db, "classes", cid));
    await updateDoc(doc(db, "users", state.editId), { classId: cid, classCode: cSnap.exists() ? cSnap.data().code : null, name: el('std-name').value });
    closeModals();
};

window.createPostAction = async () => {
    await addDoc(collection(db, `classes/${state.currentClassId}/posts`), {
        title: el('post-title').value, type: el('post-type').value, content: el('post-content').value, link: el('post-link').value, createdAt: serverTimestamp()
    });
    closeModals();
};

// UTILS
window.openClassModal = (id, n, c) => { state.editId = id; el('cls-name').value=n||''; el('cls-code').value=c||''; el('modal-overlay').classList.remove('hidden'); el('modal-class').classList.remove('hidden'); };
window.openStudentModal = (id, n, c) => { state.editId = id; el('std-name').value=n; el('std-class-select').value=c||''; el('modal-overlay').classList.remove('hidden'); el('modal-student').classList.remove('hidden'); };
window.openPostModal = () => { el('modal-overlay').classList.remove('hidden'); el('modal-post').classList.remove('hidden'); };
window.closeModals = () => { el('modal-overlay').classList.add('hidden'); document.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden')); };
window.switchAuthTab = (t) => {
    if(t=='login') { el('login-form').classList.remove('hidden'); el('register-form').classList.add('hidden'); }
    else { el('login-form').classList.add('hidden'); el('register-form').classList.remove('hidden'); }
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active'));
};

function setupUI() {
    el('login-form').onsubmit = e => { e.preventDefault(); signInWithEmailAndPassword(auth, el('login-email').value, el('login-pass').value).catch(err=>alert(err.message)); };
    el('register-form').onsubmit = async e => {
        e.preventDefault();
        try {
            const u = await createUserWithEmailAndPassword(auth, el('reg-email').value, el('reg-pass').value);
            await setDoc(doc(db, "users", u.user.uid), { name: el('reg-name').value, email: el('reg-email').value, role: 'student', classCode: el('reg-code').value });
        } catch(err){alert(err.message)}
    };
    el('btn-logout').onclick = () => signOut(auth);
    document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => navigateTo(b.dataset.target));
    el('mobile-btn').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
    el('btn-google').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
}

init();