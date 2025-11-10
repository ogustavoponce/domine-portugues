// js/main.js
import * as auth from './auth.js';
import * as store from './store.js';

// Roda o código quando o HTML carregar
document.addEventListener('DOMContentLoaded', () => {
  
  // Verifica em qual página estamos
  if (document.body.id === 'page-login') {
    // Estamos no LOGIN.HTML
    initLoginPage();
  } else if (document.body.id === 'page-register') {
    // Estamos no REGISTER.HTML
    initRegisterPage();
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
  
  // Redireciona se o usuário já estiver logado
  auth.onAuthCheck(user => {
    if (user) {
      location.href = 'index.html';
    }
  });

  const loginForm = document.getElementById('loginForm');
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  const errLogin = document.getElementById('loginError');

  // Listener do formulário de LOGIN
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    errLogin.textContent = '';
    const email = loginForm.emailLogin.value.trim();
    const pwd = loginForm.passwordLogin.value.trim();
    
    try {
      await auth.login(email, pwd);
      // O onAuthCheck vai redirecionar
    } catch (error) {
      errLogin.textContent = 'Usuário ou senha incorretos.';
    }
  };
  
  // Listener do botão GOOGLE
  googleLoginBtn.onclick = async () => {
    errLogin.textContent = '';
    try {
      await auth.loginWithGoogle();
      // O onAuthCheck vai redirecionar
    } catch (error) {
      errLogin.textContent = error.message;
    }
  };
}

/**
 * Roda toda a lógica da PÁGINA DE CADASTRO
 */
function initRegisterPage() {
  console.log('Estou na página de cadastro');

  // Redireciona se o usuário já estiver logado
  auth.onAuthCheck(user => {
    if (user) {
      location.href = 'index.html';
    }
  });
  
  const registerForm = document.getElementById('registerForm');
  const errRegister = document.getElementById('registerError');
  const succRegister = document.getElementById('registerSuccess');

  // Listener do formulário de REGISTRO
  registerForm.onsubmit = async (e) => {
    e.preventDefault();
    errRegister.textContent = '';
    succRegister.textContent = '';

    const name = registerForm.nameRegister.value.trim();
    const email = registerForm.emailRegister.value.trim();
    const pwd = registerForm.passwordRegister.value.trim();
    const code = registerForm.codeTurma.value.trim();

    try {
      await auth.register(name, email, pwd, code);
      // O onAuthCheck vai redirecionar
    } catch (error) {
      errRegister.textContent = error.message;
    }
  };
}


/**
 * Roda toda a lógica da PÁGINA PRINCIPAL (APP)
 */
function initAppPage() {
  console.log('Estou na página principal (app)');
  
  // O "porteiro"
  auth.onAuthCheck(user => {
    if (!user) {
      // Não está logado, chuta pro login
      location.href = 'login.html';
      return;
    }

    // Está logado! Renderiza o app
    // Usamos imports dinâmicos para não carregar
    // esse código na tela de login
    import('./render.js').then((render) => {
      import('./router.js').then((router) => {
        
        // 1. Desenha a "casca" do app
        render.renderAppShell(user);
        
        // 2. Inicializa o roteador
        router.init(render, store, user);
        
        // 3. Configura o botão de logout
        document.body.addEventListener('click', (e) => {
          if (e.target.id === 'btnLogout') {
            auth.logout();
          }
        });
        
      });
    });
  });
}