import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, 
    signOut, onAuthStateChanged, createUserWithEmailAndPassword, updateProfile 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, setDoc, updateDoc, collection, 
    addDoc, query, where, getDocs, deleteDoc, orderBy, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// === CONFIGURAÇÃO (NÃO ALTERE) ===
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
const googleProvider = new GoogleAuthProvider();

// === ESTADO GLOBAL ===
let currentUser = null;
let currentClass = null; // Dados da turma ativa
let unsubscribeFeed = null;

// === EXPORTAÇÕES GLOBAIS (Para o HTML acessar) ===
window.app = {
    logout: () => signOut(auth),
    switchTab: (tab) => loadTab(tab),
    expandComposer: () => {
        document.querySelector('.composer-collapsed').classList.add('hidden');
        document.getElementById('composer-expanded').classList.remove('hidden');
    },
    collapseComposer: () => {
        document.getElementById('composer-expanded').classList.add('hidden');
        document.querySelector('.composer-collapsed').classList.remove('hidden');
    },
    openModal: (id) => document.getElementById(id).classList.remove('hidden'),
    closeModal: (id) => document.getElementById(id).classList.add('hidden'),
    
    // Actions
    createClass: handleCreateClass,
    createPost: handleCreatePost,
    createAssignment: handleCreateAssignment,
    submitGrade: handleSubmitGrade,
    addStudentManual: handleAddStudentManual
};

// === AUTH SYSTEM ===
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await handleUserLoaded(user);
    } else {
        showScreen('auth-screen');
    }
});

async function handleUserLoaded(user) {
    // Busca ou cria usuário no Firestore
    const ref = doc(db, "users", user.uid);
    let snap = await getDoc(ref);
    
    const isAdmin = user.email === "domenico.suriale@ifpr.edu.br"; // Admin Hardcoded

    if (!snap.exists()) {
        await setDoc(ref, {
            uid: user.uid,
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            role: isAdmin ? 'admin' : 'student',
            myClasses: [] // Array de IDs
        });
        snap = await getDoc(ref);
    }

    if(isAdmin && snap.data().role !== 'admin') {
        await updateDoc(ref, { role: 'admin' });
        snap = await getDoc(ref);
    }

    currentUser = snap.data();
    initInterface();
}

function initInterface() {
    showScreen('app-screen');
    document.getElementById('user-avatar').innerText = currentUser.name.substring(0,2).toUpperCase();
    
    // Botão (+) na navbar só para admin
    if(currentUser.role === 'admin') {
        document.getElementById('btn-add-menu').classList.remove('hidden');
        document.getElementById('btn-add-menu').onclick = () => window.app.openModal('modal-class');
    } else {
        document.getElementById('btn-add-menu').classList.add('hidden');
    }

    loadHub();
}

// === NAVEGAÇÃO ===
function showScreen(id) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById(id).classList.remove('hidden');
}

// === HUB DE TURMAS ===
async function loadHub() {
    document.getElementById('view-hub').classList.add('active');
    document.getElementById('view-class').classList.remove('active');
    document.getElementById('nav-title').innerText = "Turmas";
    document.getElementById('nav-context').innerText = "";

    const container = document.getElementById('classes-container');
    container.innerHTML = '<p style="padding:20px; color:#666">Carregando...</p>';

    // Admin vê tudo. Aluno vê as suas.
    let q;
    if (currentUser.role === 'admin') {
        q = query(collection(db, "classes"));
    } else {
        if (!currentUser.myClasses || currentUser.myClasses.length === 0) {
            container.innerHTML = '<p style="padding:20px">Você não está em nenhuma turma.</p>';
            return;
        }
        // Firestore 'in' limitation: max 10. Para produção usaríamos outra lógica.
        q = query(collection(db, "classes"), where("__name__", "in", currentUser.myClasses));
    }

    const snap = await getDocs(q);
    container.innerHTML = '';

    if (snap.empty) {
        container.innerHTML = '<p style="padding:20px">Nenhuma turma encontrada.</p>';
        return;
    }

    snap.forEach(d => {
        const c = d.data();
        const card = document.createElement('div');
        card.className = 'class-card';
        card.onclick = () => enterClass(d.id, c);
        card.innerHTML = `
            <div class="card-header">
                <h2>${c.name}</h2>
                <p>${c.code || ''}</p>
            </div>
            <div class="card-body">
                <div class="teacher-avatar"><div>${c.teacherName ? c.teacherName[0] : 'P'}</div></div>
            </div>
        `;
        container.appendChild(card);
    });
}

