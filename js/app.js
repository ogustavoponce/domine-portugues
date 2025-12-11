import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, 
    signOut, onAuthStateChanged, createUserWithEmailAndPassword, updateProfile 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, setDoc, updateDoc, collection, 
    addDoc, query, where, getDocs, deleteDoc, orderBy, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- CONFIG ---
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

// --- STATE ---
let currentUser = null;
let currentClass = null; // Objeto da turma ativa
let unsubscribePosts = null;

// --- EXPORTED METHODS FOR HTML ---
window.app = {
    navTo: (target) => {
        if(target === 'hub') loadHub();
    },
    logout: () => signOut(auth),
    closeModals: () => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')),
};

// --- AUTH SYSTEM ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadUserProfile(user);
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

async function loadUserProfile(user) {
    const ref = doc(db, "users", user.uid);
    let snap = await getDoc(ref);
    
    // Regra Hardcoded Admin
    const isAdmin = user.email === "domenico.suriale@ifpr.edu.br";

    if (!snap.exists()) {
        const payload = {
            uid: user.uid,
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            role: isAdmin ? 'admin' : 'student',
            classes: [] // Array de IDs de turmas
        };
        await setDoc(ref, payload);
        snap = await getDoc(ref);
    }

    if (isAdmin && snap.data().role !== 'admin') {
        await updateDoc(ref, { role: 'admin' });
        snap = await getDoc(ref);
    }

    currentUser = snap.data();
    initApp();
}

// --- INITIALIZATION ---
function initApp() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    document.getElementById('user-avatar').innerText = currentUser.name.substring(0,2).toUpperCase();
    
    // Render Sidebar Classes (Atalho)
    loadSidebarClasses();
    
    // Start at Hub
    loadHub();
}

