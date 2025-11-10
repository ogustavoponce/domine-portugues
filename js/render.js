// js/render.js

/**
 * Renderiza os links de navegação com ícones e preenche o perfil
 */
export function renderAppShell(user) {
  const nav = document.querySelector('.sidebar-nav');
  if (!nav) return;

  // 1. Renderiza os links de navegação com ÍCONES
  const links = getNavLinks(user.role);
  nav.innerHTML = ''; // Limpa links antigos
  links.forEach(link => {
    nav.innerHTML += `
      <a href="${link.href}">
        ${link.icon}
        <span>${link.label}</span>
      </a>
    `;
  });

  // 2. Preenche o perfil do usuário
  const avatar = document.querySelector('.sidebar-avatar');
  const userName = document.querySelector('.user-name');
  const userRole = document.querySelector('.user-role');

  if (avatar) avatar.textContent = user.name.charAt(0).toUpperCase();
  if (userName) userName.textContent = user.name;
  if (userRole) userRole.textContent = user.role === 'professor' ? 'Professor' : 'Aluno';
}

/**
 * Helper que retorna os links de navegação com ÍCONES
 */
function getNavLinks(role) {
  // Ícones SVG (estilo Heroicons)
  const iconTurmas = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-2.356M17 20H7m10 0v-2c0-1.657-1.343-3-3-3H7m10 0v-2c0-1.657-1.343-3-3-3h-1m-6 3a3 3 0 100-6 3 3 0 000 6zM7 7a3 3 0 100-6 3 3 0 000 6z"></path></svg>`;
  const iconApostilas = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>`;
  const iconConfig = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`;
  const iconAvaliacoes = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  const iconAdmin = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;

  const commonLinks = [
    { label: 'Apostilas', href: '#apostilas', icon: iconApostilas },
    { label: 'Configurações', href: '#config', icon: iconConfig }
  ];

  if (role === 'professor') {
    return [
      { label: 'Turmas', href: '#turmas', icon: iconTurmas },
      ...commonLinks,
      { label: 'Avaliações', href: '#avaliacoes', icon: iconAvaliacoes },
      { label: 'Administração', href: '#admin', icon: iconAdmin },
    ];
  } else {
    // Aluno
    return [
      { label: 'Minhas Turmas', href: '#turmas', icon: iconTurmas },
      ...commonLinks,
      { label: 'Minhas Avaliações', href: '#avaliacoes', icon: iconAvaliacoes },
    ];
  }
}

/**
 * Atualiza qual link da sidebar está "ativo"
 */
export function updateActiveLink(hash) {
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === hash);
  });
}

/**
 * Pega o elemento <main>
 */
function getMainContent() {
  return document.querySelector('.main-content');
}

// ===============================================
// FUNÇÕES DE RENDERIZAÇÃO DE PÁGINA
// ===============================================

export function renderTurmas(turmas) {
  const main = getMainContent();
  main.innerHTML = '<h2 class="main-header">Minhas Turmas</h2>';
  
  if (turmas.length === 0) {
    main.innerHTML += '<p>Nenhuma turma disponível.</p>';
    return;
  }

  turmas.forEach(t => {
    main.innerHTML += `
      <div class="dp-card">
        <div class="dp-card-title">${t.name}</div>
        <div>Código: <span class="dp-code-badge">${t.code}</span></div>
        <div>Curso: ${t.curso || 'Não especificado'}</div>
        <div>Alunos: ${t.alunos ? t.alunos.length : 0}</div>
      </div>
    `;
  });
}

export function renderApostilas(turmas) {
  const main = getMainContent();
  main.innerHTML = '<h2 class="main-header">Apostilas</h2>';

  turmas.forEach(t => {
    let apostilasHTML = '';
    if (t.apostilas && t.apostilas.length > 0) {
      t.apostilas.forEach(ap => {
        apostilasHTML += `
          <li>
            <a href="${ap.url}" target="_blank">${ap.titulo}</a> 
            — <small>${ap.descricao}</small>
          </li>
        `;
      });
    } else {
      apostilasHTML = '<li>Nenhuma apostila nesta turma.</li>';
    }

    main.innerHTML += `
      <section class="dp-card">
        <div class="dp-card-title">${t.name}</div>
        <ul>${apostilasHTML}</ul>
      </section>
    `;
  });
}

export function renderAvaliacoes(user, store) {
  const main = getMainContent();
  main.innerHTML = '<h2 class="main-header">Avaliações</h2>';
  
  main.innerHTML += `
    <div class="dp-card">
      <div class="dp-card-title">Em Breve</div>
      <p>A funcionalidade de avaliações está sendo construída.</p>
    </div>
  `;
}

export function renderAdmin(turmas) {
  const main = getMainContent();
  main.innerHTML = '<h2 class="main-header">Administração</h2>';
  
  let turmasRows = '';
  turmas.forEach(t => {
    turmasRows += `
      <tr>
        <td><span class="dp-code-badge">${t.code}</span></td>
        <td>${t.name}</td>
        <td>${t.curso || 'N/A'}</td>
        <td>${t.alunos ? t.alunos.length : 0}</td>
        <td>
          <button class="btn" data-id="${t.id}">Editar</button>
        </td>
      </tr>
    `;
  });

  main.innerHTML += `
    <section class="dp-card">
      <div class="dp-card-title">Turmas Cadastradas</div>
      <table class="table">
        <thead>
          <tr><th>Código</th><th>Nome</th><th>Curso</th><th>Alunos</th><th>Ações</th></tr>
        </thead>
        <tbody>
          ${turmasRows}
        </tbody>
      </table>
      <button class="btn-primary" id="btnNovaTurma" style="margin-top: 20px;">+ Nova Turma</button>
    </section>
  `;
}

export function renderConfig(user) {
  const main = getMainContent();
  main.innerHTML = `
    <h2 class="main-header">Configurações</h2>
    <div class="dp-card">
      <p><strong>Nome:</strong> ${user.name}</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Tipo:</strong> ${user.role}</p>
    </div>
  `;
}

export function renderNotFound() {
  const main = getMainContent();
  main.innerHTML = '<h2 class="main-header">Erro 404</h2><p>Página não encontrada.</p>';
}

export function renderAccessDenied() {
  const main = getMainContent();
  main.innerHTML = '<h2 class="main-header">Acesso Negado</h2><p>Você não tem permissão para ver esta página.</p>';
}