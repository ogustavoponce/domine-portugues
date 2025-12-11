// --- 1. IMPORTAÇÕES E CONFIGURAÇÃO (FIREBASE MODULAR) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword, 
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

const firebaseConfig = {
    apiKey: "AIzaSyCCiWKDMJ9LkBa_9OLauUNFJ9_TPC60h4o",
    authDomain: "domine-portugues.firebaseapp.com",
    projectId: "domine-portugues",
    storageBucket: "domine-portugues.firebasestorage.app",
    messagingSenderId: "717323019793",
    appId: "1:717323019793:web:46c0baaae240b17dbdf3b0",
    measurementId: "G-WXQNKS0VY7"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 2. GERENCIAMENTO DE ESTADO E SEGURANÇA ---

const STATE = {
    currentUser: null,
    userProfile: null,
    activeListeners: [], // Array para guardar os "unsubscribe" e limpar memória
    isLoading: false
};

const ADMIN_EMAILS = [
    "domenico.suriale@ifpr.edu.br", 
    "domenico@domineportugues.com.br", 
    "admin@teste.com"
];

// Elementos Globais
const DOM = {
    authScreen: document.getElementById('auth-screen'),
    appScreen: document.getElementById('app-screen'),
    contentArea: document.getElementById('content-area'),
    pageTitle: document.getElementById('page-title'),
    userNameDisplay: document.getElementById('user-name-display'), // Verifique se existe no HTML ou remova
    loginForm: document.getElementById('login-form'),
    btnGoogle: document.getElementById('btn-google'),
    btnLogout: document.getElementById('btn-logout'),
    navItems: document.querySelectorAll('.nav-item[data-view]')
};

// --- 3. UTILITÁRIOS DE ROBUSTEZ (UI & SANITIZAÇÃO) ---

// Sanitização contra XSS (Segurança Crítica para o Chat)
function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
}

// Sistema de Notificações (Toast)
function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    // Ícones baseados no tipo
    const icon = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
    toast.innerHTML = `<span class="material-icons-round">${icon}</span> ${message}`;
    
    container.appendChild(toast);

    // Remove após 4 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Loader Global
function toggleLoader(show) {
    STATE.isLoading = show;
    let loader = document.getElementById('global-loader');
    if (show) {
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'global-loader';
            loader.className = 'loader-overlay';
            loader.innerHTML = '<div class="spinner"></div>';
            document.body.appendChild(loader);
        }
        loader.classList.remove('hidden');
    } else {
        if (loader) loader.classList.add('hidden');
    }
}

// Limpeza de Memória (Remove Listeners antigos ao trocar de tela)
function clearListeners() {
    STATE.activeListeners.forEach(unsubscribe => unsubscribe());
    STATE.activeListeners = [];
}

// --- 4. LÓGICA DE AUTENTICAÇÃO ---

// Login Google
DOM.btnGoogle.addEventListener('click', async () => {
    toggleLoader(true);
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        await ensureUserDocument(result.user);
        showToast(`Bem-vindo, ${result.user.displayName}!`, 'success');
    } catch (error) {
        console.error(error);
        showToast(translateError(error.code), 'error');
    } finally {
        toggleLoader(false);
    }
});

// Login Email/Senha
DOM.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    
    if(!email || !pass) return showToast("Preencha todos os campos.", 'error');

    toggleLoader(true);
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // O onAuthStateChanged vai lidar com o redirecionamento
    } catch (error) {
        showToast(translateError(error.code), 'error');
        toggleLoader(false);
    }
});

DOM.btnLogout.addEventListener('click', () => {
    clearListeners();
    signOut(auth);
    showToast("Você saiu do sistema.", 'info');
});

// Garante integridade do banco de dados
async function ensureUserDocument(user) {
    const userRef = doc(db, "users", user.uid);
    
    try {
        const snap = await getDoc(userRef);
        let role = 'student';
        
        // Verifica Admin Hardcoded
        if (ADMIN_EMAILS.includes(user.email)) role = 'admin';

        if (!snap.exists()) {
            // Cria usuário novo
            await setDoc(userRef, {
                uid: user.uid,
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                role: role,
                classId: null,
                createdAt: serverTimestamp()
            });
        } else {
            // Atualiza role se virou admin depois
            if (role === 'admin' && snap.data().role !== 'admin') {
                await updateDoc(userRef, { role: 'admin' });
            }
        }
    } catch (error) {
        console.error("Erro ao criar perfil:", error);
        throw new Error("Falha ao configurar perfil do usuário.");
    }
}

