import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    updateDoc, 
    arrayUnion, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

// Estado Global
let currentUser = null;
let userProfile = null;

// --- UI CONTROLLER ---
const UI = {
    authContainer: document.getElementById('auth-container'),
    appContainer: document.getElementById('app-container'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    loginView: document.getElementById('loginView'),
    registerView: document.getElementById('registerView'),
    mainContent: document.getElementById('mainContent'),
    sidebarNav: document.getElementById('sidebarNav'),
    
    showLoading: () => UI.loadingOverlay.classList.remove('hidden'),
    hideLoading: () => UI.loadingOverlay.classList.add('hidden'),
    
    showAuth: () => {
        UI.appContainer.classList.add('hidden');
        UI.authContainer.classList.remove('hidden');
        UI.showLogin(); // Padrão
    },
    
    showApp: () => {
        UI.authContainer.classList.add('hidden');
        UI.appContainer.classList.remove('hidden');
    },
    
    showLogin: () => {
        UI.registerView.classList.add('hidden');
        UI.loginView.classList.remove('hidden');
    },
    
    showRegister: () => {
        UI.loginView.classList.add('hidden');
        UI.registerView.classList.remove('hidden');
    }
};

// Exportar para o HTML usar no onclick
window.app = UI; 
window.app.logout = () => signOut(auth);

// --- AUTENTICAÇÃO & INICIALIZAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        UI.showLoading();
        currentUser = user;
        // Carrega perfil estendido (role, turmas, etc)
        userProfile = await loadUserProfile(user.uid);
        
        if (!userProfile) {
            // Se logou com Google pela 1ª vez e não tem perfil
            // Cria perfil de aluno sem turma por enquanto.
            userProfile = await createUserProfile(user.uid, user.displayName, user.email, 'aluno');
        }
        
        setupSidebar(userProfile);
        loadRoute('home'); // Página inicial
        UI.showApp();
        UI.hideLoading();
    } else {
        currentUser = null;
        userProfile = null;
        UI.showAuth();
        UI.hideLoading();
    }
});

// --- FUNÇÕES DE DADOS (FIRESTORE) ---
async function loadUserProfile(uid) {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
}

async function createUserProfile(uid, name, email, role, turmaId = null) {
    // REGRA DO DOMENICO: Se for o email dele, vira ADMIN/PROFESSOR
    if(email === 'domenico.suriale@ifpr.edu.br') role = 'admin';

    const data = {
        uid, name, email, role,
        turmas: turmaId ? [turmaId] : [],
        createdAt: serverTimestamp()
    };
    await setDoc(doc(db, "users", uid), data);
    
    // Se tiver turma, adiciona o aluno nela
    if (turmaId) {
        await updateDoc(doc(db, "turmas", turmaId), {
            alunos: arrayUnion(uid)
        });
    }
    return data;
}

async function findTurmaByCode(code) {
    const q = query(collection(db, "turmas"), where("code", "==", code));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    const docData = querySnapshot.docs[0];
    return { id: docData.id, ...docData.data() };
}

// --- RENDERIZAÇÃO DE PÁGINAS ---
function setupSidebar(profile) {
    // Atualiza info do usuário no rodapé
    document.getElementById('userNameDisplay').textContent = profile.name;
    document.getElementById('userRoleDisplay').textContent = profile.role === 'admin' ? 'Professor / Gestor' : 'Aluno';
    document.getElementById('userAvatar').textContent = profile.name.charAt(0).toUpperCase();

    let links = '';
    
    // Links Comuns
    links += `<a onclick="window.loadRoute('home')" class="nav-item active"><i class="fas fa-home"></i> Início</a>`;
    
    if (profile.role === 'admin') {
        // Links do Professor Domenico
        links += `
            <div style="padding: 10px 20px; font-size: 0.8rem; color: #aaa; text-transform: uppercase; margin-top: 10px;">Gestão</div>
            <a onclick="window.loadRoute('admin-turmas')" class="nav-item"><i class="fas fa-chalkboard-teacher"></i> Gerenciar Turmas</a>
            <a onclick="window.loadRoute('admin-alunos')" class="nav-item"><i class="fas fa-users"></i> Alunos</a>
            <a onclick="window.loadRoute('admin-conteudo')" class="nav-item"><i class="fas fa-file-upload"></i> Publicar Material</a>
        `;
    } else {
        // Links do Aluno
        links += `
            <div style="padding: 10px 20px; font-size: 0.8rem; color: #aaa; text-transform: uppercase; margin-top: 10px;">Estudos</div>
            <a onclick="window.loadRoute('minhas-turmas')" class="nav-item"><i class="fas fa-book"></i> Minhas Turmas</a>
            <a onclick="window.loadRoute('materiais')" class="nav-item"><i class="fas fa-file-pdf"></i> Apostilas & PDFs</a>
        `;
    }
    
    links += `
        <div style="padding: 10px 20px; font-size: 0.8rem; color: #aaa; text-transform: uppercase; margin-top: 10px;">Social</div>
        <a onclick="window.loadRoute('comunidade')" class="nav-item"><i class="fas fa-comments"></i> Comunidade</a>
    `;

    UI.sidebarNav.innerHTML = links;
}

