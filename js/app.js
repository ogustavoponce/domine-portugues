// --- IMPORTAÇÕES FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, 
    signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, setDoc, updateDoc, collection, 
    addDoc, query, where, getDocs, deleteDoc, orderBy 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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

// EMAILS ADMIN
const ADMIN_EMAILS = [
    "domenico.suriale@ifpr.edu.br",
    "domenico@domineportugues.com.br",
    "admin@teste.com"
];

let currentUserData = null;

// --- ELEMENTOS ---
const views = {
    login: document.getElementById('auth-container'),
    app: document.getElementById('app-container'),
    dashboard: document.getElementById('dashboard'),
    classroom: document.getElementById('classroom'),
    profile: document.getElementById('profile'),
    adminClasses: document.getElementById('admin-classes'),
    adminStudents: document.getElementById('admin-students')
};

// --- AUTH FLOW ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadUserProfile(user);
    } else {
        views.login.classList.remove('hidden');
        views.app.classList.add('hidden');
    }
});

async function loadUserProfile(user) {
    const userRef = doc(db, "users", user.uid);
    let snap = await getDoc(userRef);

    if (!snap.exists()) {
        const role = ADMIN_EMAILS.includes(user.email) ? 'admin' : 'student';
        await setDoc(userRef, {
            uid: user.uid,
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            role: role,
            classId: null, classCode: null
        });
        snap = await getDoc(userRef);
    }

    // Force Admin Check
    if (ADMIN_EMAILS.includes(user.email) && snap.data().role !== 'admin') {
        await updateDoc(userRef, { role: 'admin' });
        snap = await getDoc(userRef);
    }

    currentUserData = snap.data();
    initAppUI();
}

function initAppUI() {
    views.login.classList.add('hidden');
    views.app.classList.remove('hidden');
    
    // Setup Profile Data
    document.getElementById('profile-name').value = currentUserData.name;
    document.getElementById('profile-email').value = currentUserData.email;
    document.getElementById('profile-class-code').value = currentUserData.classCode || '';

    // Admin UI Toggle
    const isAdmin = currentUserData.role === 'admin';
    const adminMenu = document.getElementById('admin-menu');
    const saveScheduleBtn = document.getElementById('btn-save-schedule');
    const newPostBtn = document.getElementById('btn-new-post');

    if (isAdmin) {
        adminMenu.classList.remove('hidden');
        saveScheduleBtn.classList.remove('hidden');
        newPostBtn.classList.remove('hidden');
    } else {
        adminMenu.classList.add('hidden');
        saveScheduleBtn.classList.add('hidden');
        newPostBtn.classList.add('hidden');
    }

    // Navegação
    document.querySelectorAll('.nav-item[data-target]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            Object.values(views).forEach(v => { if(v.id !== 'auth-container' && v.id !== 'app-container') v.classList.add('hidden'); });
            
            const target = link.getAttribute('data-target');
            if(views[target]) views[target].classList.remove('hidden');

            if(target === 'dashboard') loadScheduleGrid();
            if(target === 'classroom') loadPosts();
            if(target === 'admin-classes') loadClasses();
            if(target === 'admin-students') loadStudents();
        });
    });

    loadScheduleGrid(); // Default View
}

// --- LOGIC: SCHEDULE GRID (GRADE) ---
const timeSlots = ["07:30", "08:20", "09:10", "10:20", "11:10", "13:30", "14:20", "15:30", "16:20"];
const days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

async function loadScheduleGrid() {
    const grid = document.getElementById('schedule-grid');
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center;">Carregando grade...</div>';

    // Fetch Data
    let scheduleData = {};
    try {
        const docSnap = await getDoc(doc(db, "config", "schedule_v2"));
        if(docSnap.exists()) scheduleData = docSnap.data();
    } catch(e) { console.log("Sem grade salva"); }

    grid.innerHTML = '';
    const isAdmin = currentUserData.role === 'admin';

    // 1. Headers
    grid.innerHTML += `<div></div>`; // Canto vazio
    days.forEach(d => grid.innerHTML += `<div class="grid-header">${d}</div>`);

    // 2. Rows
    timeSlots.forEach(time => {
        // Label Horário
        grid.innerHTML += `<div class="time-label">${time}</div>`;
        
        // Células dos dias
        days.forEach(day => {
            const cellKey = `${day}_${time}`;
            const value = scheduleData[cellKey] || "";
            
            const div = document.createElement('div');
            div.className = `class-slot ${isAdmin ? 'editable' : ''}`;
            if(isAdmin) {
                div.contentEditable = true;
                div.dataset.key = cellKey; // Identificador para salvar
            }
            div.innerText = value;
            
            // Visual Hint para células vazias vs preenchidas
            if(value) div.style.backgroundColor = "white";
            
            grid.appendChild(div);
        });
    });
}