// Tradutor de Erros do Firebase
function translateError(code) {
    switch (code) {
        case 'auth/user-not-found': return "Usuário não encontrado.";
        case 'auth/wrong-password': return "Senha incorreta.";
        case 'auth/invalid-email': return "E-mail inválido.";
        case 'auth/email-already-in-use': return "E-mail já cadastrado.";
        default: return "Ocorreu um erro. Tente novamente.";
    }
}

// --- 5. ROTEAMENTO E NAVEGAÇÃO ---

// O Grande Observador
onAuthStateChanged(auth, async (user) => {
    if (user) {
        toggleLoader(true);
        try {
            await ensureUserDocument(user);
            // Carrega perfil atualizado
            const snap = await getDoc(doc(db, "users", user.uid));
            STATE.currentUser = user;
            STATE.userProfile = snap.data();

            // Atualiza UI base
            DOM.authScreen.classList.add('hidden');
            DOM.appScreen.classList.remove('hidden');
            
            // Controle de Menu Admin
            document.querySelectorAll('.admin-only').forEach(el => {
                if (STATE.userProfile.role !== 'admin') el.classList.add('hidden');
                else el.classList.remove('hidden');
            });

            loadView('dashboard');
        } catch (error) {
            showToast("Erro crítico ao carregar perfil.", 'error');
            signOut(auth);
        } finally {
            toggleLoader(false);
        }
    } else {
        STATE.currentUser = null;
        STATE.userProfile = null;
        DOM.appScreen.classList.add('hidden');
        DOM.authScreen.classList.remove('hidden');
        clearListeners();
    }
});

// Navegação Lateral
DOM.navItems.forEach(btn => {
    btn.addEventListener('click', () => {
        // UI Update
        DOM.navItems.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Logic Update
        loadView(btn.dataset.view);
    });
});

function loadView(viewName) {
    clearListeners(); // Mata processos da tela anterior
    DOM.contentArea.innerHTML = ''; // Limpa tela
    toggleLoader(true);

    // Pequeno delay para suavidade da UI
    setTimeout(() => {
        switch(viewName) {
            case 'dashboard': renderDashboard(); break;
            case 'classroom': renderClassroom(); break;
            case 'admin-classes': 
                if(isAdmin()) renderAdminClasses(); 
                else denyAccess();
                break;
            case 'admin-students': 
                if(isAdmin()) renderAdminStudents(); 
                else denyAccess();
                break;
            case 'profile': renderProfile(); break;
            default: renderDashboard();
        }
        toggleLoader(false);
    }, 300);
}

function isAdmin() {
    return STATE.userProfile && STATE.userProfile.role === 'admin';
}

function denyAccess() {
    DOM.contentArea.innerHTML = `<div class="alert error">Acesso Negado. Você não tem permissão.</div>`;
}

// --- 6. RENDERIZAÇÃO DE TELAS (LÓGICA CORE) ---

