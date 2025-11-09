// js/render.js

/**
 * Desenha a "casca" principal do aplicativo (Sidebar e Main)
 * Isso só roda uma vez quando o app carrega.
 */
export function renderAppShell(user) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-header">Domine Português</div>
      <div class="sidebar-profile">
        <div class="sidebar-avatar">${user.name.charAt(0)}</div>
        <div>
          <div class="sidebar-info">${user.name}</div>
          <div class="sidebar-info-small">${user.role === 'professor' ? 'Professor' : 'Aluno'}</div>
        </div>
      </div>
      <nav class="sidebar-nav"></nav>
    </aside>
    <main class="main-content">
      </main>
  `;

  // Define os links da navegação baseados no tipo de usuário
  const nav = app.querySelector('.sidebar-nav');
  const links = getNavLinks(user.role);
  
  links.forEach(link => {
    nav.innerHTML += `<a href="${link.href}">${link.label}</a>`;
  });
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
// ===============================================

export function renderTurmas(turmas) {
  const main = getMainContent();
  main.innerHTML = '<h2 class="main-header">Turmas</h2>';
  
  if (turmas.length === 0) {
    main.innerHTML += '<p>Nenhuma turma disponível.</p>';
    return;
  }

  turmas.forEach(t => {
    main.innerHTML += `
      <div class="dp-card">
        <div class="dp-card-title">${t.name}</div>
        <div>Código: <span class="dp-code-badge">${t.code}</span></div>
        <div>Curso: ${t.curso}</div>
        <div>Alunos: ${t.alunos.length}</div>
      </div>
    `;
  });
}

export function renderApostilas(turmas) {
  const main = getMainContent();
  main.innerHTML = '<h2 class="main-header">Apostilas</h2>';

  turmas.forEach(t => {
    let apostilasHTML = '';
    t.apostilas.forEach(ap => {
      apostilasHTML += `
        <li>
          <a href="${ap.url}" class="text-link" target="_blank">${ap.titulo}</a> 
          — <small>${ap.descricao}</small>
        </li>
      `;
    });

    main.innerHTML += `
      <section class="dp-card">
        <div class="dp-card-title">${t.name}</div>
        <ul>${apostilasHTML || '<li>Nenhuma apostila nesta turma.</li>'}</ul>
        </section>
    `;
  });
}

export function renderAvaliacoes(user, store) {
  const main = getMainContent();
  main.innerHTML = '<h2 class="main-header">Avaliações</h2>';
  
  // Lógica para Aluno
  if (user.role === 'aluno') {
    const turmas = store.getTurmas().filter(t => t.alunos.includes(user.id));
    turmas.forEach(turma => {
      // (Seu código original de avaliação do aluno aqui)
      main.innerHTML += `
        <div class="dp-card">
          <div class="dp-card-title">${turma.name}</div>
          <p>Avaliações do aluno para esta turma aparecerão aqui.</p>
        </div>
      `;
    });
  } 
  // Lógica para Professor
  else {
     const turmas = store.getTurmas().filter(t => t.professorId === user.id);
     turmas.forEach(turma => {
      // (Seu código original de avaliação do professor aqui)
      main.innerHTML += `
        <div class="dp-card">
          <div class="dp-card-title">${turma.name}</div>
          <p>Tabela de avaliação dos alunos desta turma aparecerá aqui.</p>
        </div>
      `;
    });
  }
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
        <td>${t.curso}</td>
        <td>${t.alunos.length}</td>
        <td>
          <button class="btn btn-primary" data-id="${t.id}">Editar</button>
          <button class="btn btn-danger" data-id="${t.id}">Excluir</button>
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
      <button class="btn btn-primary" id="btnNovaTurma" style="margin-top: 15px;">+ Nova Turma</button>
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
      
      <button id="btnLogout" class="btn btn-primary">Sair</button>
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