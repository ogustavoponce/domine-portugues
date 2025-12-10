import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, setDoc, doc, getDoc, addDoc, deleteDoc, serverTimestamp, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

// === EMAIL DO PROFESSOR ===
const ADMIN_EMAILS = [
    "domenico@domineportugues.com.br", // SEU NOVO EMAIL
    "domenico.suriale@ifpr.edu.br",
    "admin@teste.com"
];

const state = { user: null, profile: null, isAdmin: false, currentClassId: null, editId: null };
const el = (id) => document.getElementById(id);

function init() {
    setupUI();
    // Listener de Auth
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await handleLogin(user);
        } else {
            logoutUI();
        }
    });
}

// --- LOGIN COM TRATAMENTO DE GOOGLE ---
async function handleLogin(user) {
    state.user = user;
    const email = user.email.toLowerCase().trim();
    
    // 1. Verifica Admin
    state.isAdmin = ADMIN_EMAILS.includes(email);

    // 2. Busca ou Cria Perfil
    const userRef = doc(db, "users", user.uid);
    let snap;
    
    try {
        snap = await getDoc(userRef);
    } catch (error) {
        console.error("Erro ao ler perfil:", error);
        alert("Erro de conexão com o banco de dados.");
        return;
    }
    
    if (!snap.exists()) {
        // PERFIL NÃO EXISTE (Primeiro login Google) -> CRIA AGORA
        const baseProfile = {
            name: user.displayName || "Usuário",
            email: email,
            role: state.isAdmin ? 'admin' : 'student',
            classCode: null,
            createdAt: serverTimestamp()
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

    renderSidebar();
    document.getElementById('auth-view').classList.remove('active');
    document.getElementById('app-view').classList.add('active');
    
    // Roteamento
    if (state.isAdmin) navigateTo('home');
    else if (state.profile.classId) openClassroom(state.profile.classId);
    else navigateTo('profile'); // Aluno sem turma vai para perfil
}

function logoutUI() {
    state.user = null; state.profile = null;
    document.getElementById('app-view').classList.remove('active');
    document.getElementById('auth-view').classList.add('active');
}

function renderSidebar() {
    const p = state.profile;
    el('u-name').innerText = p.name ? p.name.split(' ')[0] : "Usuário";
    el('u-role').innerText = state.isAdmin ? "Professor" : "Aluno";
    el('u-avatar').innerText = p.name ? p.name[0] : "U";
    
    if (state.isAdmin) {
        el('admin-menu').classList.remove('hidden');
        el('student-menu').classList.add('hidden');
    } else {
        el('admin-menu').classList.add('hidden');
        el('student-menu').classList.remove('hidden');
    }
}

// --- NAVEGAÇÃO ---
window.navigateTo = (page) => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-target="${page}"]`)?.classList.add('active');
    document.querySelector('.sidebar').classList.remove('open');
    
    const content = el('content-area');
    const title = el('page-title');
    
    if (page === 'home') renderHome(content, title);
    else if (page === 'admin-classes') renderAdminClasses(content, title);
    else if (page === 'admin-students') renderAdminStudents(content, title);
    else if (page === 'profile') renderProfile(content, title);
    else if (page === 'classroom') {
        if(state.profile.classId) openClassroom(state.profile.classId);
        else content.innerHTML = `<div class="card"><h3>Sem Turma</h3><p>Vá em 'Meu Perfil' e digite o código da turma.</p></div>`;
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
            <div class="card-head"><h3><i class="ph ph-clock"></i> Horário de Atendimento</h3>${state.isAdmin?`<button class="btn-primary" style="width:auto; padding:8px 16px" onclick="saveSched()">Salvar</button>`:''}</div>
            <div class="table-responsive"><table>
                <tr><td width="20%">Segunda</td><td><input id="h-seg" style="width:100%; border:none" value="${s.seg||''}" ${ro} placeholder="-"></td></tr>
                <tr><td>Terça</td><td><input id="h-ter" style="width:100%; border:none" value="${s.ter||''}" ${ro} placeholder="-"></td></tr>
                <tr><td>Quarta</td><td><input id="h-qua" style="width:100%; border:none" value="${s.qua||''}" ${ro} placeholder="-"></td></tr>
                <tr><td>Quinta</td><td><input id="h-qui" style="width:100%; border:none" value="${s.qui||''}" ${ro} placeholder="-"></td></tr>
                <tr><td>Sexta</td><td><input id="h-sex" style="width:100%; border:none" value="${s.sex||''}" ${ro} placeholder="-"></td></tr>
            </table></div>
        </div>
        ${!state.isAdmin ? `<div class="card"><h3>Minha Turma</h3><p>Código: <strong>${state.profile.classCode || "Nenhum"}</strong></p><button class="btn-primary" onclick="navigateTo('classroom')" style="margin-top:15px">Entrar na Sala</button></div>` : ''}
    `;
}

