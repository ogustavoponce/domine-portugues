// js/router.js

// Variáveis para guardar nossas dependências
let render, store, user;

/**
 * Inicializa o roteador
 */
export function init(renderModule, storeModule, userSession) {
  render = renderModule;
  store = storeModule;
  user = userSession;

  // Adiciona os listeners para os links da sidebar
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const hash = new URL(e.currentTarget.href).hash;
      location.hash = hash; // Muda o hash na URL
    });
  });

  // Ouve mudanças no hash (navegação)
  window.addEventListener('hashchange', route);
  
  // Carrega a rota atual (ou a padrão)
  route();
}

/**
 * A função principal de roteamento
 * É chamada toda vez que o hash muda
 */
function route() {
  const hash = location.hash || '#turmas'; // Padrão é #turmas
  
  // Atualiza qual link está ativo na sidebar
  render.updateActiveLink(hash);

  // Decide qual função de renderização chamar
  switch (hash) {
    case '#turmas':
      let turmasVisiveis;
      if (user.role === 'professor') {
        turmasVisiveis = store.getTurmas().filter(t => t.professorId === user.id);
      } else {
        turmasVisiveis = store.getTurmas().filter(t => t.alunos.includes(user.id));
      }
      render.renderTurmas(turmasVisiveis);
      break;

    case '#apostilas':
      let turmasApostilas;
      if (user.role === 'professor') {
        turmasApostilas = store.getTurmas().filter(t => t.professorId === user.id);
      } else {
        turmasApostilas = store.getTurmas().filter(t => t.alunos.includes(user.id));
      }
      render.renderApostilas(turmasApostilas);
      break;

    case '#avaliacoes':
      render.renderAvaliacoes(user, store);
      break;
    
    case '#admin':
      if (user.role === 'professor') {
        const turmasProfessor = store.getTurmas().filter(t => t.professorId === user.id);
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