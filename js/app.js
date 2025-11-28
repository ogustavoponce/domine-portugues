import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, OAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
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

// === EMAIL DO PROFESSOR ===
const ADMIN_EMAIL = "domenico.suriale@ifpr.edu.br";

const state = { user: null, profile: null, isAdmin: false, activeClassId: null };

const el = {
    authView: document.getElementById('auth-view'),
    appView: document.getElementById('app-view'),
    content: document.getElementById('dynamic-content'),
    adminMenu: document.getElementById('admin-menu-items'),
    studentMenu: document.getElementById('student-menu-items'),
    sidebar: document.querySelector('.sidebar')
};

// INIT
function init() {
    setupListeners();
    onAuthStateChanged(auth, async (user) => {
        if (user) await handleLogin(user);
        else handleLogout();
    });
}

async function handleLogin(user) {
    state.user = user;
    const emailLower = user.email.toLowerCase().trim();
    
    // Auto Admin Force
    if (emailLower === ADMIN_EMAIL) {
        state.isAdmin = true;
        await updateDoc(doc(db, "users", user.uid), { role: 'admin' }).catch(() => {
            setDoc(doc(db, "users", user.uid), { role: 'admin', email: user.email }, { merge: true });
        });
    }

    let docSnap = await getDoc(doc(db, "users", user.uid));
    if (!docSnap.exists()) {
        const newProfile = { name: user.displayName || "Usuário", email: user.email, role: state.isAdmin ? 'admin' : 'aluno', classCode: null };
        await setDoc(doc(db, "users", user.uid), newProfile);
        state.profile = newProfile;
    } else {
        state.profile = docSnap.data();
    }
    if(state.isAdmin) state.profile.role = 'admin';

    updateSidebar();
    el.authView.classList.remove('active');
    el.appView.classList.add('active');
    navigateTo('home');
}

function handleLogout() {
    state.user = null; state.profile = null; state.isAdmin = false;
    el.appView.classList.remove('active'); el.authView.classList.add('active');
}

function updateSidebar() {
    const name = state.profile.name ? state.profile.name.split(' ')[0] : "Usuário";
    document.getElementById('user-name').textContent = name;
    document.getElementById('user-role').textContent = state.isAdmin ? "Professor" : "Aluno";
    document.getElementById('user-avatar').textContent = name[0];
    if (state.isAdmin) { el.adminMenu.classList.remove('hidden'); el.studentMenu.classList.add('hidden'); }
    else { el.adminMenu.classList.add('hidden'); el.studentMenu.classList.remove('hidden'); }
}

