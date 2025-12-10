// --- IMPORTAÇÕES FIREBASE (V9 MODULAR) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, 
    signOut, onAuthStateChanged, createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, setDoc, updateDoc, collection, 
    addDoc, query, where, getDocs, deleteDoc, orderBy 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- CONFIGURAÇÃO ---
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

// --- CONSTANTES DE NEGÓCIO ---
const ADMIN_EMAILS = [
    "domenico.suriale@ifpr.edu.br",
    "domenico@domineportugues.com.br",
    "admin@teste.com"
];

// --- ESTADO GLOBAL ---
let currentUserData = null;

// --- ELEMENTOS DOM ---
const views = {
    login: document.getElementById('auth-container'),
    app: document.getElementById('app-container'),
    dashboard: document.getElementById('dashboard'),
    adminClasses: document.getElementById('admin-classes'),
    adminStudents: document.getElementById('admin-students'),
    classroom: document.getElementById('classroom'),
    profile: document.getElementById('profile')
};

// --- INICIALIZAÇÃO E AUTH ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await handleUserLogin(user);
    } else {
        showLoginScreen();
    }
});

async function handleUserLogin(user) {
    try {
        const userRef = doc(db, "users", user.uid);
        let userSnap = await getDoc(userRef);

        // REGRA CRÍTICA: Se admin hardcoded, força role
        const isAdminEmail = ADMIN_EMAILS.includes(user.email);
        let role = 'student';

        if (!userSnap.exists()) {
            // Cria usuário se não existir (Google First Login)
            role = isAdminEmail ? 'admin' : 'student';
            await setDoc(userRef, {
                uid: user.uid,
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                role: role,
                classId: null,
                classCode: null
            });
        } else {
            // Se já existe, verifica se precisa promover para Admin
            if (isAdminEmail && userSnap.data().role !== 'admin') {
                await updateDoc(userRef, { role: 'admin' });
                role = 'admin';
            } else {
                role = userSnap.data().role;
            }
        }

        // Recarrega dados atualizados
        userSnap = await getDoc(userRef);
        currentUserData = userSnap.data();

        setupUIForUser();
    } catch (error) {
        console.error("Erro no login:", error);
        alert("Erro ao carregar perfil: " + error.message);
        signOut(auth);
    }
}

// --- LÓGICA DE UI ---
function showLoginScreen() {
    views.login.classList.remove('hidden');
    views.app.classList.add('hidden');
}

function setupUIForUser() {
    views.login.classList.add('hidden');
    views.app.classList.remove('hidden');

    // Config Sidebar
    document.getElementById('profile-name').value = currentUserData.name;
    document.getElementById('profile-email').value = currentUserData.email;
    document.getElementById('profile-class-code').value = currentUserData.classCode || '';

    // Permissões
    const adminMenu = document.getElementById('admin-menu');
    const saveScheduleBtn = document.getElementById('btn-save-schedule');
    const newPostBtn = document.getElementById('btn-new-post');

    if (currentUserData.role === 'admin') {
        adminMenu.classList.remove('hidden');
        saveScheduleBtn.classList.remove('hidden');
        newPostBtn.classList.remove('hidden'); // Admin pode postar em qualquer lugar
        // Carrega dados Admin
        loadStudents();
        loadClasses();
    } else {
        adminMenu.classList.add('hidden');
        saveScheduleBtn.classList.add('hidden');
        newPostBtn.classList.add('hidden');
    }

    loadSchedule();
    showSection('dashboard');
}

// Navegação
document.querySelectorAll('.nav-link[data-target]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('data-target');
        showSection(targetId);
        
        // Atualiza classe active
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
    });
});

function showSection(id) {
    // Esconde todas as seções
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    
    // Mostra alvo
    if(views[id]) views[id].classList.remove('hidden');

    // Carregamento sob demanda
    if (id === 'classroom') loadClassroom();
}

// --- LOGIN EVENTS ---
document.getElementById('btn-google').addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, googleProvider);
        // onAuthStateChanged cuidará do resto
    } catch (error) {
        alert("Erro Google: " + error.message);
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        alert("Erro Login: " + error.message);
    }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// --- ADMIN FEATURES: SCHEDULE ---