// 2. TURMAS
function renderAdminClasses(div, title) {
    if(!state.isAdmin) return;
    title.innerText = "Gestão de Turmas";
    div.innerHTML = `<div style="text-align:right; margin-bottom:20px"><button class="btn-primary" style="width:auto" onclick="openClassModal()">+ Nova Turma</button></div><div id="c-list"></div>`;
    
    onSnapshot(collection(db, "classes"), snap => {
        el('c-list').innerHTML = snap.docs.map(d => {
            const c = d.data();
            return `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
                <div><strong>${c.name}</strong><br><small style="color:#666">${c.code}</small></div>
                <div style="display:flex; gap:5px">
                    <button class="btn-icon" title="Entrar" onclick="openClassroom('${d.id}')"><i class="ph ph-arrow-right"></i></button>
                    <button class="btn-icon" title="Editar" onclick="openClassModal('${d.id}','${c.name}','${c.code}')"><i class="ph ph-pencil"></i></button>
                    <button class="btn-icon del" title="Excluir" onclick="deleteDoc(doc(db,'classes','${d.id}'))"><i class="ph ph-trash"></i></button>
                </div>
            </div>`;
        }).join('') || '<p>Nenhuma turma.</p>';
    });
}

// 3. ALUNOS
async function renderAdminStudents(div, title) {
    if(!state.isAdmin) return;
    title.innerText = "Alunos Cadastrados";
    
    // Lista de turmas para o modal
    const cs = await getDocs(collection(db, "classes"));
    let opts = '<option value="">Sem Turma</option>';
    cs.forEach(c => opts += `<option value="${c.id}">${c.data().name}</option>`);
    el('std-class-select').innerHTML = opts;

    div.innerHTML = `<div class="card"><div class="table-responsive"><table id="std-table"></table></div></div>`;
    
    onSnapshot(query(collection(db, "users"), where("role", "!=", "admin")), snap => {
        const rows = snap.docs.map(d => {
            const u = d.data();
            return `<tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${u.classCode || '-'}</td>
                <td>
                    <button class="btn-icon" title="Editar" onclick="openStudentModal('${d.id}','${u.name}','${u.classId}')"><i class="ph ph-pencil"></i></button>
                    <button class="btn-icon del" onclick="if(confirm('Banir aluno?')) deleteDoc(doc(db,'users','${d.id}'))"><i class="ph ph-trash"></i></button>
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
    if(!cSnap.exists()) {
        content.innerHTML = "<div class='card'><h3>Turma não encontrada</h3></div>";
        return;
    }
    el('page-title').innerText = cSnap.data().name;

    content.innerHTML = `
        ${state.isAdmin ? `<div style="text-align:right; margin-bottom:20px"><button class="btn-primary" style="width:auto" onclick="openPostModal()">Criar Post</button></div>` : ''}
        <div id="feed"></div>
    `;

    onSnapshot(query(collection(db, `classes/${cid}/posts`), orderBy("createdAt", "desc")), snap => {
        el('feed').innerHTML = snap.docs.map(d => {
            const p = d.data();
            const date = p.createdAt ? new Date(p.createdAt.toDate()).toLocaleDateString() : '';
            return `
            <div class="post-card">
                <div class="post-meta"><span>${p.type.toUpperCase()}</span> <span>${date}</span></div>
                <div class="post-title">${p.title}</div>
                <div class="post-body">${p.content}</div>
                ${p.link ? `<a href="${p.link}" target="_blank" class="post-link">Abrir Anexo &rarr;</a>` : ''}
                ${state.isAdmin ? `<div style="margin-top:10px; border-top:1px solid #eee; padding-top:8px"><button class="btn-icon del" style="border:none" onclick="deleteDoc(doc(db,'classes/${cid}/posts','${d.id}'))">Excluir</button></div>` : ''}
            </div>`;
        }).join('') || '<p>Mural vazio.</p>';
    });
}

// 5. PERFIL
function renderProfile(div, title) {
    title.innerText = "Meu Perfil";
    const p = state.profile;
    div.innerHTML = `
        <div class="card" style="max-width:500px">
            <div class="form-group"><label>Nome</label><input id="pf-name" value="${p.name}"></div>
            <div class="form-group"><label>E-mail</label><input value="${p.email}" disabled style="background:#eee"></div>
            ${!state.isAdmin ? `<div class="form-group"><label>Código da Turma</label><input id="pf-code" value="${p.classCode||''}"></div>` : ''}
            <button class="btn-primary" onclick="saveProfile()">Salvar Alterações</button>
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
    const name = el('pf-name').value;
    const code = el('pf-code') ? el('pf-code').value : null;
    let updates = { name };
    
    if (code && code !== state.profile.classCode) {
        const q = query(collection(db, "classes"), where("code", "==", code));
        const s = await getDocs(q);
        if(s.empty) return alert("Código inválido!");
        updates.classCode = code;
        updates.classId = s.docs[0].id;
    }
    
    await updateDoc(doc(db, "users", state.user.uid), updates);
    alert("Perfil salvo! Recarregando...");
    window.location.reload();
};

window.saveClassAction = async () => {
    const name = el('cls-name').value;
    const code = el('cls-code').value;
    if(state.editId) await updateDoc(doc(db, "classes", state.editId), { name, code });
    else await addDoc(collection(db, "classes"), { name, code });
    window.closeModals();
};

window.saveStudentAction = async () => {
    const cid = el('std-class-select').value;
    let updates = { name: el('std-name').value };
    
    if(cid) {
        const cSnap = await getDoc(doc(db, "classes", cid));
        if(cSnap.exists()) {
            updates.classId = cid;
            updates.classCode = cSnap.data().code;
        }
    } else {
        updates.classId = null;
        updates.classCode = null;
    }
    
    await updateDoc(doc(db, "users", state.editId), updates);
    window.closeModals();
};

window.createPostAction = async () => {
    await addDoc(collection(db, `classes/${state.currentClassId}/posts`), {
        title: el('post-title').value, type: el('post-type').value, content: el('post-content').value, link: el('post-link').value, createdAt: serverTimestamp()
    });
    window.closeModals();
};

// --- UTILS ---
window.openClassModal = (id, n, c) => { state.editId = id||null; el('cls-name').value=n||''; el('cls-code').value=c||''; el('modal-overlay').classList.remove('hidden'); el('modal-class').classList.remove('hidden'); };
window.openStudentModal = (id, n, cid) => { state.editId = id; el('std-name').value=n; el('std-class-select').value=cid||""; el('modal-overlay').classList.remove('hidden'); el('modal-student').classList.remove('hidden'); };
window.openPostModal = () => { el('modal-overlay').classList.remove('hidden'); el('modal-post').classList.remove('hidden'); };
window.closeModals = () => { el('modal-overlay').classList.add('hidden'); document.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden')); };
window.switchAuthTab = (t) => {
    if(t === 'login') { el('login-form').classList.remove('hidden'); el('register-form').classList.add('hidden'); }
    else { el('login-form').classList.add('hidden'); el('register-form').classList.remove('hidden'); }
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active'));
};

function setupUI() {
    el('login-form').onsubmit = e => { e.preventDefault(); signInWithEmailAndPassword(auth, el('login-email').value, el('login-pass').value).catch(err=>alert("Erro login: " + err.message)); };
    el('register-form').onsubmit = async e => {
        e.preventDefault();
        const code = el('reg-code').value;
        const q = query(collection(db, "classes"), where("code", "==", code));
        const s = await getDocs(q);
        const cid = !s.empty ? s.docs[0].id : null;
        
        try {
            const u = await createUserWithEmailAndPassword(auth, el('reg-email').value, el('reg-pass').value);
            await setDoc(doc(db, "users", u.user.uid), { name: el('reg-name').value, email: el('reg-email').value, role: 'student', classCode: code, classId: cid });
        } catch(err){alert(err.message)}
    };
    el('btn-logout').onclick = () => signOut(auth);
    el('mobile-toggle').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
    document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => navigateTo(b.dataset.target));
    
    // GOOGLE LOGIN HANDLER
    el('btn-google').onclick = async () => {
        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
        } catch (error) {
            console.error("Google Error:", error);
            alert("Erro no Google: " + error.message);
        }
    };
}

init();