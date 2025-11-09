// js/router.js

let render, store, user;

export function init(renderModule, storeModule, userSession) {
  render = renderModule;
  store = storeModule;
  user = userSession;

  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const hash = new URL(e.currentTarget.href).hash;
      location.hash = hash;
    });
  });

  window.addEventListener('hashchange', route);
  route(); // Carrega a rota inicial
}

/**
 * A função principal de roteamento
 * Agora é ASYNC para esperar o banco de dados
 */
async function route() {
  const hash = location.hash || '#turmas';
  render.updateActiveLink(hash);

  // Agora usamos 'await' para buscar os dados
  switch (hash) {
    case '#turmas':
      const turmasVisiveis = await store.getTurmasForUser(user);
      render.renderTurmas(turmasVisiveis);
      break;

    case '#apostilas':
      const turmasApostilas = await store.getTurmasForUser(user);
      render.renderApostilas(turmasApostilas);
      break;

    case '#avaliacoes':
      // O render.js vai precisar ser atualizado para
      // buscar os dados de avaliação
      render.renderAvaliacoes(user, store);
      break;
    
    case '#admin':
      if (user.role === 'professor') {
        const turmasProfessor = await store.getTurmasForUser(user);
        render.renderAdmin(turmasProfessor);
      } else {
        render.renderAccessDenied();
      }
      break;

    case '#config':
      render.renderConfig(user);
      break;

    default:
      render.renderNotFound();
  }
}