const weekDays = ['seg', 'ter', 'qua', 'qui', 'sex'];

async function loadSchedule() {
    const tbody = document.getElementById('schedule-body');
    tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
    
    try {
        const docRef = doc(db, "config", "schedule");
        const docSnap = await getDoc(docRef);
        const data = docSnap.exists() ? docSnap.data() : { seg: '', ter: '', qua: '', qui: '', sex: '' };
        
        const isAdm = currentUserData?.role === 'admin';
        
        tbody.innerHTML = `
            <tr>
                ${weekDays.map(day => `
                    <td>
                        <textarea class="schedule-input" data-day="${day}" 
                        ${!isAdm ? 'disabled style="border:none; bg:transparent; resize:none;"' : ''}
                        >${data[day] || ''}</textarea>
                    </td>
                `).join('')}
            </tr>
        `;
    } catch (e) { console.error(e); }
}

document.getElementById('btn-save-schedule').addEventListener('click', async () => {
    const inputs = document.querySelectorAll('.schedule-input');
    const newData = {};
    inputs.forEach(input => newData[input.dataset.day] = input.value);
    
    await setDoc(doc(db, "config", "schedule"), newData);
    alert("Horário atualizado!");
});

// --- ADMIN FEATURES: CLASS & STUDENTS ---
async function loadClasses() {
    const container = document.getElementById('classes-grid');
    container.innerHTML = '';
    const q = query(collection(db, "classes"));
    const querySnapshot = await getDocs(q);
    
    querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <h3>${data.name}</h3>
            <p style="color:var(--text-sec)">Código: <strong>${data.code}</strong></p>
            <button onclick="window.deleteClass('${docSnap.id}')" class="btn btn-danger btn-sm" style="margin-top:10px">Excluir</button>
        `;
        container.appendChild(div);
    });
}

document.getElementById('btn-new-class').addEventListener('click', async () => {
    const name = prompt("Nome da Turma (Ex: 3º Ano A):");
    const code = prompt("Código Único (Ex: PORT3A):");
    if(name && code) {
        await addDoc(collection(db, "classes"), { name, code });
        loadClasses();
    }
});

window.deleteClass = async (id) => {
    if(confirm("Tem certeza?")) {
        await deleteDoc(doc(db, "classes", id));
        loadClasses();
    }
};

async function loadStudents() {
    const tbody = document.getElementById('students-list');
    tbody.innerHTML = '';
    
    // Pega todas as turmas para montar o dropdown
    const classesSnap = await getDocs(collection(db, "classes"));
    const classesOptions = [];
    classesSnap.forEach(c => classesOptions.push({id: c.id, ...c.data()}));

    const q = query(collection(db, "users"), where("role", "!=", "admin"));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach(userSnap => {
        const u = userSnap.data();
        const tr = document.createElement('tr');
        
        // Dropdown de turmas
        let selectHtml = `<select onchange="window.moveStudent('${u.uid}', this.value)" style="padding:5px;">`;
        selectHtml += `<option value="">Sem Turma</option>`;
        classesOptions.forEach(c => {
            const selected = u.classId === c.id ? 'selected' : '';
            selectHtml += `<option value="${c.id}||${c.code}" ${selected}>${c.name}</option>`;
        });
        selectHtml += `</select>`;

        tr.innerHTML = `
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td>${selectHtml}</td>
            <td><button onclick="window.banStudent('${u.uid}')" class="btn btn-danger btn-sm">Banir</button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.moveStudent = async (uid, value) => {
    if(!value) return;
    const [classId, classCode] = value.split('||');
    await updateDoc(doc(db, "users", uid), { classId, classCode });
    alert("Aluno movido!");
};

window.banStudent = async (uid) => { // Apenas admin lógico, Firebase Auth requires Admin SDK para ban real
    if(confirm("Remover acesso deste aluno?")) {
        await updateDoc(doc(db, "users", uid), { role: 'banned' });
        loadStudents();
    }
};

// --- STUDENT FEATURES: PROFILE & CLASSROOM ---
document.getElementById('btn-join-class').addEventListener('click', async () => {
    const code = document.getElementById('profile-class-code').value.trim();
    if(!code) return;

    const q = query(collection(db, "classes"), where("code", "==", code));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        alert("Código de turma inválido!");
    } else {
        const classDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, "users", currentUserData.uid), {
            classId: classDoc.id,
            classCode: classDoc.data().code
        });
        alert("Matriculado com sucesso!");
        // Atualiza local
        currentUserData.classId = classDoc.id;
        currentUserData.classCode = classDoc.data().code;
    }
});