// --- HUB LOGIC ---
async function loadHub() {
    // UI Reset
    document.getElementById('view-hub').classList.remove('hidden');
    document.getElementById('view-class').classList.add('hidden');
    document.getElementById('topbar-context').innerText = "Início";

    const grid = document.getElementById('classes-grid');
    grid.innerHTML = '<div style="padding:20px; color:#666">Carregando turmas...</div>';

    // Se admin, vê todas. Se aluno, vê as que está no array 'classes'.
    let q;
    if (currentUser.role === 'admin') {
        q = query(collection(db, "classes"));
        document.getElementById('btn-add-class').classList.remove('hidden');
    } else {
        // Aluno: Busca turmas onde ID está no array do user (limite do firebase: 'in' max 10, simples pra demo)
        if (!currentUser.classes || currentUser.classes.length === 0) {
            grid.innerHTML = '<div style="padding:20px">Você não está em nenhuma turma.</div>';
            return;
        }
        q = query(collection(db, "classes"), where("__name__", "in", currentUser.classes));
        document.getElementById('btn-add-class').classList.add('hidden');
    }

    const snap = await getDocs(q);
    grid.innerHTML = '';
    
    if (snap.empty && currentUser.role === 'admin') grid.innerHTML = 'Nenhuma turma criada.';

    snap.forEach(docSnap => {
        const c = docSnap.data();
        const card = document.createElement('div');
        card.className = 'class-card fade-in';
        card.onclick = () => loadClassroom(docSnap.id, c);
        card.innerHTML = `
            <div class="card-banner">
                <h2>${c.name}</h2>
                <span>...</span>
            </div>
            <div class="card-info">
                ${c.code ? `Código: ${c.code}` : ''} <br>
                ${currentUser.role === 'admin' ? 'Professor' : 'Aluno'}
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- CLASSROOM LOGIC ---
async function loadClassroom(classId, classData) {
    currentClass = { id: classId, ...classData };
    
    // UI Switch
    document.getElementById('view-hub').classList.add('hidden');
    document.getElementById('view-class').classList.remove('hidden');
    document.getElementById('topbar-context').innerText = classData.name;
    
    document.getElementById('class-name-display').innerText = classData.name;
    document.getElementById('class-code-display').innerText = classData.code;

    // Permissions
    if (currentUser.role === 'admin') {
        document.getElementById('post-composer').classList.remove('hidden');
        document.getElementById('teacher-actions-cw').classList.remove('hidden');
        document.getElementById('btn-add-student').classList.remove('hidden');
    } else {
        document.getElementById('post-composer').classList.add('hidden');
        document.getElementById('teacher-actions-cw').classList.add('hidden');
        document.getElementById('btn-add-student').classList.add('hidden');
    }

    // Default Tab
    switchTab('stream');
}

// TABS SYSTEM
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        switchTab(btn.dataset.tab);
    }
});

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    if (tabName === 'stream') loadStream();
    if (tabName === 'classwork') loadClasswork();
    if (tabName === 'people') loadPeople();
}

// --- STREAM (MURAL) ---
function loadStream() {
    if (unsubscribePosts) unsubscribePosts();
    const feed = document.getElementById('stream-feed');
    feed.innerHTML = '';

    const q = query(collection(db, "classes", currentClass.id, "posts"), orderBy("createdAt", "desc"));
    
    unsubscribePosts = onSnapshot(q, (snap) => {
        feed.innerHTML = '';
        if (snap.empty) { feed.innerHTML = '<div style="text-align:center; padding:20px; color:#999">Nenhum aviso.</div>'; return; }
        
        snap.forEach(d => {
            const p = d.data();
            const div = document.createElement('div');
            div.className = 'post-item fade-in';
            div.innerHTML = `
                <div style="font-weight:500; color:var(--primary); margin-bottom:5px;">${p.author}</div>
                <div style="white-space: pre-wrap;">${p.content}</div>
                <div style="font-size:11px; color:#999; margin-top:10px;">
                    ${p.createdAt ? new Date(p.createdAt.seconds*1000).toLocaleDateString() : 'Agora'}
                </div>
            `;
            feed.appendChild(div);
        });
    });
}

// --- CLASSWORK (ATIVIDADES & NOTAS) ---
async function loadClasswork() {
    const list = document.getElementById('assignments-list');
    list.innerHTML = 'Carregando...';
    
    const q = query(collection(db, "classes", currentClass.id, "assignments"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    list.innerHTML = '';

    if (snap.empty) { list.innerHTML = '<div style="padding:20px; text-align:center">Nenhuma atividade postada.</div>'; return; }

    snap.forEach(docSnap => {
        const a = docSnap.data();
        const div = document.createElement('div');
        div.className = 'assign-item';
        div.onclick = () => openAssignmentDetails(docSnap.id, a);
        div.innerHTML = `
            <div style="display:flex; align-items:center;">
                <div class="assign-icon"><i class="ph-bold ph-clipboard-text"></i></div>
                <div class="assign-content">
                    <h4>${a.title}</h4>
                    <span class="assign-meta">Postado em ${a.createdAt ? new Date(a.createdAt.seconds*1000).toLocaleDateString() : ''}</span>
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

// Detalhes da Atividade (Professor corrige, Aluno vê nota)
async function openAssignmentDetails(assignId, assignData) {
    // Simplificação: Se professor, abre lista de alunos para dar nota. Se aluno, vê feedback.
    
    if (currentUser.role === 'admin') {
        // MODO PROFESSOR: Listar alunos para avaliar
        const list = document.getElementById('assignments-list');
        list.innerHTML = `
            <button class="btn btn-text" onclick="loadClasswork()" style="margin-bottom:10px;">← Voltar</button>
            <div class="class-banner" style="padding:16px; margin-bottom:16px;">
                <h2>${assignData.title}</h2>
                <p>${assignData.description}</p>
            </div>
            <h3>Avaliar Alunos</h3>
            <div id="grading-list" class="people-list">Carregando lista...</div>
        `;
        
        // Busca todos os alunos da turma
        const qUsers = query(collection(db, "users"), where("classes", "array-contains", currentClass.id));
        const snapUsers = await getDocs(qUsers);
        
        const gradingList = document.getElementById('grading-list');
        gradingList.innerHTML = '';

        if(snapUsers.empty) gradingList.innerHTML = "Sem alunos nesta turma.";

        // Para cada aluno, busca se já tem nota
        for (const uDoc of snapUsers.docs) {
            const u = uDoc.data();
            // Busca submissão/nota
            const subRef = doc(db, "classes", currentClass.id, "assignments", assignId, "grades", u.uid);
            const subSnap = await getDoc(subRef);
            const gradeData = subSnap.exists() ? subSnap.data() : null;

            const row = document.createElement('div');
            row.className = 'people-item';
            row.style.cursor = 'pointer';
            row.onclick = () => openGradingModal(assignId, u.uid, u.name, gradeData);
            
            let gradeBadge = `<span style="color:#999">Pendente</span>`;
            if (gradeData && gradeData.grade) {
                const colors = {A:'var(--grade-A)', B:'var(--grade-B)', C:'var(--grade-C)', D:'var(--grade-D)'};
                gradeBadge = `<span style="font-weight:bold; color:${colors[gradeData.grade]}">Nota: ${gradeData.grade}</span>`;
            }

            row.innerHTML = `
                <div class="user-avatar" style="background:#ccc">${u.name[0]}</div>
                <div class="people-info">
                    <strong>${u.name}</strong>
                    <div style="font-size:12px;">${gradeBadge}</div>
                </div>
                <div class="people-actions"><i class="ph ph-pencil-simple"></i></div>
            `;
            gradingList.appendChild(row);
        }

    } else {
        // MODO ALUNO: Ver nota
        const subRef = doc(db, "classes", currentClass.id, "assignments", assignId, "grades", currentUser.uid);
        const subSnap = await getDoc(subRef);
        const myGrade = subSnap.exists() ? subSnap.data() : null;

        let content = `
            <h3>${assignData.title}</h3>
            <p style="margin:10px 0;">${assignData.description}</p>
            <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
        `;

        if (myGrade) {
            content += `
                <div style="background:#e8f0fe; padding:20px; border-radius:8px; border:1px solid var(--primary);">
                    <h2 style="color:var(--primary)">Conceito: ${myGrade.grade}</h2>
                    <p><strong>Feedback do Professor:</strong></p>
                    <p>${myGrade.feedback || "Sem comentários."}</p>
                </div>
            `;
        } else {
            content += `<div style="color:#666">Nenhuma nota atribuída ainda.</div>`;
        }
        
        // Exibe em um modal simples ou alerta
        alert(`Atividade: ${assignData.title}\n\n${myGrade ? `Sua Nota: ${myGrade.grade}\nFeedback: ${myGrade.feedback}` : "Sem nota ainda."}`);
    }
}

// --- GRADING SYSTEM (Lançar Conceito) ---
window.openGradingModal = (assignId, studentId, studentName, currentData) => {
    document.getElementById('modal-grading').classList.remove('hidden');
    document.getElementById('grading-student-name').innerText = `Aluno: ${studentName}`;
    document.getElementById('grade-feedback').value = currentData ? currentData.feedback : '';
    
    // Reset radios
    document.querySelectorAll('input[name="grade"]').forEach(r => r.checked = false);
    if (currentData && currentData.grade) {
        document.getElementById(`grade-${currentData.grade}`).checked = true;
    }

    // Save Logic
    document.getElementById('btn-submit-grade').onclick = async () => {
        const selected = document.querySelector('input[name="grade"]:checked');
        if (!selected) return alert("Selecione A, B, C ou D");
        
        const feedback = document.getElementById('grade-feedback').value;
        
        await setDoc(doc(db, "classes", currentClass.id, "assignments", assignId, "grades", studentId), {
            grade: selected.value,
            feedback: feedback,
            gradedAt: serverTimestamp(),
            teacher: currentUser.name
        });
        
        app.closeModals();
        // Refresh a view chamando novamente os detalhes
        const assignSnap = await getDoc(doc(db, "classes", currentClass.id, "assignments", assignId));
        openAssignmentDetails(assignId, assignSnap.data());
    };
};

// --- PEOPLE (ROSTER) ---
async function loadPeople() {
    const tList = document.getElementById('teachers-list');
    const sList = document.getElementById('students-list');
    tList.innerHTML = ''; sList.innerHTML = 'Carregando...';

    // 1. Professores (Mock ou Owner)
    tList.innerHTML = `
        <div class="people-item">
            <div class="user-avatar">DO</div>
            <div class="people-info"><strong>Domenico Sturiale</strong></div>
        </div>
    `;

    // 2. Alunos
    const q = query(collection(db, "users"), where("classes", "array-contains", currentClass.id));
    const snap = await getDocs(q);
    sList.innerHTML = '';
    
    if(snap.empty) { sList.innerHTML = '<div style="padding:10px; color:#999">Sem alunos.</div>'; }

    snap.forEach(d => {
        const u = d.data();
        const div = document.createElement('div');
        div.className = 'people-item';
        div.innerHTML = `
            <div class="user-avatar" style="background:#1a73e8">${u.name[0]}</div>
            <div class="people-info">
                <div>${u.name}</div>
                <div style="font-size:11px; color:#999">${u.email}</div>
            </div>
            ${currentUser.role === 'admin' ? 
              `<div class="people-actions">
                  <button class="icon-btn" onclick="removeStudent('${d.id}')" title="Remover"><i class="ph ph-trash" style="color:#d93025"></i></button>
               </div>` 
            : ''}
        `;
        sList.appendChild(div);
    });
}

// --- ADMIN: ADD STUDENT MANUALLY ---
document.getElementById('btn-add-student').onclick = () => {
    document.getElementById('modal-add-student').classList.remove('hidden');
};

document.getElementById('btn-confirm-add-student').onclick = async () => {
    const name = document.getElementById('new-stu-name').value;
    const email = document.getElementById('new-stu-email').value;
    const pass = document.getElementById('new-stu-pass').value;

    if(!name || !email || !pass) return alert("Preencha tudo");

    try {
        // Create auth user (Note: this logs out current user in client SDK standard, 
        // real admin panel uses Admin SDK. Here we simulate by creating and re-logging or just alert).
        // WARNING: Client SDK createUserWithEmailAndPassword signs in the new user immediately.
        // TRICK: We will just create a doc in Firestore for this MVP and tell the user to Register properly, 
        // OR we instruct the professor that this feature logs them out.
        // BETTER UX for this code snippet: Just create the Firestore Reference "Invited" or handle logic.
        
        // Simpler approach for this snippet: Just add "classes" to an EXISTING user if found, or alert limitation.
        
        alert("Atenção: Para criar conta nova, o sistema fará logout. (Limitação do Firebase Client SDK).");
        // In a real pro app, use Cloud Functions. Here, we skip auth creation and assume user exists or we create a placeholder.
        // Let's create a placeholder doc so they appear in list.
        
        // Check if user exists in DB
        const q = query(collection(db, "users"), where("email", "==", email));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            // User exists, just add class
            const uDoc = snap.docs[0];
            const oldClasses = uDoc.data().classes || [];
            if(!oldClasses.includes(currentClass.id)) {
                await updateDoc(doc(db, "users", uDoc.id), { classes: [...oldClasses, currentClass.id] });
                alert("Aluno adicionado à turma!");
            } else {
                alert("Aluno já está na turma.");
            }
        } else {
            alert("Aluno não tem conta na plataforma. Peça para ele se registrar com o código: " + currentClass.code);
        }
        app.closeModals();
        loadPeople();
        
    } catch(e) { alert(e.message); }
};

window.removeStudent = async (uid) => {
    if(confirm("Remover aluno da turma?")) {
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);
        const classes = snap.data().classes.filter(c => c !== currentClass.id);
        await updateDoc(ref, { classes: classes });
        loadPeople();
    }
};

// --- POST CREATION ---
document.getElementById('btn-post-submit').onclick = async () => {
    const txt = document.getElementById('post-input').value;
    if (!txt) return;
    
    await addDoc(collection(db, "classes", currentClass.id, "posts"), {
        content: txt,
        author: currentUser.name,
        createdAt: serverTimestamp()
    });
    document.getElementById('post-input').value = '';
    document.getElementById('composer-expanded').classList.add('hidden');
    document.querySelector('.composer-collapsed').classList.remove('hidden');
};

// --- SIDEBAR HELPER ---
async function loadSidebarClasses() {
    // Simplified: Just clear/reload when needed.
}

// --- LOGIN FORMS ---
document.getElementById('toggle-register').onclick = () => {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
};
document.getElementById('toggle-login').onclick = () => {
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
};

document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); }
    catch(e) { alert("Erro ao entrar: " + e.message); }
};

