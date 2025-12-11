// --- IMPORTAÇÕES FIREBASE (Modular) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    addDoc, 
    deleteDoc, 
    query, 
    where, 
    getDocs, 
    onSnapshot, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- 1. CONFIGURAÇÃO ---
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

// --- 2. CONSTANTES E ESTADO ---
const ADMIN_EMAILS = [
    "domenico.suriale@ifpr.edu.br", 
    "domenico@domineportugues.com.br", 
    "admin@teste.com"
];

let currentUser = null;
let userProfile = null; // Dados do Firestore

// --- 3. ELEMENTOS DOM ---
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const btnGoogle = document.getElementById('btn-google');
const loginError = document.getElementById('login-error');
const contentArea = document.getElementById('content-area');
const pageTitle = document.getElementById('page-title');
const navItems = document.querySelectorAll('.nav-item[data-view]');

// --- 4. LÓGICA DE AUTENTICAÇÃO ---

// Login Google (CRÍTICO: Cria doc se não existir)
btnGoogle.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        await checkAndCreateUserDoc(user);
    } catch (error) {
        showError(error.message);
    }
});

// Login Email
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // onAuthStateChanged cuidará do resto
    } catch (error) {
        showError("Erro no login: " + error.code);
    }
});

// Logout
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// Função Auxiliar: Garante que o usuário tenha documento no Firestore
async function checkAndCreateUserDoc(user) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    let role = 'student';
    // FORÇA ADMIN SE ESTIVER NA LISTA
    if (ADMIN_EMAILS.includes(user.email)) {
        role = 'admin';
    }

    if (!snap.exists()) {
        // Criação inicial
        await setDoc(userRef, {
            uid: user.uid,
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            role: role,
            classId: null, // Sem turma inicialmente
            createdAt: serverTimestamp()
        });
    } else {
        // Se já existe, garante que o role de admin seja atualizado se necessário
        if (role === 'admin' && snap.data().role !== 'admin') {
            await updateDoc(userRef, { role: 'admin' });
        }
    }
}

// OBSERVADOR DE ESTADO (O CORAÇÃO DO SISTEMA)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await checkAndCreateUserDoc(user); // Dupla checagem de segurança
        
        // Carrega Perfil
        const snap = await getDoc(doc(db, "users", user.uid));
        userProfile = snap.data();
        currentUser = user;

        // UI Updates
        document.getElementById('user-name-display').innerText = userProfile.name;
        const roleBadge = document.getElementById('user-role-badge');
        roleBadge.innerText = userProfile.role === 'admin' ? 'Professor' : 'Aluno';
        if (userProfile.role === 'admin') roleBadge.classList.add('admin');
        else roleBadge.classList.remove('admin');

        // Mostra/Esconde Menus de Admin
        const adminBtns = document.querySelectorAll('.admin-only');
        adminBtns.forEach(btn => {
            btn.classList.toggle('hidden', userProfile.role !== 'admin');
        });

        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        
        // Carrega view inicial
        loadView('dashboard');

    } else {
        currentUser = null;
        userProfile = null;
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
    }
});

// --- 5. ROTEAMENTO E NAVEGAÇÃO ---
navItems.forEach(btn => {
    btn.addEventListener('click', () => {
        navItems.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadView(btn.dataset.view);
    });
});

function loadView(viewName) {
    contentArea.innerHTML = '<p>Carregando...</p>';
    
    switch(viewName) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'classroom':
            renderClassroom();
            break;
        case 'admin-classes':
            if(userProfile.role === 'admin') renderAdminClasses();
            else contentArea.innerHTML = "Acesso Negado.";
            break;
        case 'admin-students':
            if(userProfile.role === 'admin') renderAdminStudents();
            else contentArea.innerHTML = "Acesso Negado.";
            break;
        case 'profile':
            renderProfile();
            break;
    }
}

// --- 6. FUNCIONALIDADES (VIEWS) ---

// === A. DASHBOARD (Grade de Horários) ===
async function renderDashboard() {
    pageTitle.innerText = "Painel Geral";
    contentArea.innerHTML = `
        <div class="card">
            <h3>Horário de Atendimento do Professor</h3>
            <div id="schedule-container" class="schedule-grid">Carregando horários...</div>
            ${userProfile.role === 'admin' ? '<button id="btn-save-schedule" class="btn btn-primary" style="margin-top:1rem; width:auto;">Salvar Horários</button>' : ''}
        </div>
        <div class="card">
            <h3>Bem-vindo, ${userProfile.name}</h3>
            <p>Acesse o menu lateral para ver sua turma e materiais.</p>
        </div>
    `;

    // Carregar Horários do Firestore
    const scheduleRef = doc(db, "config", "schedule");
    let scheduleData = {
        seg: "10:00 - 12:00", ter: "10:00 - 12:00", qua: "10:00 - 12:00", qui: "10:00 - 12:00", sex: "10:00 - 12:00"
    };
    
    try {
        const snap = await getDoc(scheduleRef);
        if (snap.exists()) scheduleData = snap.data();
    } catch (e) {
        console.log("Sem config de horário, usando padrão.");
    }

    const days = ['seg', 'ter', 'qua', 'qui', 'sex'];
    const container = document.getElementById('schedule-container');
    container.innerHTML = '';

    days.forEach(day => {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-card';
        const dayName = day.charAt(0).toUpperCase() + day.slice(1);
        
        if (userProfile.role === 'admin') {
            dayDiv.innerHTML = `
                <span class="day-title">${dayName}</span>
                <input type="text" id="sched-${day}" value="${scheduleData[day] || ''}">
            `;
        } else {
            dayDiv.innerHTML = `
                <span class="day-title">${dayName}</span>
                <span>${scheduleData[day] || 'Sem atendimento'}</span>
            `;
        }
        container.appendChild(dayDiv);
    });

    if (userProfile.role === 'admin') {
        document.getElementById('btn-save-schedule').addEventListener('click', async () => {
            const newData = {};
            days.forEach(day => newData[day] = document.getElementById(`sched-${day}`).value);
            await setDoc(scheduleRef, newData);
            alert("Horários atualizados!");
        });
    }
}