// === DENTRO DA TURMA ===
function enterClass(id, data) {
    currentClass = { id, ...data };
    document.getElementById('view-hub').classList.remove('active');
    document.getElementById('view-class').classList.add('active');
    
    // Navbar Update
    document.getElementById('nav-context').innerHTML = data.name;

    // Banner Update
    document.getElementById('banner-class-name').innerText = data.name;
    document.getElementById('banner-class-code').innerText = data.code || '';

    // Permissões
    if(currentUser.role === 'admin') {
        document.getElementById('composer-box').classList.remove('hidden');
        document.getElementById('teacher-actions').classList.remove('hidden');
        document.getElementById('btn-add-student').classList.remove('hidden');
    } else {
        document.getElementById('composer-box').classList.add('hidden');
        document.getElementById('teacher-actions').classList.add('hidden');
        document.getElementById('btn-add-student').classList.add('hidden');
    }

    loadTab('mural');
}

function loadTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-link').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    // Acha o botão certo e ativa (simplificado)
    const index = ['mural', 'atividades', 'pessoas'].indexOf(tab);
    document.querySelectorAll('.tab-link')[index].classList.add('active');

    if(tab === 'mural') loadMural();
    if(tab === 'atividades') loadAtividades();
    if(tab === 'pessoas') loadPessoas();
}

// --- MURAL ---
function loadMural() {
    if(unsubscribeFeed) unsubscribeFeed();
    const feed = document.getElementById('stream-feed');
    feed.innerHTML = '';

    const q = query(collection(db, "classes", currentClass.id, "posts"), orderBy("createdAt", "desc"));
    
    unsubscribeFeed = onSnapshot(q, (snap) => {
        feed.innerHTML = '';
        if(snap.empty) { feed.innerHTML = '<p style="text-align:center; padding:20px; color:#999">Nenhum aviso.</p>'; return; }

        snap.forEach(d => {
            const p = d.data();
            const el = document.createElement('div');
            el.className = 'post-card';
            el.innerHTML = `
                <div class="post-header">
                    <div class="avatar-sm" style="background:#1967d2; color:white">${p.author[0]}</div>
                    <div>
                        <div class="post-author">${p.author}</div>
                        <div class="post-date">${p.createdAt ? new Date(p.createdAt.seconds*1000).toLocaleDateString() : ''}</div>
                    </div>
                </div>
                <div class="post-body">${p.content}</div>
            `;
            feed.appendChild(el);
        });
    });
}

