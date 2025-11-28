// --- CONFIGURAÇÃO FIREBASE (V9 Modular) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
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
    addDoc 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// SUAS CHAVES (Já preenchidas com base no seu arquivo anterior)
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

// --- ESTADO ---
const state = {
    user: null,
    profile: null,
    isAdmin: false
};

// --- ELEMENTOS UI ---
const el = {
    views: { auth: document.getElementById('auth-view'), app: document.getElementById('app-view') },
    auth: {
        formLogin: document.getElementById('login-form'),
        formRegister: document.getElementById('register-form'),
        btnToggle: document.getElementById('btn-toggle-auth'),
        title: document.getElementById('auth-title'),
        btnGoogle: document.getElementById('btn-google')
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
    // Monitorar Auth
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            state.user = user;
            await loadProfile(user.uid);
            el.views.auth.classList.remove('active');
            el.views.app.classList.add('active');
            navigateTo('home');
        } else {
            state.user = null;
            state.profile = null;
            el.views.app.classList.remove('active');
            el.views.auth.classList.add('active');
        }
    });
}

// --- LÓGICA DE DADOS ---
async function loadProfile(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            state.profile = docSnap.data();
            state.isAdmin = state.profile.role === 'admin';
        } else {
            // Se logar com Google e não tiver perfil, cria um básico
            state.profile = { 
                name: state.user.displayName || "Usuário", 
                role: 'aluno',
                email: state.user.email
            };
            if(state.user.email === 'domenico.suriale@ifpr.edu.br') {
                state.isAdmin = true; 
                state.profile.role = 'admin';
            }
        }
        updateUI();
    } catch (e) { console.error(e); }
}

function updateUI() {
    el.app.userName.textContent = state.profile.name.split(' ')[0];
    el.app.userRole.textContent = state.isAdmin ? "Professor" : "Aluno";
    el.app.userAvatar.textContent = state.profile.name[0].toUpperCase();
}

// --- ROTEAMENTO SIMPLES ---
window.navigateTo = function(page) {
    // Atualiza menu ativo
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const activeItem = document.querySelector(`[data-target="${page}"]`);
    if(activeItem) activeItem.classList.add('active');

    // Fecha menu mobile se aberto
    el.app.sidebar.classList.remove('open');

    // Renderiza Conteúdo
    const content = el.app.content;
    if (page === 'home') {
        content.innerHTML = `
            <h2>Olá, ${state.profile.name.split(' ')[0]}!</h2>
            <p style="color:var(--text-secondary); margin-bottom:20px">Resumo da sua semana.</p>
            
            ${state.isAdmin ? `
                <div class="dashboard-card" style="border-left: 5px solid var(--primary)">
                    <h3>Painel do Professor</h3>
                    <p>Você tem acesso administrativo.</p>
                    <button class="btn-primary" onclick="alert('Criar Turma (Exemplo)')" style="margin-top:10px; width:auto">
                        + Nova Turma
                    </button>
                </div>
            ` : ''}

            <div class="dashboard-card">
                <h3><i class="ph ph-clock"></i> Horários</h3>
                <p>Próxima aula: Português (3º Ano B) às 08:00.</p>
            </div>
        `;
    } else if (page === 'classes') {
        loadClassesView();
    } else if (page === 'chat') {
        content.innerHTML = `<h2>Comunidade</h2><div class="dashboard-card"><p>O chat da turma será carregado aqui.</p></div>`;
    }
};

async function loadClassesView() {
    el.app.content.innerHTML = `<h2>Turmas</h2><p>Carregando...</p>`;
    // Exemplo de busca (Admin vê todas, Aluno vê a sua)
    const q = state.isAdmin 
        ? collection(db, "classes")
        : query(collection(db, "classes"), where("code", "==", state.profile.classCode || ""));
    
    try {
        const snap = await getDocs(q);
        let html = `<h2>Turmas</h2>`;
        if(snap.empty) html += `<p>Nenhuma turma encontrada.</p>`;
        
        snap.forEach(doc => {
            const d = doc.data();
            html += `
                <div class="dashboard-card">
                    <h3>${d.name}</h3>
                    <p>Código: <strong>${d.code}</strong></p>
                </div>
            `;
        });
        el.app.content.innerHTML = html;
    } catch(e) {
        el.app.content.innerHTML = `<p>Erro ao carregar turmas: ${e.message}</p>`;
    }
}

// --- EVENTOS ---
function setupListeners() {
    // Toggle Login/Register
    el.auth.btnToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const isLogin = !el.auth.formLogin.classList.contains('hidden');
        if(isLogin) {
            el.auth.formLogin.classList.add('hidden');
            el.auth.formRegister.classList.remove('hidden');
            el.auth.title.textContent = "Criar Conta";
            el.auth.btnToggle.textContent = "Voltar para Login";
        } else {
            el.auth.formRegister.classList.add('hidden');
            el.auth.formLogin.classList.remove('hidden');
            el.auth.title.textContent = "Bem-vindo";
            el.auth.btnToggle.textContent = "Cadastre-se";
        }
    });

    // Login Submit
    el.auth.formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        try { await signInWithEmailAndPassword(auth, email, pass); } 
        catch (err) { alert("Erro no Login: " + err.message); }
    });

    // Register Submit
    el.auth.formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-pass').value;
        const code = document.getElementById('reg-class-code').value;

        try {
            // Validação de Turma (SE FOR O PRIMEIRO USO, COMENTE ESTE BLOCO IF)
            const q = query(collection(db, "classes"), where("code", "==", code));
            const snap = await getDocs(q);
            if (snap.empty) throw new Error("Código de turma inválido!"); 

            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(cred.user, { displayName: name });
            await setDoc(doc(db, "users", cred.user.uid), {
                name, email, role: 'aluno', classCode: code, uid: cred.user.uid
            });
            alert("Conta criada!");
        } catch (err) { alert("Erro: " + err.message); }
    });

    // Google
    el.auth.btnGoogle.addEventListener('click', async () => {
        try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) { console.error(e); }
    });

    // Logout
    el.app.btnLogout.addEventListener('click', () => signOut(auth));

    // Nav Links
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.target));
    });

    // Mobile Menu
    el.app.mobileToggle.addEventListener('click', () => el.app.sidebar.classList.toggle('open'));
}

init();



