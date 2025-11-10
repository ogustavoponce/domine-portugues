// js/router.js
let render, store, user;

export function init(renderModule, storeModule, userSession) {
  render = renderModule;
  store = storeModule;
  user = userSession;

  // Ouve cliques em links internos
  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.getAttribute('href').startsWith('#')) {
      e.preventDefault();
      location.hash = link.getAttribute('href');
    }
  });

  window.addEventListener('hashchange', route);
  route();
}

async function route() {
  const hash = location.hash || (user.role === 'admin' ? '#gestao' : '#turmas');
  render.updateActiveLink(hash);

  switch (hash) {
    case '#turmas':
      const turmas = await store.getTurmasForUser(user);
      render.renderTurmas(turmas, user.role);
      break;
    case '#apostilas':
      // Exemplo: pega a primeira turma do aluno para mostrar apostilas
      // Num app real, o aluno selecionaria a turma antes.
      const minhasTurmas = await store.getTurmasForUser(user);
      if (minhasTurmas.length > 0) {
        render.renderApostilas(minhasTurmas[0], user, store);
      } else {
        render.renderPlaceholder('Apostilas', 'Você não está em nenhuma turma.');
      }
      break;
    case '#comunidade':
       const t = await store.getTurmasForUser(user);
       if (t.length > 0) {
         render.renderComunidade(t[0], user, store);
       } else {
         render.renderPlaceholder('Comunidade', 'Entre em uma turma para ver o chat.');
       }
      break;
    case '#gestao':
      if (user.role === 'admin' || user.role === 'professor') {
        render.renderGestao(user, store);
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