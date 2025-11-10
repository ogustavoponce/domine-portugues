// js/render.js

/**
 * Esta função agora é SÓ para renderizar os links de navegação e perfil
 * A "casca" (shell) já está no index.html
 */
export function renderAppShell(user) {
  const nav = document.querySelector('.sidebar-nav');
  if (!nav) return; // Sai se não achar o container da nav

  // 1. Renderiza os links de navegação
  const links = getNavLinks(user.role);
  nav.innerHTML = ''; // Limpa links antigos
  links.forEach(link => {
    nav.innerHTML += `<a href="${link.href}">${link.label}</a>`;
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
 * Helper que retorna os links de navegação corretos
 */
function getNavLinks(role) {
  const commonLinks = [
    { label: 'Apostilas', href: '#apostilas' },
    { label: 'Configurações', href: '#config' }
  ];

  if (role === 'professor') {
    return [
      { label: 'Turmas', href: '#turmas' },
      ...commonLinks,
      { label: 'Avaliações', href: '#avaliacoes' },
      { label: 'Administração', href: '#admin' },
    ];
  } else {
    // Aluno
    return [
      { label: 'Minhas Turmas', href: '#turmas' },
      ...commonLinks,
      { label: 'Minhas Avaliações', href: '#avaliacoes' },
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
 * Pega o elemento <main> onde o conteúdo das páginas deve ser inserido
 */
function getMainContent() {
  return document.querySelector('.main-content');
}

// ===============================================
// FUNÇÕES DE RENDERIZAÇÃO DE PÁGINA
// (Estas funções não mudam, o CSS cuida do visual)
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