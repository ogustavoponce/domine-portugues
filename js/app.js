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

// ADMIN MASTER
const ADMIN_EMAIL = "domenico.suriale@ifpr.edu.br";

const state = {
    user: null,
    profile: null,
    isAdmin: false,
    activeClassId: null,
    tempAttachments: [] // Buffer para anexos antes de salvar
};

const el = (id) => document.getElementById(id);

// --- INIT ---
function init() {
    setupListeners();
    onAuthStateChanged(auth, async (user) => {
        if (user) await loadSession(user);
        else logoutUI();
    });
}

// --- AUTH & SESSION ---
async function loadSession(user) {
    state.user = user;
    const emailNormal = user.email.toLowerCase().trim();
    
    // Auto Admin Logic
    if (emailNormal === ADMIN_EMAIL) {
        state.isAdmin = true;
        await setDoc(doc(db, "users", user.uid), { role: 'admin', email: user.email }, { merge: true });
    }

    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) {
        const base = { 
            name: user.displayName || "Novo Usuário", 
            email: user.email, 
            role: state.isAdmin ? 'admin' : 'student',
            classId: null, // Relacional: ID da turma
            classCode: null // Backup visual
        };
        await setDoc(doc(db, "users", user.uid), base);
        state.profile = base;
    } else {
        state.profile = snap.data();
    }
    if (state.isAdmin) state.profile.role = 'admin';

    updateSidebar();
    el('auth-view').classList.remove('active');
    el('app-view').classList.add('active');
    
    // Roteamento inteligente
    if (state.isAdmin) navigateTo('dashboard');
    else if (state.profile.classId) navigateTo('classroom');
    else navigateTo('profile'); // Manda completar cadastro se sem turma
}

function logoutUI() {
    state.user = null; state.profile = null; state.isAdmin = false;
    el('app-view').classList.remove('active');
    el('auth-view').classList.add('active');
}

function updateSidebar() {
    const p = state.profile;
    el('u-name').textContent = p.name.split(' ')[0];
    el('u-role').textContent = state.isAdmin ? "Professor" : "Aluno";
    el('u-avatar').textContent = p.name[0];

    el('admin-menu').classList.toggle('hidden', !state.isAdmin);
    el('student-menu').classList.toggle('hidden', state.isAdmin);
}