// === B. SALA DE AULA & CHAT ===
async function renderClassroom() {
    pageTitle.innerText = "Minha Sala de Aula";
    
    if (!userProfile.classId) {
        contentArea.innerHTML = `
            <div class="card">
                <h3>Você não está matriculado.</h3>
                <p>Vá em "Perfil" e insira o código da sua turma.</p>
            </div>`;
        return;
    }

    // Busca infos da turma
    const classSnap = await getDoc(doc(db, "classes", userProfile.classId));
    if (!classSnap.exists()) {
        contentArea.innerHTML = "<p>Erro: Turma não encontrada.</p>";
        return;
    }
    const classData = classSnap.data();

    contentArea.innerHTML = `
        <div class="card">
            <h3>Turma: ${classData.name} (${classData.code})</h3>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="chat-container">
                <div style="padding:10px; background:#eee; font-weight:bold; border-bottom:1px solid #ddd;">Chat da Turma</div>
                <div id="chat-messages" class="chat-messages"></div>
                <form id="chat-form" class="chat-input-area">
                    <input type="text" id="chat-input" placeholder="Digite sua mensagem..." autocomplete="off">
                    <button type="submit" class="btn btn-primary" style="width:auto;"><span class="material-icons-round">send</span></button>
                </form>
            </div>

            <div>
                 ${userProfile.role === 'admin' ? '<button id="btn-add-post" class="btn btn-primary" style="margin-bottom:1rem;">+ Novo Aviso/Material</button>' : ''}
                 <div id="posts-feed">Carregando posts...</div>
            </div>
        </div>
    `;

    // 1. Lógica do Chat (Realtime)
    const messagesRef = collection(db, "classes", userProfile.classId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    
    const unsubChat = onSnapshot(q, (snapshot) => {
        const div = document.getElementById('chat-messages');
        if(!div) return; // Se mudou de tela
        div.innerHTML = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const el = document.createElement('div');
            const isMe = msg.uid === currentUser.uid;
            el.className = `message ${isMe ? 'msg-mine' : 'msg-other'}`;
            el.innerHTML = `<span class="msg-author">${msg.name}</span>${msg.text}`;
            div.appendChild(el);
        });
        div.scrollTop = div.scrollHeight;
    });

    document.getElementById('chat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const inp = document.getElementById('chat-input');
        if(!inp.value.trim()) return;
        await addDoc(messagesRef, {
            text: inp.value,
            uid: currentUser.uid,
            name: userProfile.name,
            createdAt: serverTimestamp()
        });
        inp.value = '';
    });

    // 2. Lógica de Posts (Professor)
    renderPosts(userProfile.classId);
    if(userProfile.role === 'admin') {
        document.getElementById('btn-add-post').addEventListener('click', () => createPost(userProfile.classId));
    }
}

async function renderPosts(classId) {
    const postsRef = collection(db, "classes", classId, "posts");
    const q = query(postsRef, orderBy("createdAt", "desc"));
    const container = document.getElementById('posts-feed');
    
    // Snapshot para atualizar avisos em tempo real
    onSnapshot(q, (snap) => {
        if(!document.getElementById('posts-feed')) return;
        container.innerHTML = '';
        if (snap.empty) container.innerHTML = '<p>Nenhum aviso ainda.</p>';
        snap.forEach(d => {
            const p = d.data();
            const card = document.createElement('div');
            card.className = 'card';
            card.style.marginBottom = '10px';
            card.innerHTML = `<h4>${p.title}</h4><p>${p.content}</p>${p.link ? `<a href="${p.link}" target="_blank">Abrir Link</a>` : ''}`;
            container.appendChild(card);
        });
    });
}

async function createPost(classId) {
    const title = prompt("Título do Aviso:");
    const content = prompt("Conteúdo:");
    const link = prompt("Link (opcional):");
    if(title && content) {
        await addDoc(collection(db, "classes", classId, "posts"), {
            title, content, link, createdAt: serverTimestamp()
        });
    }
}