document.getElementById('btn-save-schedule').addEventListener('click', async () => {
    const cells = document.querySelectorAll('.class-slot[data-key]');
    const dataToSave = {};
    
    cells.forEach(cell => {
        if(cell.innerText.trim()) {
            dataToSave[cell.dataset.key] = cell.innerText.trim();
        }
    });

    try {
        await setDoc(doc(db, "config", "schedule_v2"), dataToSave);
        alert("Grade Salva com Sucesso!");
    } catch(e) { alert("Erro ao salvar: " + e.message); }
});

// --- LOGIC: POSTS ---
async function loadPosts() {
    const container = document.getElementById('posts-container');
    container.innerHTML = 'Carregando mural...';
    
    // Se admin, mostra tudo. Se aluno, mostra da turma.
    let q;
    if(currentUserData.role === 'admin') {
        // Simplificado: Admin vê/posta numa coleção global para testes ou precisa selecionar turma
        // Para MVP funcionar bem: Vamos listar posts da turma que o Admin setou no perfil dele, ou global.
        if(currentUserData.classId) {
             q = query(collection(db, "classes", currentUserData.classId, "posts"), orderBy("createdAt", "desc"));
        } else {
            container.innerHTML = "Selecione uma turma no seu perfil para ver o mural.";
            return;
        }
    } else {
        if(!currentUserData.classId) {
            container.innerHTML = "Você não está em nenhuma turma.";
            return;
        }
        q = query(collection(db, "classes", currentUserData.classId, "posts"), orderBy("createdAt", "desc"));
    }

    const snap = await getDocs(q);
    container.innerHTML = '';
    
    if(snap.empty) { container.innerHTML = '<div style="text-align:center; color:#999;">Nenhum aviso.</div>'; return; }

    snap.forEach(d => {
        const p = d.data();
        const div = document.createElement('div');
        div.className = 'post-card';
        div.innerHTML = `
            <span class="post-tag">Aviso</span>
            <h3 style="margin: 8px 0; font-size:18px;">${p.title}</h3>
            <p style="line-height:1.5; color:#444;">${p.content}</p>
            ${p.link ? `<a href="${p.link}" target="_blank" style="display:block; margin-top:10px; color:var(--ios-blue); text-decoration:none; font-weight:500;">📎 Acessar Material</a>` : ''}
        `;
        container.appendChild(div);
    });
}

document.getElementById('btn-new-post').addEventListener('click', async () => {
    if(!currentUserData.classId) return alert("Defina a turma no seu perfil para postar.");
    const title = prompt("Título:");
    const content = prompt("Mensagem:");
    if(title) {
        await addDoc(collection(db, "classes", currentUserData.classId, "posts"), {
            title, content, createdAt: new Date()
        });
        loadPosts();
    }
});

// --- ADMIN: TURMAS ---
async function loadClasses() {
    const grid = document.getElementById('classes-grid');
    grid.innerHTML = '';
    const snap = await getDocs(collection(db, "classes"));
    snap.forEach(d => {
        const c = d.data();
        grid.innerHTML += `
            <div style="background:white; padding:20px; border-radius:16px; border:1px solid #E5E5EA;">
                <h3 style="margin-bottom:5px;">${c.name}</h3>
                <div style="color:#8E8E93; font-size:12px; margin-bottom:15px;">CÓD: ${c.code}</div>
                <button onclick="window.delClass('${d.id}')" style="color:#FF3B30; background:none; border:none; font-weight:600; cursor:pointer;">Excluir</button>
            </div>
        `;
    });
}
document.getElementById('btn-new-class').addEventListener('click', async () => {
    const name = prompt("Nome da Turma:");
    const code = prompt("Código Único:");
    if(name && code) {
        await addDoc(collection(db, "classes"), { name, code });
        loadClasses();
    }
});
window.delClass = async (id) => { if(confirm("Confirmar?")) { await deleteDoc(doc(db, "classes", id)); loadClasses(); }};

// --- EVENTS ---
document.getElementById('btn-google').onclick = () => signInWithPopup(auth, googleProvider);
document.getElementById('login-form').onsubmit = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
};
document.getElementById('btn-logout').onclick = () => signOut(auth);

document.getElementById('btn-join-class').onclick = async () => {
    const code = document.getElementById('profile-class-code').value;
    const q = query(collection(db, "classes"), where("code", "==", code));
    const snap = await getDocs(q);
    if(!snap.empty) {
        const cDoc = snap.docs[0];
        await updateDoc(doc(db, "users", currentUserData.uid), { classId: cDoc.id, classCode: cDoc.data().code });
        alert("Matriculado!");
        location.reload();
    } else alert("Código inválido");
};