document.getElementById('register-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const code = document.getElementById('reg-code').value.trim();

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(cred.user, { displayName: name });
        
        let classIds = [];
        if(code) {
            const q = query(collection(db, "classes"), where("code", "==", code));
            const snap = await getDocs(q);
            if(!snap.empty) classIds.push(snap.docs[0].id);
        }

        await setDoc(doc(db, "users", cred.user.uid), {
            uid: cred.user.uid,
            name, email, role: 'student', classes: classIds
        });
        
    } catch(e) { alert(e.message); }
};

// --- ACTIONS ADMIN ---
document.getElementById('btn-add-class').onclick = async () => {
    const n = prompt("Nome da Turma:");
    const c = prompt("Código da Turma (Ex: TURMA1):");
    if(n && c) {
        await addDoc(collection(db, "classes"), { name: n, code: c });
        loadHub();
    }
};

document.getElementById('btn-create-assignment').onclick = () => {
    document.getElementById('modal-assignment').classList.remove('hidden');
};

document.getElementById('btn-save-assignment').onclick = async () => {
    const t = document.getElementById('assign-title').value;
    const d = document.getElementById('assign-desc').value;
    if(t) {
        await addDoc(collection(db, "classes", currentClass.id, "assignments"), {
            title: t, description: d, createdAt: serverTimestamp()
        });
        app.closeModals();
        loadClasswork();
    }
};