// === C. ADMIN - GESTÃO DE TURMAS ===
async function renderAdminClasses() {
    pageTitle.innerText = "Gestão de Turmas";
    contentArea.innerHTML = `
        <div class="card">
            <button id="btn-new-class" class="btn btn-primary">+ Criar Nova Turma</button>
        </div>
        <div id="classes-list"></div>
    `;

    document.getElementById('btn-new-class').addEventListener('click', async () => {
        const name = prompt("Nome da Turma (Ex: 3º Ano A):");
        const code = prompt("Código de Acesso ÚNICO (Ex: PORT3A):");
        if (name && code) {
            await addDoc(collection(db, "classes"), { name, code });
            renderAdminClasses(); // Recarrega
        }
    });

    const snap = await getDocs(collection(db, "classes"));
    const list = document.getElementById('classes-list');
    
    list.innerHTML = '';
    snap.forEach(d => {
        const t = d.data();
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div><strong>${t.name}</strong> (Código: ${t.code})</div>
                <button class="btn btn-danger" style="width:auto;" onclick="deleteClass('${d.id}')">Excluir</button>
            </div>
        `;
        list.appendChild(div);
    });

    // Torna deleteClass global para o onclick funcionar
    window.deleteClass = async (id) => {
        if(confirm("Tem certeza? Isso apagará o chat e avisos.")) {
            await deleteDoc(doc(db, "classes", id));
            renderAdminClasses();
        }
    };
}

// === D. ADMIN - GESTÃO DE ALUNOS ===
async function renderAdminStudents() {
    pageTitle.innerText = "Gestão de Alunos";
    contentArea.innerHTML = `<div class="card"><table id="students-table"><thead><tr><th>Nome</th><th>Email</th><th>Turma Atual</th><th>Ações</th></tr></thead><tbody></tbody></table></div>`;

    // Pega todos os alunos
    const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
    const classesSnap = await getDocs(collection(db, "classes"));
    const classes = [];
    classesSnap.forEach(d => classes.push({id: d.id, ...d.data()}));

    const tbody = document.querySelector('#students-table tbody');
    
    usersSnap.forEach(u => {
        const user = u.data();
        const tr = document.createElement('tr');
        
        // Dropdown de Turmas
        let selectHtml = `<select class="class-select" data-uid="${u.uid}">
            <option value="">Sem Turma</option>`;
        classes.forEach(c => {
            selectHtml += `<option value="${c.id}" ${user.classId === c.id ? 'selected' : ''}>${c.name}</option>`;
        });
        selectHtml += `</select>`;

        tr.innerHTML = `
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${selectHtml}</td>
            <td><button class="btn btn-danger" style="width:auto; padding:5px 10px; font-size:0.8rem;" onclick="banUser('${u.id}')">Banir</button></td>
        `;
        tbody.appendChild(tr);
    });

    // Evento de mudança de turma
    document.querySelectorAll('.class-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
            const uid = e.target.dataset.uid;
            const newClassId = e.target.value;
            await updateDoc(doc(db, "users", uid), { classId: newClassId });
            alert("Aluno movido!");
        });
    });

    window.banUser = async (id) => {
        if(confirm("Banir aluno do sistema? (Esta ação apenas remove o acesso lógico, não deleta do Auth do Firebase)")) {
            // Em um app real, você desativaria via Cloud Function. Aqui vamos marcar como banido.
            await updateDoc(doc(db, "users", id), { role: 'banned' });
            renderAdminStudents();
        }
    };
}

// === E. PERFIL ===
async function renderProfile() {
    pageTitle.innerText = "Meu Perfil";
    contentArea.innerHTML = `
        <div class="card" style="max-width:500px">
            <div class="input-group">
                <label>Nome Completo</label>
                <input type="text" id="profile-name" value="${userProfile.name}">
            </div>
            <div class="input-group">
                <label>Código da Turma (Matrícula)</label>
                <input type="text" id="profile-code" placeholder="Ex: PORT3A">
            </div>
            <button id="btn-save-profile" class="btn btn-primary">Salvar Alterações</button>
        </div>
    `;

    document.getElementById('btn-save-profile').addEventListener('click', async () => {
        const newName = document.getElementById('profile-name').value;
        const code = document.getElementById('profile-code').value.trim();
        
        let updates = { name: newName };

        if (code) {
            // Buscar ID da turma pelo código
            const q = query(collection(db, "classes"), where("code", "==", code));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                updates.classId = querySnapshot.docs[0].id;
                alert(`Matriculado na turma: ${querySnapshot.docs[0].data().name}`);
            } else {
                alert("Código de turma inválido!");
                return;
            }
        }

        await updateDoc(doc(db, "users", currentUser.uid), updates);
        // Atualiza estado local
        userProfile = { ...userProfile, ...updates };
        document.getElementById('user-name-display').innerText = newName;
        alert("Perfil salvo com sucesso!");
    });
}

function showError(msg) {
    loginError.innerText = msg;
    loginError.classList.remove('hidden');
    setTimeout(() => loginError.classList.add('hidden'), 5000);
}