// === DASHBOARD ===
async function renderDashboard() {
    DOM.pageTitle.innerText = "Visão Geral";
    
    // HTML Estrutural
    const container = document.createElement('div');
    container.innerHTML = `
        <div class="card">
            <h3>Bem-vindo, ${escapeHTML(STATE.userProfile.name)}</h3>
            <p style="color:var(--text-secondary)">Acompanhe abaixo os horários de atendimento.</p>
        </div>
        
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3>Horário de Atendimento</h3>
                ${isAdmin() ? '<button id="save-schedule" class="btn btn-primary" style="width:auto; padding:8px 16px;">Salvar Alterações</button>' : ''}
            </div>
            <div id="schedule-grid" class="schedule-grid">
                </div>
        </div>
    `;
    DOM.contentArea.appendChild(container);

    // Carregar Dados
    const scheduleRef = doc(db, "config", "schedule");
    let scheduleData = { seg:"", ter:"", qua:"", qui:"", sex:"" };

    try {
        const snap = await getDoc(scheduleRef);
        if (snap.exists()) scheduleData = snap.data();
    } catch (e) { console.warn("Config não iniciada"); }

    const days = { seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta' };
    const grid = document.getElementById('schedule-grid');

    Object.keys(days).forEach(key => {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-card';
        const val = escapeHTML(scheduleData[key] || "10h - 12h");
        
        if (isAdmin()) {
            dayDiv.innerHTML = `
                <span class="day-title">${days[key]}</span>
                <input type="text" id="sched-${key}" value="${val}" placeholder="Ex: 10:00 - 12:00">
            `;
        } else {
            dayDiv.innerHTML = `
                <span class="day-title">${days[key]}</span>
                <span style="font-weight:600; font-size:1.1rem;">${val}</span>
            `;
        }
        grid.appendChild(dayDiv);
    });

    if (isAdmin()) {
        document.getElementById('save-schedule').addEventListener('click', async () => {
            toggleLoader(true);
            const newData = {};
            Object.keys(days).forEach(key => {
                newData[key] = document.getElementById(`sched-${key}`).value;
            });
            try {
                await setDoc(scheduleRef, newData);
                showToast("Horários atualizados com sucesso!", "success");
            } catch (e) {
                showToast("Erro ao salvar.", "error");
            } finally {
                toggleLoader(false);
            }
        });
    }
}

// === SALA DE AULA & CHAT ===
async function renderClassroom() {
    DOM.pageTitle.innerText = "Minha Sala";

    if (!STATE.userProfile.classId) {
        DOM.contentArea.innerHTML = `
            <div class="card" style="text-align:center; padding:3rem;">
                <span class="material-icons-round" style="font-size:48px; color:var(--text-secondary)">school</span>
                <h3>Você não está matriculado</h3>
                <p>Vá até o menu <strong>Perfil</strong> e insira o código da sua turma.</p>
            </div>`;
        return;
    }

    const classRef = doc(db, "classes", STATE.userProfile.classId);
    const classSnap = await getDoc(classRef);
    
    if(!classSnap.exists()) {
        DOM.contentArea.innerHTML = `<div class="alert error">Erro: A turma vinculada não existe mais. Contate o professor.</div>`;
        return;
    }
    const classData = classSnap.data();

    // Layout Grid
    DOM.contentArea.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
            
            <div class="chat-wrapper">
                <div class="card" style="margin-bottom:1rem; padding:1rem;">
                    <h3 style="margin:0">Chat: ${escapeHTML(classData.name)}</h3>
                </div>
                <div class="chat-container">
                    <div id="chat-messages" class="chat-messages">Carregando mensagens...</div>
                    <form id="chat-form" class="chat-input-area">
                        <input type="text" id="chat-input" placeholder="Digite sua mensagem..." autocomplete="off">
                        <button type="submit" class="btn btn-primary" style="width:auto; border-radius:50%; width:48px; height:48px; padding:0;">
                            <span class="material-icons-round">send</span>
                        </button>
                    </form>
                </div>
            </div>

            <div class="posts-wrapper">
                ${isAdmin() ? `<div class="card"><button id="btn-create-post" class="btn btn-primary">+ Novo Aviso</button></div>` : ''}
                <div id="posts-feed"></div>
            </div>
        </div>
    `;

    // --- LÓGICA DO CHAT (TEMPO REAL) ---
    const messagesRef = collection(db, "classes", STATE.userProfile.classId, "messages");
    const qChat = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubChat = onSnapshot(qChat, (snapshot) => {
        const chatDiv = document.getElementById('chat-messages');
        if(!chatDiv) return;
        
        chatDiv.innerHTML = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.uid === STATE.currentUser.uid;
            
            const msgEl = document.createElement('div');
            msgEl.className = `message ${isMe ? 'msg-mine' : 'msg-other'}`;
            // Sanitização AQUI:
            msgEl.innerHTML = `
                <span class="msg-author">${escapeHTML(msg.name)}</span>
                ${escapeHTML(msg.text)}
            `;
            chatDiv.appendChild(msgEl);
        });
        chatDiv.scrollTop = chatDiv.scrollHeight; // Auto-scroll
    });
    STATE.activeListeners.push(unsubChat);

    // Envio de Mensagem
    document.getElementById('chat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if(!text) return;

        input.value = ''; // Limpa rápido para UX
        try {
            await addDoc(messagesRef, {
                text: text, // Será sanitizado na leitura
                uid: STATE.currentUser.uid,
                name: STATE.userProfile.name,
                createdAt: serverTimestamp()
            });
        } catch (err) {
            showToast("Erro ao enviar mensagem", "error");
        }
    });

    // --- LÓGICA DE POSTS (TEMPO REAL) ---
    const postsRef = collection(db, "classes", STATE.userProfile.classId, "posts");
    const qPosts = query(postsRef, orderBy("createdAt", "desc"));

    const unsubPosts = onSnapshot(qPosts, (snapshot) => {
        const feed = document.getElementById('posts-feed');
        if(!feed) return;
        feed.innerHTML = '';
        
        if (snapshot.empty) {
            feed.innerHTML = '<div class="card" style="text-align:center; color:var(--text-secondary)">Nenhum aviso publicado.</div>';
            return;
        }

        snapshot.forEach(doc => {
            const p = doc.data();
            const postEl = document.createElement('div');
            postEl.className = 'card';
            postEl.innerHTML = `
                <h3 style="color:var(--primary)">${escapeHTML(p.title)}</h3>
                <p style="white-space: pre-wrap;">${escapeHTML(p.content)}</p>
                ${p.link ? `<a href="${escapeHTML(p.link)}" target="_blank" class="btn btn-google" style="margin-top:1rem; width:auto; display:inline-flex;">🔗 Acessar Material</a>` : ''}
            `;
            feed.appendChild(postEl);
        });
    });
    STATE.activeListeners.push(unsubPosts);

    if(isAdmin()) {
        document.getElementById('btn-create-post').addEventListener('click', async () => {
            const title = prompt("Título do Aviso:");
            if(!title) return;
            const content = prompt("Conteúdo do Texto:");
            const link = prompt("Link (opcional):");

            try {
                await addDoc(postsRef, {
                    title, content, link, createdAt: serverTimestamp()
                });
                showToast("Aviso publicado!", "success");
            } catch(e) { showToast("Erro ao publicar", "error"); }
        });
    }
}

// === ADMIN: GESTÃO DE TURMAS ===
async function renderAdminClasses() {
    DOM.pageTitle.innerText = "Gestão de Turmas";
    
    DOM.contentArea.innerHTML = `
        <div class="card">
            <button id="btn-new-class" class="btn btn-primary" style="width:auto;">+ Nova Turma</button>
        </div>
        <div id="classes-list" style="display:grid; gap:1rem;">Carregando...</div>
    `;

    document.getElementById('btn-new-class').addEventListener('click', async () => {
        const name = prompt("Nome da Turma (Ex: 3º Ano A):");
        if(!name) return;
        const code = prompt("Código ÚNICO de acesso (Ex: PORT3A):").toUpperCase();
        if(!code) return;

        // Verifica duplicidade de código
        const checkQ = query(collection(db, "classes"), where("code", "==", code));
        const checkSnap = await getDocs(checkQ);
        if (!checkSnap.empty) return showToast("Este código já existe!", "error");

        try {
            await addDoc(collection(db, "classes"), { name, code });
            showToast("Turma criada!", "success");
            renderAdminClasses(); // Recarrega
        } catch(e) { showToast("Erro ao criar turma", "error"); }
    });

    const snap = await getDocs(collection(db, "classes"));
    const list = document.getElementById('classes-list');
    list.innerHTML = '';
    
    snap.forEach(d => {
        const t = d.data();
        const el = document.createElement('div');
        el.className = 'card';
        el.style.display = 'flex';
        el.style.justifyContent = 'space-between';
        el.style.alignItems = 'center';
        el.innerHTML = `
            <div>
                <strong style="font-size:1.2rem">${escapeHTML(t.name)}</strong>
                <div class="badge" style="margin-top:5px; display:inline-block;">${escapeHTML(t.code)}</div>
            </div>
            <button class="btn" style="background:var(--danger); color:white; width:auto;" onclick="window.deleteClass('${d.id}')">Excluir</button>
        `;
        list.appendChild(el);
    });

    // Função Global para o onclick funcionar
    window.deleteClass = async (id) => {
        if(confirm("ATENÇÃO: Isso apagará todo o histórico do chat desta turma. Continuar?")) {
            try {
                await deleteDoc(doc(db, "classes", id));
                showToast("Turma excluída.", "success");
                renderAdminClasses();
            } catch(e) { showToast("Erro ao excluir.", "error"); }
        }
    };
}

// === ADMIN: GESTÃO DE ALUNOS ===
async function renderAdminStudents() {
    DOM.pageTitle.innerText = "Alunos Cadastrados";
    
    DOM.contentArea.innerHTML = `
        <div class="card" style="overflow-x:auto;">
            <table>
                <thead>
                    <tr>
                        <th>Aluno</th>
                        <th>Email</th>
                        <th>Turma</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody id="students-table-body"></tbody>
            </table>
        </div>
    `;

    toggleLoader(true);
    // Busca dados em paralelo para performance
    const [studentsSnap, classesSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "==", "student"))),
        getDocs(collection(db, "classes"))
    ]);

    const classesMap = {};
    let classesOptions = `<option value="">Sem Turma</option>`;
    
    classesSnap.forEach(c => {
        const data = c.data();
        classesMap[c.id] = data.name;
        classesOptions += `<option value="${c.id}">${escapeHTML(data.name)}</option>`;
    });

    const tbody = document.getElementById('students-table-body');
    
    if (studentsSnap.empty) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Nenhum aluno encontrado.</td></tr>';
        toggleLoader(false);
        return;
    }

    studentsSnap.forEach(u => {
        const user = u.data();
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td><strong>${escapeHTML(user.name)}</strong></td>
            <td>${escapeHTML(user.email)}</td>
            <td>
                <select class="class-selector" data-uid="${u.id}" style="padding:8px; border-radius:8px;">
                    ${classesOptions}
                </select>
            </td>
            <td>
                <button class="btn" style="background:var(--danger); color:white; width:auto; padding:8px;" onclick="window.banUser('${u.id}')">
                    Banir
                </button>
            </td>
        `;
        
        // Seta o valor correto do select
        const select = tr.querySelector('select');
        if (user.classId) select.value = user.classId;
        
        // Evento de mudança
        select.addEventListener('change', async (e) => {
            const newClass = e.target.value;
            try {
                await updateDoc(doc(db, "users", u.id), { classId: newClass || null });
                showToast("Turma do aluno atualizada!", "success");
            } catch(err) {
                showToast("Erro ao mover aluno", "error");
            }
        });

        tbody.appendChild(tr);
    });
    toggleLoader(false);

    window.banUser = async (uid) => {
        if(confirm("Tem certeza que deseja bloquear o acesso deste aluno?")) {
            await updateDoc(doc(db, "users", uid), { role: 'banned' });
            showToast("Aluno banido.", "info");
            renderAdminStudents();
        }
    };
}