// Sistema de Roteamento Simples
window.loadRoute = async (route) => {
    UI.showLoading();
    
    // Atualiza classe active na sidebar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // (Em uma implementação real, marcaríamos o item clicado como active aqui)

    let content = '';

    switch (route) {
        case 'home':
            content = renderHomePage();
            break;
        case 'minhas-turmas':
            content = await renderStudentTurmas();
            break;
        case 'admin-turmas':
            content = await renderAdminTurmas();
            break;
        default:
            content = `<h2>Em construção</h2><p>A página ${route} será implementada em breve.</p>`;
    }

    UI.mainContent.innerHTML = content;
    UI.hideLoading();
    
    // Fecha sidebar em mobile ao navegar
    if(window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
};

// --- PÁGINAS HTML (Render Functions) ---

function renderHomePage() {
    const isProf = userProfile.role === 'admin';
    return `
        <h2 class="page-title">Painel de Controle</h2>
        <div class="card-grid">
            <div class="card">
                <h3><i class="fas ${isProf ? 'fa-chalkboard' : 'fa-user-graduate'}"></i> ${isProf ? 'Minhas Turmas' : 'Meus Estudos'}</h3>
                <p>${isProf ? 'Gerencie suas turmas e alunos.' : 'Veja seu progresso e notas.'}</p>
                <div class="card-meta"><span class="badge badge-info">Ativo</span></div>
            </div>
            <div class="card">
                <h3><i class="fas fa-bullhorn"></i> Avisos</h3>
                <p>Nenhum aviso importante no momento.</p>
            </div>
        </div>
    `;
}

async function renderStudentTurmas() {
    const q = query(collection(db, "turmas"), where("alunos", "array-contains", currentUser.uid));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        return `
            <h2 class="page-title">Minhas Turmas</h2>
            <div class="card">
                <p>Você ainda não está matriculado em nenhuma turma.</p>
                <button class="btn btn-primary" onclick="alert('Fale com o professor para pegar o código!')">Entrar em uma turma</button>
            </div>
        `;
    }

    let html = `<h2 class="page-title">Minhas Turmas</h2><div class="card-grid">`;
    snapshot.forEach(doc => {
        const t = doc.data();
        html += `
            <div class="card">
                <h3>${t.name}</h3>
                <p>Código: <strong>${t.code}</strong></p>
                <button class="btn btn-outline w-full">Acessar Sala</button>
            </div>
        `;
    });
    html += `</div>`;
    return html;
}

async function renderAdminTurmas() {
    const snapshot = await getDocs(collection(db, "turmas"));
    
    let html = `
        <div class="flex justify-between items-center mb-4">
            <h2 class="page-title" style="margin-bottom:0; border:none;">Gestão de Turmas</h2>
            <button class="btn btn-primary" onclick="createTurmaPrompt()">+ Nova Turma</button>
        </div>
        <div class="card-grid">
    `;
    
    snapshot.forEach(doc => {
        const t = doc.data();
        html += `
            <div class="card">
                <h3>${t.name}</h3>
                <p>Código: <strong>${t.code}</strong></p>
                <p class="text-sm text-light">${t.alunos ? t.alunos.length : 0} Alunos</p>
                <div class="flex gap-2 mt-4">
                    <button class="btn btn-outline w-full">Gerenciar</button>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    return html;
}

// --- FUNÇÕES DE AÇÃO ---

// Criar Turma (Admin)
window.createTurmaPrompt = async () => {
    const nome = prompt("Nome da Turma:");
    const codigo = prompt("Código de Acesso (ex: INFO2025):");
    
    if (nome && codigo) {
        try {
            await addDoc(collection(db, "turmas"), {
                name: nome,
                code: codigo,
                alunos: [],
                createdAt: serverTimestamp()
            });
            alert("Turma criada com sucesso!");
            window.loadRoute('admin-turmas'); // Recarrega
        } catch (e) {
            alert("Erro ao criar turma: " + e.message);
        }
    }
};

// Listeners de Formulário
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.showLoading();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        alert("Erro no login: " + error.message);
        UI.hideLoading();
    }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.showLoading();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPassword').value;
    const code = document.getElementById('regCode').value;

    try {
        // 1. Verifica se a turma existe
        const turma = await findTurmaByCode(code);
        if (!turma) throw new Error("Código de turma inválido!");

        // 2. Cria usuário no Auth
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        
        // 3. Cria perfil e vincula
        await createUserProfile(cred.user.uid, name, email, 'aluno', turma.id);
        
        alert("Conta criada com sucesso!");
        // O listener do onAuthStateChanged vai lidar com o login automático
    } catch (error) {
        alert("Erro no cadastro: " + error.message);
        UI.hideLoading();
    }
});

document.getElementById('googleLoginBtn').addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
        alert("Erro no Google Login: " + error.message);
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth);
});



