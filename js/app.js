import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    OAuthProvider,
    signOut, 
    onAuthStateChanged
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
    orderBy
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// CONFIGURAÇÃO FIREBASE
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

// CONSTANTE DO ADMIN (Blindado contra erros de digitação)
const ADMIN_EMAIL = "domenico.suriale@ifpr.edu.br";

// ESTADO GLOBAL
const state = {
    user: null,
    profile: null,
    isAdmin: false
};

// ELEMENTOS DOM
const el = {
    views: { auth: document.getElementById('auth-view'), app: document.getElementById('app-view') },
    auth: {
        formLogin: document.getElementById('login-form'),
        formRegister: document.getElementById('register-form'),
        btnToggle: document.getElementById('btn-toggle-auth'),
        title: document.getElementById('auth-title'),
        subtitle: document.getElementById('auth-subtitle'),
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
            console.log("Usuário logado:", user.email);
            state.user = user;
            await loadProfile(user);
            el.views.auth.classList.remove('active');
            el.views.app.classList.add('active');
            navigateTo('home');
        } else {
            console.log("Usuário deslogado");
            state.user = null;
            state.profile = null;
            state.isAdmin = false;
            el.views.app.classList.remove('active');
            el.views.auth.classList.add('active');
        }
    });
}

// --- PERFIL E VERIFICAÇÃO DE ADMIN ---
async function loadProfile(user) {
    try {
        // 1. Verificação de Admin imediata e robusta
        const emailAtual = user.email.toLowerCase().trim();
        state.isAdmin = (emailAtual === ADMIN_EMAIL);
        
        console.log("É admin?", state.isAdmin);

        // 2. Buscar perfil no Firestore
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            state.profile = docSnap.data();
        } else {
            // Cria perfil temporário em memória se não existir
            state.profile = { 
                name: user.displayName || "Usuário", 
                role: state.isAdmin ? 'admin' : 'aluno',
                email: user.email 
            };
        }

        // Forçar role admin no objeto de perfil se o email bater
        if (state.isAdmin) state.profile.role = 'admin';

        updateSidebarUI();
    } catch (e) { console.error("Erro perfil:", e); }
}

function updateSidebarUI() {
    const firstName = state.profile.name.split(' ')[0];
    el.app.userName.textContent = firstName;
    el.app.userRole.textContent = state.isAdmin ? "Professor" : "Aluno";
    el.app.userAvatar.textContent = firstName[0].toUpperCase();
}

// --- ROTEAMENTO ---
window.navigateTo = function(page) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const activeItem = document.querySelector(`[data-target="${page}"]`);
    if(activeItem) activeItem.classList.add('active');
    
    el.app.sidebar.classList.remove('open'); // Fecha mobile menu

    if (page === 'home') renderHome();
    else if (page === 'classes') renderClasses();
    else if (page === 'chat') renderChat();
};

// --- RENDERIZADORES ---

async function renderHome() {
    // Horários (Admin edita, Aluno vê)
    let schedule = { seg: "", qua: "", sex: "" };
    try {
        const snap = await getDoc(doc(db, "config", "schedule"));
        if(snap.exists()) schedule = snap.data();
    } catch(e){}

    const readOnly = state.isAdmin ? "" : "readonly";
    const greeting = state.isAdmin ? "Bem-vindo, Professor Domenico." : `Olá, ${state.profile.name.split(' ')[0]}.`;
    const subtitle = state.isAdmin ? "Gestão da Plataforma Ativa." : "Aqui está o resumo da sua semana.";

    let html = `
        <div class="fade-in">
            <h2>${greeting}</h2>
            <p style="margin-bottom: 30px;">${subtitle}</p>

            <div class="dashboard-card">
                <h3><i class="ph ph-clock"></i> Horários de Atendimento</h3>
                <table class="schedule-table">
                    <thead><tr><th>Dia da Semana</th><th>Disponibilidade / Local</th></tr></thead>
                    <tbody>
                        <tr><td>SEGUNDA</td><td><input class="schedule-input" id="sc-seg" value="${schedule.seg}" ${readOnly} placeholder="Indisponível"></td></tr>
                        <tr><td>QUARTA</td><td><input class="schedule-input" id="sc-qua" value="${schedule.qua}" ${readOnly} placeholder="Indisponível"></td></tr>
                        <tr><td>SEXTA</td><td><input class="schedule-input" id="sc-sex" value="${schedule.sex}" ${readOnly} placeholder="Indisponível"></td></tr>
                    </tbody>
                </table>
                ${state.isAdmin ? '<div style="text-align:right; margin-top:10px;"><button class="btn btn-primary" onclick="saveSchedule()" style="width:auto; padding:10px 20px; font-size:14px;">Salvar Alterações</button></div>' : ''}
            </div>
            
            ${state.isAdmin ? renderAdminWidgets() : renderStudentWidgets()}
        </div>
    `;
    el.app.content.innerHTML = html;
}

function renderAdminWidgets() {
    return `
        <div class="dashboard-card" style="background: #F0F8FF; border: 1px solid #007AFF;">
            <h3><i class="ph ph-crown"></i> Painel do Professor</h3>
            <p>Você tem acesso total ao sistema.</p>
            <div style="display:flex; gap:12px; margin-top:20px;">
                <button class="btn-primary" style="width:auto;" onclick="alert('Criar Turma: Em breve')">Nova Turma</button>
                <button class="btn-social" style="width:auto;" onclick="navigateTo('classes')">Gerenciar Materiais</button>
            </div>
        </div>
    `;
}

function renderStudentWidgets() {
    return `
        <div class="dashboard-card">
            <h3>Sua Turma: ${state.profile.classCode || "Não definida"}</h3>
            <p>Verifique o chat para avisos recentes.</p>
        </div>
    `;
}

