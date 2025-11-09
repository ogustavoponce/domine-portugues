// js/main.js
import * as auth from './auth.js';
import * as store from './store.js';
// (Vamos importar o router e render depois, no index)

// Roda o código quando o HTML carregar
document.addEventListener('DOMContentLoaded', () => {
  
  // Primeiro de tudo, carrega os dados
  store.loadData();

  // Verifica em qual página estamos
  if (document.body.id === 'page-login') {
    // Estamos no LOGIN.HTML
    initLoginPage();
  } else if (document.body.id === 'page-app') {
    // Estamos no INDEX.HTML
    initAppPage();
  }
});

/**
 * Roda toda a lógica da PÁGINA DE LOGIN
 */
function initLoginPage() {
  console.log('Estou na página de login');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  
  const errLogin = document.getElementById('loginError');
  const errRegister = document.getElementById('registerError');
  const succRegister = document.getElementById('registerSuccess');

  // Lógica das abas
  tabLogin.onclick = () => {
    tabLogin.classList.add('tab-active');
    tabRegister.classList.remove('tab-active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  };
  tabRegister.onclick = () => {
    tabRegister.classList.add('tab-active');
    tabLogin.classList.remove('tab-active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  };

  // Listener do formulário de LOGIN
  loginForm.onsubmit = (e) => {
    e.preventDefault();
    errLogin.textContent = '';
    const email = loginForm.emailLogin.value.trim();
    const pwd = loginForm.passwordLogin.value.trim();
    
    const user = auth.login(email, pwd);
    if (user) {
      location.href = 'index.html';
    } else {
      errLogin.textContent = 'Usuário ou senha incorretos.';
    }
  };

  // Listener do formulário de REGISTRO
  registerForm.onsubmit = (e) => {
    e.preventDefault();
    errRegister.textContent = '';
    succRegister.textContent = '';

    const name = registerForm.nameRegister.value.trim();
    const email = registerForm.emailRegister.value.trim();
    const pwd = registerForm.passwordRegister.value.trim();
    const code = registerForm.codeTurma.value.trim();

    try {
      auth.register(name, email, pwd, code);
      succRegister.textContent = 'Cadastro realizado! Faça login.';
      registerForm.reset();
      tabLogin.click(); // Volta pra aba de login
    } catch (error) {
      errRegister.textContent = error.message;
    }
  };
  
  // Listener do botão GOOGLE
  googleLoginBtn.onclick = async () => {
    errLogin.textContent = '';
    try {
      const errorMessage = await auth.loginWithGoogle();
      if (errorMessage) {
        // Se a função retornar uma mensagem de erro, exiba-a
        errLogin.textContent = errorMessage;
      }
    } catch (error) {
      errLogin.textContent = 'Erro ao tentar logar com Google.';
    }
  };

  // Inicia na aba de login
  tabLogin.click();
}


/**
 * Roda toda a lógica da PÁGINA PRINCIPAL (APP)
 */
function initAppPage() {
  console.log('Estou na página principal (app)');
  
  // Verifica se o usuário está logado. Se não, chuta ele pro login.
  const user = auth.getSession();
  if (!user) {
    location.href = 'login.html';
    return;
  }

  // Se chegou aqui, o usuário está logado.
  // Agora vamos importar o resto do código que o app precisa.
  import('./render.js').then((render) => {
    import('./router.js').then((router) => {
      
      // 1. Desenha a "casca" do app (sidebar, etc)
      render.renderAppShell(user);
      
      // 2. Inicializa o roteador (que vai cuidar das "páginas")
      router.init(render, store, user);
      
      // 3. Configura o botão de logout
      document.getElementById('btnLogout').onclick = () => {
        auth.logout();
      };
      
    });
  });
}