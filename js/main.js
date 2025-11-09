// js/main.js
import * as auth from './auth.js';
import * as store from './store.js';

// Roda o código quando o HTML carregar
document.addEventListener('DOMContentLoaded', () => {
  // Verifica em qual página estamos
  if (document.body.id === 'page-login') {
    initLoginPage();
  } else if (document.body.id === 'page-app') {
    initAppPage();
  }
});

/**
 * Roda toda a lógica da PÁGINA DE LOGIN
 */
function initLoginPage() {
  // Redireciona se o usuário já estiver logado
  auth.onAuthCheck(user => {
    if (user) {
      location.href = 'index.html';
    }
  });

  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  
  const errLogin = document.getElementById('loginError');
  const errRegister = document.getElementById('registerError');
  const succRegister = document.getElementById('registerSuccess');

  // Lógica das abas (não muda)
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

  // Listener do formulário de LOGIN (agora é async)
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

  // Listener do formulário de REGISTRO (agora é async)
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
  
  // Listener do botão GOOGLE (agora é async)
  googleLoginBtn.onclick = async () => {
    errLogin.textContent = '';
    try {
      await auth.loginWithGoogle();
      // O onAuthCheck vai redirecionar
    } catch (error) {
      errLogin.textContent = error.message;
    }
  };

  tabLogin.click();
}


/**
 * Roda toda a lógica da PÁGINA PRINCIPAL (APP)
 */
function initAppPage() {
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
        // (Buscamos pelo ID que o render.js criou)
        document.body.addEventListener('click', (e) => {
          if (e.target.id === 'btnLogout') {
            auth.logout();
          }
        });
        
      });
    });
  });
}