// === PERFIL DO USUÁRIO ===
async function renderProfile() {
    DOM.pageTitle.innerText = "Meu Perfil";
    
    DOM.contentArea.innerHTML = `
        <div class="card" style="max-width:500px; margin:0 auto;">
            <div class="input-group">
                <label style="display:block; margin-bottom:5px; color:var(--text-secondary)">Nome de Exibição</label>
                <input type="text" id="profile-name" value="${escapeHTML(STATE.userProfile.name)}">
            </div>
            
            <div class="input-group">
                <label style="display:block; margin-bottom:5px; color:var(--text-secondary)">Matrícula na Turma (Código)</label>
                <input type="text" id="profile-code" placeholder="Insira o código dado pelo professor" style="text-transform:uppercase;">
            </div>

            <button id="btn-save-profile" class="btn btn-primary">Salvar Perfil</button>
        </div>
    `;

    document.getElementById('btn-save-profile').addEventListener('click', async () => {
        const newName = document.getElementById('profile-name').value.trim();
        const code = document.getElementById('profile-code').value.trim().toUpperCase();
        
        if(!newName) return showToast("Nome não pode ser vazio", "error");

        toggleLoader(true);
        const updates = { name: newName };

        try {
            if (code) {
                // Busca ID da turma pelo código
                const q = query(collection(db, "classes"), where("code", "==", code));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    updates.classId = querySnapshot.docs[0].id;
                    showToast(`Você entrou na turma: ${querySnapshot.docs[0].data().name}`, "success");
                } else {
                    throw new Error("Código de turma inválido!");
                }
            }

            await updateDoc(doc(db, "users", STATE.currentUser.uid), updates);
            // Atualiza estado local
            STATE.userProfile = { ...STATE.userProfile, ...updates };
            showToast("Perfil atualizado com sucesso!", "success");
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            toggleLoader(false);
        }
    });
}