document.getElementById('btn-update-profile').addEventListener('click', async () => {
    const newName = document.getElementById('profile-name').value;
    await updateDoc(doc(db, "users", currentUserData.uid), { name: newName });
    alert("Perfil salvo.");
});

async function loadClassroom() {
    const container = document.getElementById('posts-container');
    const title = document.getElementById('classroom-title');
    
    // Se não tiver turma
    if (!currentUserData.classId && currentUserData.role !== 'admin') {
        container.innerHTML = '<div class="post-card"><h3>Você não está em nenhuma turma.</h3><p>Vá em Perfil e digite o código.</p></div>';
        return;
    }

    // Se admin, vê tudo (ou poderia implementar seletor, aqui simplificado para ver posts gerais)
    // Lógica para aluno: ver posts da sua classId
    
    let targetClassId = currentUserData.classId;
    
    // Se admin, vamos permitir criar post para qual turma? 
    // Simplificação: Admin posta na turma "Global" ou cria posts visiveis para todos se não tiver classId.
    // Para robustez do MVP pedido: Aluno só vê posts onde post.classId == user.classId
    
    container.innerHTML = 'Carregando...';
    
    // Busca posts
    let q;
    if(targetClassId) {
        q = query(collection(db, "classes", targetClassId, "posts"), orderBy("createdAt", "desc"));
    } else {
         // Fallback se admin sem turma tentar ver
         container.innerHTML = "Selecione uma turma para ver o mural (Admin Mode - Future Feature)";
         return;
    }

    try {
        const querySnapshot = await getDocs(q);
        container.innerHTML = '';
        
        if(querySnapshot.empty) {
            container.innerHTML = '<div class="empty-state">Nenhum aviso por enquanto.</div>';
            return;
        }

        querySnapshot.forEach(doc => {
            const p = doc.data();
            const date = p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleDateString() : '';
            const html = `
                <div class="post-card">
                    <div class="post-meta"><span>${date}</span> <span>Oficial</span></div>
                    <div class="post-title">${p.title}</div>
                    <div class="post-content">${p.content}</div>
                    ${p.link ? `<a href="${p.link}" target="_blank" class="post-link">📎 Acessar Material</a>` : ''}
                    ${currentUserData.role === 'admin' ? `<button onclick="window.delPost('${targetClassId}', '${doc.id}')" class="btn btn-danger btn-sm" style="float:right">Del</button>` : ''}
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (err) {
        console.log(err);
        container.innerHTML = "Erro ao carregar posts ou você não tem acesso.";
    }
}

// Criação de Post (Apenas Admin)
document.getElementById('btn-new-post').addEventListener('click', async () => {
    // Admin precisa estar "logado" em uma turma no perfil para postar nela, ou selecionar.
    // Para simplificar lógica hardcoded: Posta na turma que o Admin tiver setado no próprio perfil (para testes)
    // OU, idealmente, Admin seleciona turma. 
    // SOLUÇÃO ROBUSTA: Prompt pede ID da turma ou usa a do Admin.
    
    if(!currentUserData.classId) {
        alert("Admin: Defina uma turma no seu Perfil (campo código) para onde este post irá.");
        return;
    }

    const title = prompt("Título do Aviso:");
    const content = prompt("Mensagem:");
    const link = prompt("Link (opcional):");

    if (title && content) {
        await addDoc(collection(db, "classes", currentUserData.classId, "posts"), {
            title, content, link, createdAt: new Date()
        });
        loadClassroom();
    }
});

window.delPost = async (classId, postId) => {
    if(confirm("Apagar post?")) {
        await deleteDoc(doc(db, "classes", classId, "posts", postId));
        loadClassroom();
    }
};
