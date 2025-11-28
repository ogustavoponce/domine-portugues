import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    OAuthProvider,
    signOut, 
    onAuthStateChanged,
    updateProfile 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    setDoc, 
    doc, 
    getDoc,
    addDoc,
    serverTimestamp,
    onSnapshot,
    orderBy,
    updateDoc
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// SUAS CHAVES DO FIREBASE
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

// ESTADO GLOBAL
const state = {
    user: null,
    profile: null,
    isAdmin: false,
    currentClassCode: null
};

// ELEMENTOS DOM
const el = {
    views: { auth: document.getElementById('auth-view'), app: document.getElementById('app-view') },
    auth: {
        formLogin: document.getElementById('login-form'),
        formRegister: document.getElementById('register-form'),
        btnToggle: document.getElementById('btn-toggle-auth'),
        title: document.getElementById('auth-title'),
        btnGoogle: document.getElementById('btn-google'),
        btnApple: document.getElementById('btn-apple')
    },
    app: {
        content: document.getElementById('dynamic-content'),
        userName: document.getElementById('user-name'),
        userRole: document.getElementById('user-role'),
        userAvatar: document.getElementById('user-avatar'),
        btnLogout: document.getElementById('btn-logout'),
        sidebar: document.querySelector('.sidebar'),
        mobileToggle: document.getElementById('mobile-menu-toggle')
    }
};

// --- INICIALIZAÇÃO ---
function init() {
    setupListeners();
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            state.user = user;
            await loadProfile(user.uid);
            el.views.auth.classList.remove('active');
            el.views.app.classList.add('active');
            navigateTo('home');
        } else {
            resetState();
            el.views.app.classList.remove('active');
            el.views.auth.classList.add('active');
        }
    });
}

function resetState() {
    state.user = null;
    state.profile = null;
    state.isAdmin = false;
    state.currentClassCode = null;
}

// --- PERFIL E DADOS ---
async function loadProfile(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            state.profile = docSnap.data();
            state.isAdmin = state.profile.role === 'admin';
            state.currentClassCode = state.profile.classCode;
        } else {
            // Perfil temporário pós-login social
            state.profile = { 
                name: state.user.displayName || "Novo Usuário", 
                role: 'aluno', 
                email: state.user.email 
            };
            // ADMIN CHECK
            if(state.user.email === 'domenico.suriale@ifpr.edu.br') {
                state.isAdmin = true;
                state.profile.role = 'admin';
            }
        }
        updateUI();
    } catch (e) { console.error(e); }
}

function updateUI() {
    const name = state.profile.name || "Usuário";
    el.app.userName.textContent = name.split(' ')[0];
    el.app.userRole.textContent = state.isAdmin ? "Professor / Admin" : "Aluno";
    el.app.userAvatar.textContent = name[0].toUpperCase();
}

// --- ROTEAMENTO ---
window.navigateTo = function(page) {
    // UI Navegação
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const activeItem = document.querySelector(`[data-target="${page}"]`);
    if(activeItem) activeItem.classList.add('active');
    el.app.sidebar.classList.remove('open');

    // Renderizar Conteúdo
    if (page === 'home') renderHome();
    else if (page === 'classes') renderClasses();
    else if (page === 'chat') renderChat();
};

// --- RENDER: HOME (COM TABELA DE HORÁRIOS) ---
async function renderHome() {
    // Buscar horário salvo
    let scheduleData = {
        seg: "Atendimento 10h",
        qua: "Aula 3B",
        sex: "Coordenação"
    };
    
    try {
        const docSnap = await getDoc(doc(db, "config", "schedule"));
        if(docSnap.exists()) scheduleData = docSnap.data();
    } catch(e) {}

    const isEditable = state.isAdmin ? "" : "readonly";
    const editHint = state.isAdmin ? "<small>(Edite os campos abaixo e eles salvam automaticamente)</small>" : "";

    el.app.content.innerHTML = `
        <div class="fade-in">
            <h2>Olá, ${state.profile.name.split(' ')[0]}!</h2>
            <div class="dashboard-card" style="border-left: 5px solid var(--primary)">
                <h3><i class="ph ph-clock"></i> Horários de Atendimento ${editHint}</h3>
                <table class="schedule-table">
                    <thead><tr><th>Dia</th><th>Disponibilidade / Local</th></tr></thead>
                    <tbody>
                        <tr><td>Segunda</td><td><input class="schedule-input" id="sched-seg" value="${scheduleData.seg || ''}" ${isEditable} onchange="saveSchedule()"></td></tr>
                        <tr><td>Quarta</td><td><input class="schedule-input" id="sched-qua" value="${scheduleData.qua || ''}" ${isEditable} onchange="saveSchedule()"></td></tr>
                        <tr><td>Sexta</td><td><input class="schedule-input" id="sched-sex" value="${scheduleData.sex || ''}" ${isEditable} onchange="saveSchedule()"></td></tr>
                    </tbody>
                </table>
            </div>
            ${state.isAdmin ? renderAdminPanel() : renderStudentInfo()}
        </div>
    `;
}

function renderAdminPanel() {
    return `
        <div class="dashboard-card">
            <h3>Painel Administrativo</h3>
            <p>Gerencie turmas e alunos.</p>
            <div style="display:flex; gap:10px; margin-top:15px">
                <button class="btn-primary" onclick="alert('Funcionalidade de Criar Turma em breve!')">Criar Turma</button>
                <button class="btn-social" onclick="navigateTo('classes')">Ver Turmas</button>
            </div>
        </div>
    `;
}

function renderStudentInfo() {
    return `
        <div class="dashboard-card">
            <h3>Sua Turma: ${state.currentClassCode || 'Não definida'}</h3>
            <p>Acesse "Aulas" para ver o material disponível.</p>
        </div>
    `;
}