window.navigateTo = (page) => {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-target="${page}"]`)?.classList.add('active');
    el.sidebar.classList.remove('open');
    if (page === 'home') renderHome();
    else if (page === 'admin-classes') renderAdminClasses();
    else if (page === 'admin-students') renderAdminStudents();
    else if (page === 'my-class') openClassView(null, state.profile.classCode);
};

// --- RENDERERS ---
async function renderHome() {
    let sched = { seg: "", qua: "", sex: "" };
    try { const s = await getDoc(doc(db, "config", "schedule")); if(s.exists()) sched = s.data(); } catch(e){}
    const editAttr = state.isAdmin ? "" : "disabled";

    el.content.innerHTML = `
        <div class="fade-in">
            <h2>${state.isAdmin ? "Painel de Gestão" : "Bem-vindo"}</h2>
            <div class="dashboard-card" style="border-left: 5px solid var(--primary)">
                <h3><i class="ph ph-clock"></i> Horário de Atendimento Geral</h3>
                <table class="admin-table">
                    <tr><td>Segunda</td><td><input id="s-seg" value="${sched.seg}" ${editAttr} placeholder="-"></td></tr>
                    <tr><td>Quarta</td><td><input id="s-qua" value="${sched.qua}" ${editAttr} placeholder="-"></td></tr>
                    <tr><td>Sexta</td><td><input id="s-sex" value="${sched.sex}" ${editAttr} placeholder="-"></td></tr>
                </table>
                ${state.isAdmin ? '<button class="btn-primary" onclick="saveSchedule()" style="margin-top:15px; width:auto">Salvar</button>' : ''}
            </div>
            ${!state.isAdmin ? `<div class="dashboard-card"><h3>Minha Turma: ${state.profile.classCode || "Sem Turma"}</h3><button class="btn-primary" onclick="navigateTo('my-class')">Acessar</button></div>` : ''}
        </div>`;
}

window.saveSchedule = async () => {
    await setDoc(doc(db, "config", "schedule"), {
        seg: document.getElementById('s-seg').value,
        qua: document.getElementById('s-qua').value,
        sex: document.getElementById('s-sex').value
    });
    alert("Salvo!");
}

window.renderAdminClasses = () => {
    el.content.innerHTML = `
        <div class="class-header"><h2>Turmas</h2><button class="btn-primary" style="width:auto" onclick="openModal('modal-class')">+ Nova</button></div>
        <div id="classes-list" class="fade-in">Carregando...</div>`;
    onSnapshot(collection(db, "classes"), (snap) => {
        const list = document.getElementById('classes-list'); if(!list) return;
        let html = "";
        snap.forEach(d => {
            const cls = d.data();
            html += `<div class="dashboard-card" style="display:flex; justify-content:space-between; align-items:center;">
                <div><h3>${cls.name}</h3><p>Código: <span class="badge badge-blue">${cls.code}</span></p></div>
                <div style="display:flex; gap:10px"><button class="btn-social" onclick="openClassView('${d.id}','${cls.code}','${cls.name}')">Entrar</button><button class="btn-icon" onclick="deleteDoc(doc(db,'classes','${d.id}'))"><i class="ph ph-trash" style="color:red"></i></button></div></div>`;
        });
        list.innerHTML = html || "<p>Sem turmas.</p>";
    });
};

window.renderAdminStudents = async () => {
    el.content.innerHTML = `<h2>Gerir Alunos</h2><div class="dashboard-card"><table class="admin-table" id="students-table"></table></div>`;
    const snap = await getDocs(query(collection(db, "users"), where("role", "!=", "admin")));
    let html = `<thead><tr><th>Nome</th><th>Email</th><th>Turma</th><th>Del</th></tr></thead><tbody>`;
    snap.forEach(d => {
        const u = d.data();
        html += `<tr><td><strong>${u.name}</strong></td><td>${u.email}</td><td><span class="badge badge-gray">${u.classCode||'-'}</span></td><td><button class="btn-icon" onclick="deleteDoc(doc(db,'users','${d.id}'))"><i class="ph ph-trash"></i></button></td></tr>`;
    });
    document.getElementById('students-table').innerHTML = html + "</tbody>";
};

// CLASSROOM
window.openClassView = async (classId, classCode, className) => {
    if (!classId && classCode) {
        const snap = await getDocs(query(collection(db, "classes"), where("code", "==", classCode)));
        if(!snap.empty) { classId = snap.docs[0].id; className = snap.docs[0].data().name; }
        else { el.content.innerHTML = `<div class="dashboard-card"><h2>Turma não encontrada.</h2></div>`; return; }
    }
    state.activeClassId = classId;
    el.content.innerHTML = `
        <div class="fade-in">
            <div class="class-header"><h2>${className || "Sala de Aula"}</h2>
            ${state.isAdmin ? `<div style="display:flex; gap:10px"><button class="btn-primary" style="width:auto" onclick="openModal('modal-material')">+ Mat</button><button class="btn-primary" style="width:auto; background:#34C759" onclick="openModal('modal-activity')">+ Ativ</button></div>` : ''}</div>
            <div class="tabs"><div class="tab active" onclick="switchTab('mural')">Mural</div><div class="tab" onclick="switchTab('activities')">Atividades</div><div class="tab" onclick="switchTab('concepts')">Conceitos</div><div class="tab" onclick="switchTab('chat')">Chat</div></div>
            <div id="tab-mural" class="tab-content"><div id="feed-content"></div></div>
            <div id="tab-activities" class="tab-content hidden"><div id="activity-content"></div></div>
            <div id="tab-concepts" class="tab-content hidden"><div class="dashboard-card"><table class="admin-table" id="concepts-table"></table></div></div>
            <div id="tab-chat" class="tab-content hidden"><div class="chat-wrapper"><div class="chat-box" id="chat-messages"></div><div style="padding:15px; border-top:1px solid #eee; display:flex; gap:10px"><input id="chat-input" placeholder="Mensagem..."><button class="btn-primary" style="width:auto" onclick="sendChat()">Enviar</button></div></div></div>
        </div>`;
    loadMural(classId); loadActivities(classId); loadConcepts(classId, classCode); loadChat(classId);
};

function loadMural(cid) {
    onSnapshot(query(collection(db, `classes/${cid}/posts`), orderBy("createdAt", "desc")), (snap) => {
        const d = document.getElementById('feed-content'); if(d) d.innerHTML = snap.docs.map(doc => { const p = doc.data(); return `<div class="post-item"><div class="post-icon"><i class="ph ph-file-text"></i></div><div style="flex:1"><h3>${p.title}</h3><p>${p.desc}</p>${p.link?`<a href="${p.link}" target="_blank" style="color:var(--primary)">Abrir</a>`:''}</div></div>` }).join('') || "<p>Vazio.</p>";
    });
}
function loadActivities(cid) {
    onSnapshot(query(collection(db, `classes/${cid}/activities`), orderBy("date", "asc")), (snap) => {
        const d = document.getElementById('activity-content'); if(d) d.innerHTML = snap.docs.map(doc => { const a = doc.data(); return `<div class="post-item" style="border-left:4px solid #34C759"><div class="post-icon" style="color:#34C759"><i class="ph ph-check-square"></i></div><div style="flex:1"><h3>${a.title}</h3><p>${a.desc}</p><div class="post-meta">Data: ${a.date}</div></div></div>` }).join('') || "<p>Nenhuma.</p>";
    });
}
async function loadConcepts(cid, code) {
    const t = document.getElementById('concepts-table');
    if (!state.isAdmin) {
        const snap = await getDocs(query(collection(db, `classes/${cid}/concepts`), where("uid", "==", state.user.uid)));
        t.innerHTML = snap.docs.map(d => `<tr><td>${d.data().obs}</td><td><span class="badge badge-blue">${d.data().value}</span></td></tr>`).join('');
    } else {
        const snap = await getDocs(query(collection(db, "users"), where("classCode", "==", code)));
        t.innerHTML = snap.docs.map(d => `<tr><td>${d.data().name}</td><td><button class="btn-social" onclick="openConceptModal('${d.id}','${d.data().name}')">Nota</button></td></tr>`).join('');
    }
}
function loadChat(cid) {
    onSnapshot(query(collection(db, `classes/${cid}/chat`), orderBy("createdAt", "asc")), (snap) => {
        const b = document.getElementById('chat-messages'); if(!b) return;
        b.innerHTML = snap.docs.map(d => { const m = d.data(); return `<div class="msg ${m.uid===state.user.uid?'msg-mine':'msg-other'}"><div class="msg-author">${m.name}</div>${m.text}</div>` }).join('');
        b.scrollTop = b.scrollHeight;
    });
}

// UTILS & EVENTS
window.confirmCreateClass = async () => { await addDoc(collection(db, "classes"), { name: document.getElementById('new-class-name').value, code: document.getElementById('new-class-code').value }); closeModals(); }
window.confirmPostMaterial = async () => { await addDoc(collection(db, `classes/${state.activeClassId}/posts`), { title: document.getElementById('mat-title').value, desc: document.getElementById('mat-desc').value, link: document.getElementById('mat-link').value, createdAt: serverTimestamp() }); closeModals(); }
window.confirmPostActivity = async () => { await addDoc(collection(db, `classes/${state.activeClassId}/activities`), { title: document.getElementById('act-title').value, desc: document.getElementById('act-desc').value, date: document.getElementById('act-date').value, createdAt: serverTimestamp() }); closeModals(); }
window.confirmPostConcept = async () => { await addDoc(collection(db, `classes/${state.activeClassId}/concepts`), { uid: document.getElementById('concept-student-id').value, value: document.getElementById('concept-value').value, obs: document.getElementById('concept-obs').value }); closeModals(); alert("Nota lançada!"); }
window.sendChat = async () => { const i = document.getElementById('chat-input'); if(i.value) { await addDoc(collection(db, `classes/${state.activeClassId}/chat`), { text: i.value, uid: state.user.uid, name: state.profile.name, createdAt: serverTimestamp() }); i.value = ""; } }
window.openConceptModal = (uid, name) => { document.getElementById('concept-student-id').value = uid; document.getElementById('concept-student-name').innerText = name; openModal('modal-concept'); }
window.openModal = (id) => { document.getElementById('modal-overlay').classList.remove('hidden'); document.getElementById(id).classList.remove('hidden'); }
window.closeModals = () => { document.getElementById('modal-overlay').classList.add('hidden'); document.querySelectorAll('.modal-card').forEach(c => c.classList.add('hidden')); }
window.switchTab = (id) => { document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c=>c.classList.add('hidden')); event.target.classList.add('active'); document.getElementById(`tab-${id}`).classList.remove('hidden'); }

function setupListeners() {
    document.getElementById('login-form').addEventListener('submit', (e)=>{e.preventDefault(); signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value).catch(e=>alert(e.message))});
    document.getElementById('register-form').addEventListener('submit', async (e)=>{e.preventDefault(); try{ const c = await createUserWithEmailAndPassword(auth, document.getElementById('reg-email').value, document.getElementById('reg-pass').value); await setDoc(doc(db, "users", c.user.uid), { name: document.getElementById('reg-name').value, email: document.getElementById('reg-email').value, role: 'aluno', classCode: document.getElementById('reg-class-code').value }); }catch(e){alert(e.message)} });
    document.getElementById('btn-toggle-auth').addEventListener('click', ()=>{ document.getElementById('login-form').classList.toggle('hidden'); document.getElementById('register-form').classList.toggle('hidden'); });
    document.getElementById('btn-logout').addEventListener('click', ()=>signOut(auth));
    document.querySelectorAll('.nav-item').forEach(i=>i.addEventListener('click', ()=>navigateTo(i.dataset.target)));
    el.sidebar.querySelector('#mobile-menu-toggle')?.addEventListener('click', ()=>el.sidebar.classList.toggle('open'));
    document.getElementById('btn-google').addEventListener('click', ()=>signInWithPopup(auth, new GoogleAuthProvider()));
    document.getElementById('btn-apple').addEventListener('click', ()=>signInWithPopup(auth, new OAuthProvider('apple.com')));
}
init();



