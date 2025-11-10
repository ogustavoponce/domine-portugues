// js/render.js

// --- ÍCONES SVG (Reutilizáveis) ---
const ICONS = {
  turmas: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
  apostilas: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
  comunidade: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
  gestao: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
  config: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>'
};

export function renderAppShell(user) {
  // (O código da sidebar permanece o mesmo, só atualizamos os links abaixo)
  const navLinks = [
    { href: '#turmas', label: 'Minhas Turmas', icon: ICONS.turmas },
    { href: '#apostilas', label: 'Materiais & PDFs', icon: ICONS.apostilas },
    { href: '#comunidade', label: 'Comunidade', icon: ICONS.comunidade },
  ];

  // Se for Domenico (admin), adiciona o painel de gestão
  if (user.role === 'admin' || user.role === 'professor') {
    navLinks.unshift({ href: '#gestao', label: 'Painel do Professor', icon: ICONS.gestao });
  }

  navLinks.push({ href: '#config', label: 'Configurações', icon: ICONS.config });

  const nav = document.querySelector('.sidebar-nav');
  nav.innerHTML = navLinks.map(link => `
    <a href="${link.href}">
      ${link.icon}
      <span>${link.label}</span>
    </a>
  `).join('');

  document.querySelector('.sidebar-avatar').textContent = user.name.charAt(0).toUpperCase();
  document.querySelector('.user-name').textContent = user.name;
  document.querySelector('.user-role').textContent = user.role === 'admin' ? 'Professor Titular' : 'Aluno';
}

export function updateActiveLink(hash) {
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === hash);
  });
}

// --- PÁGINAS ---

export function renderTurmas(turmas, userRole) {
  const main = document.querySelector('.main-content');
  const title = userRole === 'admin' ? 'Todas as Turmas' : 'Minhas Turmas';
  
  let html = `<h2 class="main-header">${title}</h2><div style="display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">`;
  
  if (turmas.length === 0) {
    html += '<p>Nenhuma turma encontrada.</p>';
  } else {
    turmas.forEach(t => {
      html += `
        <div class="dp-card">
          <h3 class="dp-card-title">${t.name}</h3>
          <p style="color: var(--text-secondary); margin-bottom: 16px;">Código de acesso: <span class="dp-code-badge">${t.code}</span></p>
          <div style="display: flex; gap: 10px;">
             <span class="dp-code-badge">${t.alunos ? t.alunos.length : 0} alunos</span>
          </div>
        </div>
      `;
    });
  }
  html += '</div>';
  main.innerHTML = html;
}

export async function renderApostilas(turma, user, store) {
  const main = document.querySelector('.main-content');
  main.innerHTML = `<h2 class="main-header">Materiais: ${turma.name}</h2><div id="materiais-list">Carregando...</div>`;

  // Se for professor, botão de adicionar
  if (user.role === 'admin') {
     main.innerHTML += `
       <button class="btn-primary" style="margin-bottom: 24px;" onclick="alert('Funcionalidade de upload em breve!')">
         + Novo Material (PDF/Link)
       </button>
     `;
  }

  const materiais = await store.getMateriais(turma.id);
  const list = document.getElementById('materiais-list');
  
  if (materiais.length === 0) {
    list.innerHTML = '<div class="dp-card"><p>Nenhum material postado ainda.</p></div>';
    return;
  }

  list.innerHTML = materiais.map(m => `
    <div class="dp-card" style="display: flex; align-items: center; gap: 16px;">
      <div style="background: var(--accent-light); padding: 12px; border-radius: 12px; color: var(--accent);">
        ${ICONS.apostilas}
      </div>
      <div>
        <h4 style="margin: 0 0 4px 0; font-weight: 600;">${m.titulo}</h4>
        <a href="${m.conteudo}" target="_blank" style="color: var(--accent); text-decoration: none; font-size: 0.9rem;">Abrir Material &rarr;</a>
      </div>
    </div>
  `).join('');
}

export function renderComunidade(turma, user, store) {
  const main = document.querySelector('.main-content');
  // Layout estilo WhatsApp Web
  main.innerHTML = `
    <div style="height: calc(100vh - 140px); display: flex; flex-direction: column; background: #fff; border-radius: 16px; border: 1px solid var(--border); overflow: hidden;">
      <div style="padding: 16px; background: var(--bg-base); border-bottom: 1px solid var(--border); font-weight: 600;">
        💬 Chat da Turma: ${turma.name}
      </div>
      
      <div id="chat-messages" style="flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;">
        <!-- Mensagens aqui -->
      </div>

      <form id="chat-form" style="padding: 16px; background: var(--bg-base); border-top: 1px solid var(--border); display: flex; gap: 10px;">
        <input type="text" id="chat-input" placeholder="Digite sua mensagem..." style="flex: 1; padding: 12px; border-radius: 99px; border: 1px solid var(--border); outline: none;" required>
        <button type="submit" class="btn-primary" style="width: auto; padding: 0 24px;">Enviar</button>
      </form>
    </div>
  `;

  const chatBox = document.getElementById('chat-messages');
  // Inscreve para receber mensagens em tempo real
  store.subscribeToChat(turma.id, (mensagens) => {
    chatBox.innerHTML = mensagens.map(msg => {
      const isMe = msg.userId === user.uid;
      return `
        <div style="align-self: ${isMe ? 'flex-end' : 'flex-start'}; max-width: 70%;">
          <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px; ${isMe ? 'text-align: right;' : ''}">
            ${isMe ? 'Você' : msg.userName}
          </div>
          <div style="padding: 10px 16px; border-radius: 16px; background: ${isMe ? 'var(--accent)' : 'var(--bg-base)'}; color: ${isMe ? '#fff' : 'var(--text-primary)'};">
            ${msg.text}
          </div>
        </div>
      `;
    }).join('');
    chatBox.scrollTop = chatBox.scrollHeight; // Rola para o fim
  });

  document.getElementById('chat-form').onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text) {
      await store.sendChatMessage(turma.id, user, text);
      input.value = '';
    }
  };
}

export function renderGestao(user, store) {
  const main = document.querySelector('.main-content');
  main.innerHTML = `
    <h2 class="main-header">Painel do Professor</h2>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px;">
      <div class="dp-card" style="text-align: center; cursor: pointer;" onclick="alert('Em breve: Criar nova turma')">
        <div style="font-size: 2rem; color: var(--accent); margin-bottom: 10px;">+</div>
        <h3>Criar Nova Turma</h3>
      </div>
      <div class="dp-card" style="text-align: center; cursor: pointer;" onclick="alert('Em breve: Gerenciar Alunos')">
        <div style="font-size: 2rem; color: var(--success); margin-bottom: 10px;">👥</div>
        <h3>Gerenciar Alunos</h3>
      </div>
    </div>
    <!-- Aqui viria a lista de todas as turmas para gerenciamento -->
  `;
}

export function renderConfig(user) {
   document.querySelector('.main-content').innerHTML = '<h2 class="main-header">Configurações</h2><div class="dp-card"><p>Em construção...</p></div>';
}
export function renderNotFound() {
   document.querySelector('.main-content').innerHTML = '<h2>404</h2>';
}
export function renderAccessDenied() {
   document.querySelector('.main-content').innerHTML = '<h2>Acesso Negado</h2>';
}
export function renderPlaceholder(title, msg) {
  document.querySelector('.main-content').innerHTML = `<h2 class="main-header">${title}</h2><div class="dp-card"><p>${msg}</p></div>`;
}