window.saveSchedule = async function() {
    if(!state.isAdmin) return;
    const data = {
        seg: document.getElementById('sc-seg').value,
        qua: document.getElementById('sc-qua').value,
        sex: document.getElementById('sc-sex').value
    };
    await setDoc(doc(db, "config", "schedule"), data);
    alert("Horários atualizados!");
};

async function renderClasses() {
    el.app.content.innerHTML = `<h2 class="fade-in">Aulas e Materiais</h2><p>Carregando...</p>`;
    // Lógica simples: Admin vê tudo
    const q = state.isAdmin ? collection(db, "classes") : query(collection(db, "classes"), where("code", "==", state.profile.classCode || ""));
    
    try {
        const snap = await getDocs(q);
        let html = `<div class="fade-in"><h2>Aulas e Materiais</h2>`;
        if(snap.empty) html += `<div class="dashboard-card"><p>Nenhuma turma encontrada.</p></div>`;
        
        snap.forEach(doc => {
            const d = doc.data();
            html += `
                <div class="dashboard-card">
                    <h3>${d.name}</h3>
                    <p style="margin-bottom:10px">Código: <strong>${d.code}</strong></p>
                    <button class="btn-social" style="width:auto; border-radius:8px;" onclick="alert('PDFs em breve')">
                        <i class="ph ph-file-pdf"></i> Acessar Material
                    </button>
                </div>
            `;
        });
        el.app.content.innerHTML = html + "</div>";
    } catch(e) { el.app.content.innerHTML = "Erro ao buscar aulas."; }
}

let unsubChat;
function renderChat() {
    const sala = state.profile.classCode || "GERAL";
    el.app.content.innerHTML = `
        <div class="fade-in" style="height:100%; display:flex; flex-direction:column;">
            <h2 style="margin-bottom:10px;">Chat: ${sala}</h2>
            <div class="chat-container">
                <div id="chat-box" class="chat-messages"></div>
                <form id="chat-form" class="chat-input-area">
                    <input type="text" id="chat-msg" class="chat-input" placeholder="Digite sua mensagem..." autocomplete="off">
                    <button type="submit" class="btn-primary" style="width:40px; height:40px; border-radius:50%; padding:0;">
                        <i class="ph ph-paper-plane-right" style="font-size:18px;"></i>
                    </button>
                </form>
            </div>
        </div>
    `;

    const q = query(collection(db, `chats/${sala}/messages`), orderBy("createdAt", "asc"));
    if(unsubChat) unsubChat();
    
    unsubChat = onSnapshot(q, (snapshot) => {
        const box = document.getElementById('chat-box');
        if(!box) return;
        box.innerHTML = "";
        snapshot.forEach(d => {
            const msg = d.data();
            const isMe = msg.uid === state.user.uid;
            const div = document.createElement('div');
            div.className = `message ${isMe ? 'msg-mine' : 'msg-other'}`;
            // Se for professor, adiciona badge
            const senderName = msg.senderRole === 'admin' ? `Professor ${msg.senderName}` : msg.senderName;
            
            div.innerHTML = `
                <strong style="font-size:11px; opacity:0.7; display:block; margin-bottom:4px">${senderName}</strong>
                ${msg.text}
            `;
            box.appendChild(div);
        });
        box.scrollTop = box.scrollHeight;
    });

    document.getElementById('chat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const inp = document.getElementById('chat-msg');
        const text = inp.value.trim();
        if(!text) return;
        
        await addDoc(collection(db, `chats/${sala}/messages`), {
            text, 
            uid: state.user.uid,
            senderName: state.profile.name,
            senderRole: state.isAdmin ? 'admin' : 'student',
            createdAt: serverTimestamp()
        });
        inp.value = "";
    });
}

// --- LISTENERS ---
function setupListeners() {
    // Alternar Login/Cadastro
    el.auth.btnToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const isLogin = !el.auth.formLogin.classList.contains('hidden');
        el.auth.formLogin.classList.toggle('hidden', isLogin);
        el.auth.formRegister.classList.toggle('hidden', !isLogin);
        el.auth.title.textContent = isLogin ? "Nova Conta" : "Bem-vindo";
        el.auth.subtitle.textContent = isLogin ? "Preencha os dados abaixo." : "Sua plataforma completa de ensino.";
        el.auth.btnToggle.textContent = isLogin ? "Voltar ao Login" : "Cadastre-se";
    });

    // Login
    el.auth.formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        try { await signInWithEmailAndPassword(auth, email, pass); } 
        catch(e) { alert("Erro ao entrar: " + e.message); }
    });

    // Cadastro
    el.auth.formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-pass').value;
        const code = document.getElementById('reg-class-code').value;

        try {
            // Verificar turma (Descomente se já tiver turmas criadas)
            // const snap = await getDocs(query(collection(db, "classes"), where("code", "==", code)));
            // if(snap.empty) throw new Error("Código de turma inválido.");

            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            await setDoc(doc(db, "users", cred.user.uid), {
                name, email, role: 'aluno', classCode: code, uid: cred.user.uid
            });
        } catch(e) { alert(e.message); }
    });

    // Social
    el.auth.btnGoogle.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
    el.auth.btnApple.addEventListener('click', () => {
        const provider = new OAuthProvider('apple.com');
        signInWithPopup(auth, provider).catch(e => alert(e.message));
    });

    // Navegação
    el.app.mobileToggle.addEventListener('click', () => el.app.sidebar.classList.toggle('open'));
    el.app.btnLogout.addEventListener('click', () => signOut(auth));
    document.querySelectorAll('.nav-item').forEach(i => i.addEventListener('click', () => navigateTo(i.dataset.target)));
}

init();