// --- NAVIGATION ---
window.navigateTo = (page) => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-target="${page}"]`)?.classList.add('active');
    document.querySelector('.sidebar').classList.remove('open');
    
    const content = el('dynamic-content');
    const title = el('page-title');

    if (page === 'dashboard') renderDashboard(content, title);
    else if (page === 'profile') renderProfile(content, title);
    else if (page === 'admin-classes') renderAdminClasses(content, title);
    else if (page === 'admin-students') renderAdminStudents(content, title);
    else if (page === 'classroom') openClassroom(content, title, state.profile.classId);
};

// --- RENDERERS ---

// 1. DASHBOARD & HORÁRIO GLOBAL
async function renderDashboard(container, title) {
    title.innerText = "Visão Geral";
    let sched = { seg:"", ter:"", qua:"", qui:"", sex:"" };
    try { const s = await getDoc(doc(db, "config", "schedule")); if(s.exists()) sched=s.data(); } catch(e){}
    const ro = state.isAdmin ? "" : "readonly";

    container.innerHTML = `
        <div class="card fade-in">
            <h3><i class="ph ph-clock"></i> Quadro de Horários</h3>
            <div class="table-responsive">
                <table class="data-table">
                    <tr><td width="20%">Segunda</td><td><input id="s-seg" class="input-field" value="${sched.seg||''}" ${ro}></td></tr>
                    <tr><td>Terça</td><td><input id="s-ter" class="input-field" value="${sched.ter||''}" ${ro}></td></tr>
                    <tr><td>Quarta</td><td><input id="s-qua" class="input-field" value="${sched.qua||''}" ${ro}></td></tr>
                    <tr><td>Quinta</td><td><input id="s-qui" class="input-field" value="${sched.qui||''}" ${ro}></td></tr>
                    <tr><td>Sexta</td><td><input id="s-sex" class="input-field" value="${sched.sex||''}" ${ro}></td></tr>
                </table>
            </div>
            ${state.isAdmin ? '<div style="margin-top:15px; text-align:right"><button class="btn-primary" style="width:auto" onclick="saveSchedule()">Salvar Horário</button></div>' : ''}
        </div>
    `;
}

// 2. PROFILE DO ALUNO
function renderProfile(container, title) {
    title.innerText = "Meu Perfil";
    const p = state.profile;
    container.innerHTML = `
        <div class="card fade-in" style="max-width:600px">
            <h3>Dados Pessoais</h3>
            <div class="profile-grid">
                <div class="form-group"><label>Nome</label><input id="p-name" class="input-field" value="${p.name}"></div>
                <div class="form-group"><label>Telefone/WhatsApp</label><input id="p-phone" class="input-field" value="${p.phone||''}"></div>
                <div class="form-group"><label>E-mail Recuperação</label><input id="p-rec-email" class="input-field" value="${p.recoveryEmail||''}"></div>
                <div class="form-group"><label>Código da Turma</label><input class="input-field" value="${p.classCode||'Não vinculado'}" readonly style="background:#eee"></div>
            </div>
            <button class="btn-primary" style="margin-top:20px" onclick="saveProfile()">Salvar Alterações</button>
        </div>
    `;
}

// 3. ADMIN: CLASSES (CRUD)
function renderAdminClasses(container, title) {
    if(!state.isAdmin) return;
    title.innerText = "Gerir Turmas";
    container.innerHTML = `
        <div style="text-align:right; margin-bottom:20px"><button class="btn-primary" style="width:auto" onclick="openClassModal()">+ Nova Turma</button></div>
        <div id="classes-list" class="fade-in"></div>
    `;
    onSnapshot(collection(db, "classes"), snap => {
        el('classes-list').innerHTML = snap.docs.map(d => {
            const c = d.data();
            return `<div class="card" style="display:flex; justify-content:space-between; align-items:center">
                <div><strong>${c.name}</strong><br><span class="tag tag-blue">${c.code}</span></div>
                <div style="display:flex; gap:10px">
                    <button class="action-btn" title="Entrar" onclick="openClassroom(el('dynamic-content'), el('page-title'), '${d.id}')"><i class="ph ph-arrow-right"></i></button>
                    <button class="action-btn" title="Editar" onclick="openClassModal('${d.id}', '${c.name}', '${c.code}')"><i class="ph ph-pencil"></i></button>
                    <button class="action-btn delete" title="Excluir" onclick="deleteDoc(doc(db,'classes','${d.id}'))"><i class="ph ph-trash"></i></button>
                </div>
            </div>`;
        }).join('') || '<p>Sem turmas.</p>';
    });
}

// 4. ADMIN: STUDENTS (SECRETARIA)
async function renderAdminStudents(container, title) {
    if(!state.isAdmin) return;
    title.innerText = "Secretaria Virtual";
    
    // Pega todas as turmas para o dropdown de mover
    const classesSnap = await getDocs(collection(db, "classes"));
    let classOptions = `<option value="">Selecionar Turma...</option>`;
    classesSnap.forEach(c => { classOptions += `<option value="${c.id}">${c.data().name}</option>`; });
    el('move-class-select').innerHTML = classOptions;

    container.innerHTML = `<div class="card fade-in"><div class="table-responsive"><table class="data-table" id="students-table"></table></div></div>`;
    
    const q = query(collection(db, "users"), where("role", "!=", "admin"));
    onSnapshot(q, snap => {
        let rows = `<thead><tr><th>Nome</th><th>Email</th><th>Turma Atual</th><th>Ações</th></tr></thead><tbody>`;
        snap.forEach(d => {
            const u = d.data();
            rows += `<tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td><span class="tag">${u.classCode || 'Sem Turma'}</span></td>
                <td>
                    <button class="action-btn" title="Mover de Turma" onclick="openMoveModal('${d.id}')"><i class="ph ph-arrows-left-right"></i></button>
                    <button class="action-btn delete" title="Expulsar" onclick="if(confirm('Remover aluno?')) deleteDoc(doc(db,'users','${d.id}'))"><i class="ph ph-user-minus"></i></button>
                </td>
            </tr>`;
        });
        el('students-table').innerHTML = rows + "</tbody>";
    });
}

// 5. CLASSROOM (MURAL & NOTAS)
async function openClassroom(container, title, classId) {
    if (!classId) { container.innerHTML = "<div class='card'><h3>Você não está em nenhuma turma.</h3><p>Vá em 'Meu Perfil' ou peça ao professor.</p></div>"; return; }
    
    const cSnap = await getDoc(doc(db, "classes", classId));
    if(!cSnap.exists()) return alert("Turma não existe!");
    
    const cData = cSnap.data();
    title.innerText = cData.name;
    state.activeClassId = classId;

    const postBtn = state.isAdmin ? `<button class="btn-primary" style="width:auto" onclick="openPostModal()">+ Criar Postagem</button>` : '';

    container.innerHTML = `
        <div class="fade-in">
            <div style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center">
                <div class="tabs" style="display:flex; gap:10px">
                    <button class="btn-outline" onclick="loadMural('${classId}')">Mural</button>
                    <button class="btn-outline" onclick="loadGrades('${classId}')">Boletim & Feedback</button>
                </div>
                ${postBtn}
            </div>
            <div id="classroom-content"></div>
        </div>
    `;
    loadMural(classId);
}

function loadMural(cid) {
    const cont = el('classroom-content');
    onSnapshot(query(collection(db, `classes/${cid}/posts`), orderBy("createdAt", "desc")), snap => {
        if(snap.empty) { cont.innerHTML = "<p>Mural vazio.</p>"; return; }
        cont.innerHTML = `<div class="post-list">` + snap.docs.map(d => {
            const p = d.data();
            const date = p.createdAt ? new Date(p.createdAt.toDate()).toLocaleDateString('pt-BR') : 'Hoje';
            const attachs = (p.attachments || []).map(a => `<a href="${a.url}" target="_blank" class="att-chip"><i class="ph ph-link"></i> ${a.type.toUpperCase()}</a>`).join('');
            
            return `
            <div class="post-item">
                <div class="post-header">
                    <span class="post-tag tag-${p.type}">${p.type}</span>
                    <span style="font-size:12px; color:#999">${date}</span>
                </div>
                <div class="post-title">${p.title}</div>
                <div class="post-body">${p.body}</div>
                <div class="attachments-grid">${attachs}</div>
                ${state.isAdmin ? `<div style="margin-top:10px; border-top:1px solid #eee; padding-top:5px"><button class="btn-text" style="color:red; font-size:12px" onclick="deleteDoc(doc(db,'classes/${cid}/posts','${d.id}'))">Excluir Post</button></div>` : ''}
            </div>`;
        }).join('') + `</div>`;
    });
}

async function loadGrades(cid) {
    const cont = el('classroom-content');
    if(!state.isAdmin) {
        // Aluno vê suas notas
        const q = query(collection(db, `classes/${cid}/grades`), where("uid", "==", state.user.uid));
        const snap = await getDocs(q);
        let html = `<div class="card"><h3>Meu Boletim</h3><table class="data-table"><thead><tr><th>Feedback</th><th>Conceito</th></tr></thead><tbody>`;
        snap.forEach(d => {
            const g = d.data();
            html += `<tr><td>${g.feedback}</td><td><span class="tag tag-blue">${g.concept}</span></td></tr>`;
        });
        cont.innerHTML = html + "</tbody></table></div>";
    } else {
        // Professor vê lista para dar nota
        const usersSnap = await getDocs(query(collection(db, "users"), where("classId", "==", cid)));
        let html = `<div class="card"><h3>Lançar Notas</h3><table class="data-table"><thead><tr><th>Aluno</th><th>Ação</th></tr></thead><tbody>`;
        usersSnap.forEach(u => {
            html += `<tr><td>${u.data().name}</td><td><button class="btn-outline" style="padding:5px 10px" onclick="openGradeModal('${u.id}', '${u.data().name}')">Avaliar</button></td></tr>`;
        });
        cont.innerHTML = html + "</tbody></table></div>";
    }
}

// --- ACTIONS & MODALS ---

// Profile
window.saveProfile = async () => {
    const p = {
        name: el('p-name').value,
        phone: el('p-phone').value,
        recoveryEmail: el('p-rec-email').value
    };
    await updateDoc(doc(db, "users", state.user.uid), p);
    alert("Perfil atualizado!");
};

// Schedule
window.saveSchedule = async () => {
    const s = {
        seg: el('s-seg').value, ter: el('s-ter').value, qua: el('s-qua').value, qui: el('s-qui').value, sex: el('s-sex').value
    };
    await setDoc(doc(db, "config", "schedule"), s);
    alert("Horário Salvo!");
};

// Classes
window.openClassModal = (id, name, code) => {
    el('cls-name').value = name || '';
    el('cls-code').value = code || '';
    // Lógica para editar vs criar seria aqui (simplificado para criar sempre)
    el('modal-overlay').classList.remove('hidden');
    el('modal-class').classList.remove('hidden');
};
window.saveClassAction = async () => {
    const n = el('cls-name').value; const c = el('cls-code').value;
    if(!n || !c) return;
    await addDoc(collection(db, "classes"), { name: n, code: c });
    closeModals();
};

// Move Student
window.openMoveModal = (uid) => {
    el('move-uid').value = uid;
    el('modal-overlay').classList.remove('hidden');
    el('modal-move').classList.remove('hidden');
};
window.confirmMoveStudent = async () => {
    const uid = el('move-uid').value;
    const newClassId = el('move-class-select').value;
    if(!newClassId) return;
    
    // Busca código da nova turma para manter sync
    const cSnap = await getDoc(doc(db, "classes", newClassId));
    const newCode = cSnap.data().code;

    await updateDoc(doc(db, "users", uid), { classId: newClassId, classCode: newCode });
    closeModals();
    alert("Aluno transferido com sucesso!");
};

// Rich Post
window.openPostModal = () => {
    state.tempAttachments = [];
    renderAttachments();
    el('modal-overlay').classList.remove('hidden');
    el('modal-post').classList.remove('hidden');
};
window.addAttachmentItem = () => {
    const type = el('att-type').value;
    const url = el('att-url').value;
    if(!url) return;
    state.tempAttachments.push({ type, url });
    el('att-url').value = '';
    renderAttachments();
};
function renderAttachments() {
    el('attachments-list').innerHTML = state.tempAttachments.map((a, i) => `<div class="att-item-remove"><span>${a.type}: ${a.url.substring(0,20)}...</span> <span class="btn-remove" onclick="removeAtt(${i})">X</span></div>`).join('');
}
window.removeAtt = (i) => { state.tempAttachments.splice(i, 1); renderAttachments(); };

window.publishPostAction = async () => {
    const title = el('post-title').value;
    const body = el('post-body').value;
    const type = el('post-type').value;
    
    await addDoc(collection(db, `classes/${state.activeClassId}/posts`), {
        title, body, type, attachments: state.tempAttachments, createdAt: serverTimestamp()
    });
    closeModals();
};

// Grades
window.openGradeModal = (uid, name) => {
    el('grade-uid').value = uid;
    el('grade-student-name').innerText = name;
    el('modal-overlay').classList.remove('hidden');
    el('modal-grade').classList.remove('hidden');
    document.querySelectorAll('.concept-btn').forEach(b => b.classList.remove('selected'));
};
window.selectConcept = (c) => {
    el('selected-concept').value = c;
    document.querySelectorAll('.concept-btn').forEach(b => b.classList.remove('selected'));
    event.target.classList.add('selected');
};
window.saveGradeAction = async () => {
    const uid = el('grade-uid').value;
    const concept = el('selected-concept').value;
    const feedback = el('grade-feedback').value;
    if(!concept || !feedback) return alert("Preencha tudo!");
    
    await addDoc(collection(db, `classes/${state.activeClassId}/grades`), {
        uid, concept, feedback, createdAt: serverTimestamp()
    });
    closeModals();
    alert("Avaliação Registrada!");
};

window.closeModals = () => {
    el('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal-card').forEach(c => c.classList.add('hidden'));
};

// Auth Listeners
function setupListeners() {
    el('login-form').addEventListener('submit', e=>{e.preventDefault(); signInWithEmailAndPassword(auth, el('login-email').value, el('login-pass').value).catch(e=>alert(e.message))});
    el('register-form').addEventListener('submit', async e=>{
        e.preventDefault();
        const code = el('reg-code').value;
        // Valida Código da Turma no Cadastro
        const q = query(collection(db, "classes"), where("code", "==", code));
        const snap = await getDocs(q);
        if(snap.empty) return alert("Código de turma inválido!");
        
        const classId = snap.docs[0].id;
        try {
            const c = await createUserWithEmailAndPassword(auth, el('reg-email').value, el('reg-pass').value);
            await setDoc(doc(db, "users", c.user.uid), {
                name: el('reg-name').value, email: el('reg-email').value,
                role: 'student', classCode: code, classId: classId
            });
        } catch(err){alert(err.message)}
    });
    
    el('btn-toggle-auth').addEventListener('click', ()=>{ el('login-form').classList.toggle('hidden'); el('register-form').classList.toggle('hidden'); });
    el('btn-logout').addEventListener('click', ()=>signOut(auth));
    document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click', ()=>navigateTo(b.dataset.target)));
    el('mobile-menu-btn').addEventListener('click', ()=>document.querySelector('.sidebar').classList.toggle('open'));
    el('btn-google').addEventListener('click', ()=>signInWithPopup(auth, new GoogleAuthProvider()));
    el('btn-apple').addEventListener('click', ()=>signInWithPopup(auth, new OAuthProvider('apple.com')));
}

init();