// --- ATIVIDADES ---
async function loadAtividades() {
    const list = document.getElementById('assignments-list');
    list.innerHTML = 'Carregando...';
    
    const q = query(collection(db, "classes", currentClass.id, "assignments"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    
    list.innerHTML = '';
    if(snap.empty) { list.innerHTML = '<p style="padding:20px; text-align:center">Nenhuma atividade.</p>'; return; }

    snap.forEach(d => {
        const a = d.data();
        const el = document.createElement('div');
        el.className = 'list-item';
        el.onclick = () => openAssignmentDetail(d.id, a);
        el.innerHTML = `
            <div class="item-icon"><span class="material-icons-outlined">assignment</span></div>
            <div class="item-content">
                <div class="item-title">${a.title}</div>
                <div class="item-meta">Postado em ${a.createdAt ? new Date(a.createdAt.seconds*1000).toLocaleDateString() : ''}</div>
            </div>
        `;
        list.appendChild(el);
    });
}

// Detalhe da Atividade (Professor corrige, Aluno vê nota)
async function openAssignmentDetail(assignId, assignData) {
    if (currentUser.role === 'admin') {
        // MODO PROFESSOR: Lista de alunos para dar nota
        const list = document.getElementById('assignments-list');
        list.innerHTML = `
            <div style="padding:16px;">
                <button class="btn-text" onclick="loadTab('atividades')">← Voltar</button>
                <h2 style="margin-top:10px">${assignData.title}</h2>
                <p style="color:#5f6368; margin-bottom:20px">${assignData.description}</p>
                <h3>Alunos</h3>
                <div id="grading-list" class="list-vertical">Carregando...</div>
            </div>
        `;
        
        // Busca alunos da turma
        const qUsers = query(collection(db, "users"), where("myClasses", "array-contains", currentClass.id));
        const snapUsers = await getDocs(qUsers);
        const gradingContainer = document.getElementById('grading-list');
        gradingContainer.innerHTML = '';

        if(snapUsers.empty) gradingContainer.innerHTML = 'Sem alunos matriculados.';

        for(const uDoc of snapUsers.docs) {
            const u = uDoc.data();
            // Busca nota se existir
            const gradeRef = doc(db, "classes", currentClass.id, "assignments", assignId, "grades", u.uid);
            const gradeSnap = await getDoc(gradeRef);
            const gData = gradeSnap.exists() ? gradeSnap.data() : null;
            
            const badge = gData ? `<span class="grade-badge bg-${gData.grade}">${gData.grade}</span>` : '<span style="font-size:12px; color:#999; margin-left:10px">Sem nota</span>';

            const item = document.createElement('div');
            item.className = 'list-item';
            item.onclick = () => prepareGrading(assignId, u.uid, u.name, gData);
            item.innerHTML = `
                <div class="avatar-sm">${u.name[0]}</div>
                <div style="margin-left:16px;">
                    <span style="font-weight:500">${u.name}</span>
                    ${badge}
                </div>
            `;
            gradingContainer.appendChild(item);
        }

    } else {
        // MODO ALUNO: Vê nota
        const gradeRef = doc(db, "classes", currentClass.id, "assignments", assignId, "grades", currentUser.uid);
        const gradeSnap = await getDoc(gradeRef);
        const gData = gradeSnap.exists() ? gradeSnap.data() : null;

        let html = `
             <button class="btn-text" onclick="loadTab('atividades')">← Voltar</button>
             <div style="padding:20px; border:1px solid #dadce0; border-radius:8px; margin-top:10px">
                <h2>${assignData.title}</h2>
                <p>${assignData.description}</p>
                <hr style="margin:20px 0; border:0; border-top:1px solid #eee">
        `;

        if(gData) {
            html += `
                <h3 style="color:#1967d2">Conceito: <span class="grade-badge bg-${gData.grade}" style="font-size:18px">${gData.grade}</span></h3>
                <p style="margin-top:10px"><strong>Feedback:</strong> ${gData.feedback}</p>
            `;
        } else {
            html += `<p style="color:#666">Nenhuma nota atribuída ainda.</p>`;
        }
        html += `</div>`;
        document.getElementById('assignments-list').innerHTML = html;
    }
}

// --- GRADING (CORREÇÃO) ---
let currentGradingContext = null;

function prepareGrading(assignId, studentId, studentName, existingData) {
    currentGradingContext = { assignId, studentId };
    window.app.openModal('modal-grade');
    document.getElementById('grade-student-name').innerText = studentName;
    document.getElementById('grade-feedback').value = existingData ? existingData.feedback : '';
    
    // Limpa radios
    document.querySelectorAll('input[name="grade"]').forEach(r => r.checked = false);
    if(existingData && existingData.grade) {
        const rad = document.querySelector(`input[name="grade"][value="${existingData.grade}"]`);
        if(rad) rad.checked = true;
    }
}

async function handleSubmitGrade() {
    const gradeEl = document.querySelector('input[name="grade"]:checked');
    if(!gradeEl) return alert("Selecione um conceito.");
    
    const feedback = document.getElementById('grade-feedback').value;
    
    await setDoc(doc(db, "classes", currentClass.id, "assignments", currentGradingContext.assignId, "grades", currentGradingContext.studentId), {
        grade: gradeEl.value,
        feedback: feedback,
        gradedAt: serverTimestamp(),
        teacher: currentUser.name
    });
    
    window.app.closeModal('modal-grade');
    alert("Nota salva!");
    // Recarrega a lista
    const assignSnap = await getDoc(doc(db, "classes", currentClass.id, "assignments", currentGradingContext.assignId));
    openAssignmentDetail(currentGradingContext.assignId, assignSnap.data());
}

// --- PESSOAS ---
async function loadPessoas() {
    const list = document.getElementById('students-list');
    list.innerHTML = 'Carregando...';
    
    const q = query(collection(db, "users"), where("myClasses", "array-contains", currentClass.id));
    const snap = await getDocs(q);
    
    document.getElementById('student-count').innerText = `${snap.size} alunos`;
    list.innerHTML = '';

    if(snap.empty) { list.innerHTML = '<p style="padding:16px; color:#999">Nenhum aluno.</p>'; return; }

    snap.forEach(d => {
        const u = d.data();
        const el = document.createElement('div');
        el.className = 'person-item';
        el.innerHTML = `
            <div class="avatar-sm">${u.name[0]}</div>
            <div class="person-name">${u.name}</div>
        `;
        list.appendChild(el);
    });
}

// --- ACTIONS DO SISTEMA ---
async function handleCreateClass() {
    const name = document.getElementById('new-class-name').value;
    const code = document.getElementById('new-class-code').value.trim();
    if(name && code) {
        await addDoc(collection(db, "classes"), {
            name, code, teacherId: currentUser.uid, teacherName: currentUser.name
        });
        window.app.closeModal('modal-class');
        loadHub();
    }
}

async function handleCreatePost() {
    const txt = document.getElementById('post-content').value;
    if(txt) {
        await addDoc(collection(db, "classes", currentClass.id, "posts"), {
            content: txt, author: currentUser.name, createdAt: serverTimestamp()
        });
        document.getElementById('post-content').value = '';
        window.app.collapseComposer();
    }
}

async function handleCreateAssignment() {
    const title = document.getElementById('assign-title').value;
    const desc = document.getElementById('assign-desc').value;
    if(title) {
        await addDoc(collection(db, "classes", currentClass.id, "assignments"), {
            title, description: desc, createdAt: serverTimestamp()
        });
        window.app.closeModal('modal-activity');
        loadTab('atividades');
    }
}

async function handleAddStudentManual() {
    const email = document.getElementById('add-stu-email').value;
    if(!email) return;

    // Busca usuário pelo email
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);

    if(!snap.empty) {
        const uDoc = snap.docs[0];
        const oldClasses = uDoc.data().myClasses || [];
        if(!oldClasses.includes(currentClass.id)) {
            await updateDoc(doc(db, "users", uDoc.id), {
                myClasses: [...oldClasses, currentClass.id]
            });
            alert("Aluno matriculado!");
            window.app.closeModal('modal-add-student');
            loadTab('pessoas');
        } else {
            alert("Aluno já está na turma.");
        }
    } else {
        alert("Usuário não encontrado. Peça para ele criar uma conta primeiro.");
    }
}

// --- AUTH UI HANDLERS ---
document.getElementById('toggle-register').onclick = () => {
    // Para simplificar neste arquivo único, vamos reutilizar o form mas mudar a lógica
    // Na prática, em prod, teríamos telas separadas.
    // Aqui, vamos pedir para o usuário preencher o form e clicar em "Criar Conta" (que seria o Login modificado)
    // Mas para manter o código limpo que enviei, vou pedir para usar o Register flow básico
    const name = prompt("Nome Completo:");
    const email = prompt("Email:");
    const pass = prompt("Senha:");
    const code = prompt("Código da Turma (Opcional):");
    
    if(name && email && pass) {
        createUserWithEmailAndPassword(auth, email, pass).then(async (cred) => {
            await updateProfile(cred.user, { displayName: name });
            // Salva dados iniciais
            let myClasses = [];
            if(code) {
                const q = query(collection(db, "classes"), where("code", "==", code));
                const snap = await getDocs(q);
                if(!snap.empty) myClasses.push(snap.docs[0].id);
            }
            await setDoc(doc(db, "users", cred.user.uid), {
                uid: cred.user.uid, name, email, role: 'student', myClasses
            });
        }).catch(e => alert(e.message));
    }
};

document.getElementById('form-auth').onsubmit = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
    .catch(e => alert("Erro: " + e.message));
};

document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);