// Função Global para salvar horário
window.saveSchedule = async function() {
    if(!state.isAdmin) return;
    const data = {
        seg: document.getElementById('sched-seg').value,
        qua: document.getElementById('sched-qua').value,
        sex: document.getElementById('sched-sex').value
    };
    await setDoc(doc(db, "config", "schedule"), data);
    // Feedback visual simples pode ser adicionado aqui
};

// --- RENDER: CLASSES ---
async function renderClasses() {
    el.app.content.innerHTML = `<h2>Aulas e Materiais</h2><p>Carregando...</p>`;
    // Se admin, vê tudo. Se aluno, vê sua turma.
    const q = state.isAdmin ? collection(db, "classes") : query(collection(db, "classes"), where("code", "==", state.currentClassCode || ""));
    
    try {
        const snap = await getDocs(q);
        let html = `<div class="fade-in"><h2>Aulas e Materiais</h2>`;
        
        if(snap.empty) {
            html += `<p>Nenhuma turma encontrada. Entre em contato com o professor.</p></div>`;
        } else {
            snap.forEach(doc => {
                const d = doc.data();
                html += `
                    <div class="dashboard-card">
                        <h3>${d.name}</h3>
                        <p>Código: <strong>${d.code}</strong></p>
                        <button class="btn-primary" style="margin-top:10px; width:auto" onclick="alert('Abrir PDF/Material')">Ver Materiais</button>
                    </div>
                `;
            });
            html += `</div>`;
        }
        el.app.content.innerHTML = html;
    } catch(e) { el.app.content.innerHTML = "Erro ao carregar."; }
}

// --- RENDER: CHAT (TEMPO REAL) ---
let unsubscribeChat = null;

function renderChat() {
    // Se for admin, precisamos escolher qual chat ele vê. Por simplicidade, vamos ver o chat da turma "GERAL" ou o primeiro disponível.
    // Para MVP, vamos assumir que o admin vê o chat da turma que ele digitar ou selecionar.
    // Aluno vê o da sua turma.
    
    const chatRoom = state.currentClassCode || "GERAL"; // Fallback

    el.app.content.innerHTML = `
        <div class="fade-in" style="height:100%">
            <h2>Chat da Turma: ${chatRoom}</h2>
            <div class="chat-container">
                <div id="chat-messages" class="chat-messages">
                    <p style="text-align:center; opacity:0.5">Carregando mensagens...</p>
                </div>
                <form id="chat-form" class="chat-input-area">
                    <input type="text" id="chat-input" class="chat-input" placeholder="Digite sua mensagem..." required autocomplete="off">
                    <button type="submit" class="btn-send"><i class="ph ph-paper-plane-right"></i></button>
                </form>
            </div>
        </div>
    `;

    // Listener Firestore
    const q = query(collection(db, `chats/${chatRoom}/messages`), orderBy("createdAt", "asc"));
    
    if(unsubscribeChat) unsubscribeChat(); // Limpar anterior

    unsubscribeChat = onSnapshot(q, (snapshot) => {
        const div = document.getElementById('chat-messages');
        if(!div) return;
        div.innerHTML = "";
        
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMine = msg.uid === state.user.uid;
            const msgEl = document.createElement('div');
            msgEl.className = `message ${isMine ? 'msg-mine' : 'msg-other'}`;
            msgEl.innerHTML = `
                ${!isMine ? `<span class="msg-sender">${msg.senderName}</span>` : ''}
                ${msg.text}
            `;
            div.appendChild(msgEl);
        });
        div.scrollTop = div.scrollHeight; // Auto scroll
    });

    // Enviar Msg
    document.getElementById('chat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if(!text) return;

        await addDoc(collection(db, `chats/${chatRoom}/messages`), {
            text: text,
            uid: state.user.uid,
            senderName: state.profile.name,
            createdAt: serverTimestamp()
        });
        input.value = "";
    });
}

// --- EVENTOS DE AUTH ---
function setupListeners() {
    el.auth.btnToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const isLogin = !el.auth.formLogin.classList.contains('hidden');
        el.auth.formLogin.classList.toggle('hidden', isLogin);
        el.auth.formRegister.classList.toggle('hidden', !isLogin);
        el.auth.title.textContent = isLogin ? "Criar Conta" : "Bem-vindo";
        el.auth.btnToggle.textContent = isLogin ? "Voltar para Login" : "Cadastre-se";
    });

    el.auth.formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        try { await signInWithEmailAndPassword(auth, email, pass); } catch(e) { alert(e.message); }
    });

    el.auth.formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-pass').value;
        const code = document.getElementById('reg-class-code').value;

        try {
            // Verifica turma (Simplificado para permitir primeiro cadastro)
            const q = query(collection(db, "classes"), where("code", "==", code));
            const snap = await getDocs(q);
            // ATENÇÃO: Descomente a linha abaixo quando já tiver criado turmas no painel admin
            // if (snap.empty) throw new Error("Turma não encontrada.");

            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            await setDoc(doc(db, "users", cred.user.uid), {
                name, email, role: 'aluno', classCode: code, uid: cred.user.uid
            });
        } catch(e) { alert("Erro: " + e.message); }
    });

    // Social Login
    el.auth.btnGoogle.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
    
    // LOGIN APPLE (Requer configuração no Console Firebase)
    el.auth.btnApple.addEventListener('click', () => {
        const provider = new OAuthProvider('apple.com');
        signInWithPopup(auth, provider).catch(err => alert("Erro Apple: " + err.message));
    });

    el.app.btnLogout.addEventListener('click', () => signOut(auth));
    el.app.mobileToggle.addEventListener('click', () => el.app.sidebar.classList.toggle('open'));
    
    // Navegação Menu
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.target));
    });
}

init();



