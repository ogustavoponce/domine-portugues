// --- IMPORTS E INIT DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

// Sua configuração
const firebaseConfig = {
  apiKey: "AIzaSyCCiWKDMJ9LkBa_9OLauUNFJ9_TPC60h4o",
  authDomain: "domine-portugues.firebaseapp.com",
  projectId: "domine-portugues",
  storageBucket: "domine-portugues.firebasestorage.app",
  messagingSenderId: "717323019793",
  appId: "1:717323019793:web:46c0baaae240b17dbdf3b0",
  measurementId: "G-WXQNKS0VY7"
};

// Inicializa o Firebase e exporta os módulos de autenticação
const fbApp = initializeApp(firebaseConfig);
const fbAuth = getAuth(fbApp);
const fbGoogleProvider = new GoogleAuthProvider();
// --- FIM DA SEÇÃO DO FIREBASE ---


class App {
  constructor() { this.init(); }

  init() {
    this.loadData();
    this.user = this.getSession();
    if (!this.user && !location.pathname.endsWith('login.html')) {
      location.replace('login.html');
      return;
    }
    document.body.classList.add('theme-light');
    if(this.user) this.renderApp();
    else if(location.pathname.endsWith('login.html')) this.renderLoginCadastro();
  }

  loadData() {
    if (!localStorage.NEXUS_DATA) localStorage.NEXUS_DATA = JSON.stringify(window.NEXUS_DB_SEED);
    this.data = JSON.parse(localStorage.NEXUS_DATA);
  }
  saveData() { localStorage.NEXUS_DATA = JSON.stringify(this.data); }
  
  login(email, password) {
    return this.data.users.find(u => u.email === email && u.password === password) || null;
  }
  setSession(user) { sessionStorage.setItem('NEXUS_SESSION', JSON.stringify(user)); this.user = user; }
  getSession() {
    const s = sessionStorage.getItem('NEXUS_SESSION');
    return s ? JSON.parse(s) : null;
  }

  route() {
    const hash = location.hash || '#turmas';
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === hash));
    const main = document.querySelector('.main-content');
    main.innerHTML = '';
    switch(hash) {
      case '#turmas': this.renderTurmas(main); break;
      case '#apostilas': this.renderApostilas(main); break;
      case '#avaliacoes': this.renderAvaliacoes(main); break;
      case '#admin': this.user.role==='professor' ? this.renderAdmin(main) : main.textContent='Acesso negado!'; break;
      case '#config': this.renderConfig(main); break;
      default: main.textContent = 'Página não encontrada.';
    }
  }

  renderLoginCadastro() {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const errLogin = document.getElementById('loginError');
    const errRegister = document.getElementById('registerError');
    const succRegister = document.getElementById('registerSuccess');
    const googleLoginBtn = document.getElementById('googleLoginBtn');

    tabLogin.onclick = () => {
      tabLogin.classList.add('tab-active');
      tabRegister.classList.remove('tab-active');
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
      errLogin.textContent = '';
      errRegister.textContent = '';
      succRegister.textContent = '';
    };
    tabRegister.onclick = () => {
      tabRegister.classList.add('tab-active');
      tabLogin.classList.remove('tab-active');
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      errLogin.textContent = '';
      errRegister.textContent = '';
      succRegister.textContent = '';
    };

    loginForm.onsubmit = e => {
      e.preventDefault();
      const email = loginForm.emailLogin.value.trim();
      const pwd = loginForm.passwordLogin.value.trim();
      const user = this.login(email, pwd); 
      if (user) {
        this.setSession(user);
        location.replace('index.html'); 
      } else {
        errLogin.textContent = 'Usuário ou senha incorretos.';
      }
    };

    registerForm.onsubmit = e => {
      e.preventDefault();
      errRegister.textContent = '';
      succRegister.textContent = '';
      const name = registerForm.nameRegister.value.trim();
      const email = registerForm.emailRegister.value.trim();
      const pwd = registerForm.passwordRegister.value.trim();
      const code = registerForm.codeTurma.value.trim();

      if (!name || !email || !pwd || !code) {
        errRegister.textContent = 'Preencha todos os campos.';
        return;
      }
      if (this.data.users.some(u => u.email === email)) {
        errRegister.textContent = 'Email já cadastrado.';
        return;
      }
      const turma = this.data.turmas.find(t => t.code === code);
      if (!turma) {
        errRegister.textContent = 'Código da turma inválido.';
        return;
      }

      const id = 'u' + Date.now();
      const aluno = { id, email, password: pwd, name, role: 'aluno' };
      this.data.users.push(aluno);
      this.data.alunos.push({ id, name, email });
      turma.alunos.push(id);

      this.saveData();

      succRegister.textContent = 'Cadastro realizado! Faça login.';
      registerForm.reset();
    };

    googleLoginBtn.addEventListener('click', () => this.fazerLoginComGoogle(errLogin));

    tabLogin.click();
  }

  async fazerLoginComGoogle(errLogin) {
    errLogin.textContent = '';
    
    try {
      const result = await signInWithPopup(fbAuth, fbGoogleProvider);
      const fbUser = result.user;
      const email = fbUser.email;

      let localUser = this.data.users.find(u => u.email === email);

      if (localUser) {
        console.log("Usuário local encontrado:", localUser);
        this.setSession(localUser);
        location.replace('index.html');
      
      } else {
        const code = prompt(`Bem-vindo, ${fbUser.displayName}!\nVimos que é seu primeiro acesso.\n\nPor favor, insira o CÓDIGO DA TURMA para completar seu cadastro:`);
        
        if (!code || code.trim() === '') {
          errLogin.textContent = 'Cadastro cancelado. Código da turma é necessário.';
          return;
        }

        const turma = this.data.turmas.find(t => t.code === code.trim());
        
        if (!turma) {
          errLogin.textContent = 'Código da turma inválido. Tente novamente.';
          return;
        }

        const id = 'u' + Date.now();
        const newAluno = { 
          id, 
          email: fbUser.email, 
          password: null,
          name: fbUser.displayName, 
          role: 'aluno' 
        };

        this.data.users.push(newAluno);
        this.data.alunos.push({ id, name: newAluno.name, email: newAluno.email });
        turma.alunos.push(id);

        this.saveData();

        this.setSession(newAluno);
        location.replace('index.html');
      }

    } catch (error) {
      console.error("Erro no login Google:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        errLogin.textContent = "Janela de login fechada.";
      } else {
        errLogin.textContent = "Erro ao logar. Tente novamente.";
      }
    }
  }

  renderApp() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-header">Domine Português</div>
      <div class="sidebar-profile">
        <div class="sidebar-avatar">${this.user.name.charAt(0)}</div>
        <div>
          <div class="sidebar-info">${this.user.name}</div>
          <div class="sidebar-info-small">${this.user.role==='professor'?'Professor':'Aluno'}</div>
        </div>
      </div>
      <nav class="sidebar-nav"></nav>
    `;
    app.appendChild(sidebar);

    const nav = sidebar.querySelector('.sidebar-nav');
    let links = [];
    if(this.user.role==='professor') {
      links = [
        { label: 'Turmas', href: '#turmas' },
        { label: 'Apostilas', href: '#apostilas' },
        { label: 'Avaliações', href: '#avaliacoes' },
        { label: 'Administração', href: '#admin' },
        { label: 'Configurações', href: '#config' }
      ];
    } else {
      links = [
        { label: 'Minhas Turmas', href: '#turmas' },
        { label: 'Apostilas', href: '#apostilas' },
        { label: 'Minhas Avaliações', href: '#avaliacoes' },
        { label: 'Configurações', href: '#config' }
      ];
    }
    links.forEach(l=>{
      const a = document.createElement('a');
      a.href = l.href;
      a.textContent = l.label;
      nav.appendChild(a);
    });
    nav.querySelectorAll('a').forEach(a=>{
      a.addEventListener('click', e => {
        e.preventDefault();
        location.hash = a.getAttribute('href');
        this.route();
      });
    });

    const main = document.createElement('main');
    main.className = 'main-content';
    app.appendChild(main);

    window.onhashchange = () => this.route();
    this.route();
  }

  //---- TURMAS ----
  renderTurmas(main) {
    main.innerHTML = '<h2 class="main-header">Turmas</h2>';
    let turmas = [];
    if(this.user.role==='professor'){
      turmas = this.data.turmas.filter(t=>t.professorId===this.user.id);
    } else {
      turmas = this.data.turmas.filter(t => t.alunos.includes(this.user.id));
    }
    if(turmas.length===0){
      main.innerHTML += '<p>Nenhuma turma disponível.</p>';
      return;
    }
    turmas.forEach(t => {
      const div = document.createElement('div');
      div.className = 'dp-card';
      div.innerHTML = `<div class="dp-card-title">${t.name}</div>
        <div>Código: <span class="dp-code-badge">${t.code}</span></div>
        <div>Curso: ${t.curso}</div>
        <div>Alunos: ${t.alunos.length}</div>`;
      main.appendChild(div);
    });
_ }

  //---- APOSTILAS ----
  renderApostilas(main) {
    main.innerHTML = '<h2 class="main-header">Apostilas</h2>';
    let turmas = [];
    if(this.user.role==='professor'){
      turmas = this.data.turmas.filter(t=>t.professorId===this.user.id);
    } else {
      turmas = this.data.turmas.filter(t => t.alunos.includes(this.user.id));
    }
    turmas.forEach(t => {
      const section = document.createElement('section');
      section.className = 'dp-card';
      section.innerHTML = `<div class="dp-card-title">${t.name}</div>`;
      const ul = document.createElement('ul');
      t.apostilas.forEach(ap=>{
        const li = document.createElement('li');
        li.innerHTML = `<a href="${ap.url}" class="text-link" target="_blank">${ap.titulo}</a> — <small>${ap.descricao}</small>`;
        ul.appendChild(li);
      });
      if (this.user.role === 'professor') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.textContent = '+ Apostila';
        btn.onclick = () => this.modalApostila(t, () => this.renderApostilas(main));
        section.appendChild(btn);
      }
      section.appendChild(ul);
      main.appendChild(section);
    });
  }

  modalApostila(turma, cb) {
    this.modalOpen(`<form>
      <h2>Adicionar Apostila (${turma.name})</h2>
      <div class="form-group"><label>Título</label><input type="text" required /></div>
      <div class="form-group"><label>Descrição</label><input type="text"/></div>
      <div class="form-group"><label>Link (URL PDF)</label><input type="url" required /></div>
      <div class="btn-group">
        <button type="submit" class="btn btn-primary">Salvar</button>
        <button type="button" class="btn btn-danger">Cancelar</button>
      </div>
    </form>`, modal=>{
      modal.querySelector('form').onsubmit = e => {
        e.preventDefault();
        turma.apostilas.push({
          id: 'a'+Date.now(),
          titulo: modal.querySelector('input[type=text]').value.trim(),
          descricao: modal.querySelectorAll('input[type=text]')[1].value.trim(),
          url: modal.querySelector('input[type=url]').value.trim()
        });
        this.saveData(); this.modalClose(); cb();
      };
      modal.querySelector('.btn-danger').onclick = ()=>this.modalClose();
    });
  }

  //---- AVALIAÇÕES ----
  renderAvaliacoes(main) {
    main.innerHTML = '<h2 class="main-header">Avaliações</h2>';
    if (this.user.role === 'professor') {
      this.data.turmas.filter(t=>t.professorId===this.user.id).forEach(turma=>{
        const section = document.createElement('section');
        section.className = 'dp-card';
        section.innerHTML = `<div class="dp-card-title">${turma.name}</div>`;
        const table = document.createElement('table'); table.className = 'table'; table.innerHTML = `<thead><tr><th>Aluno</th><th>Redação</th><th>Língua</th><th>Interpretação</th><th></th></tr></thead><tbody></tbody>`;
        turma.alunos.forEach(alunoId => {
          const aluno = this.data.alunos.find(a=>a.id===alunoId);
          const entrega = this.data.entregas.find(e=>e.turmaId===turma.id && e.alunoId===alunoId) || { avaliacao: {} };
          const tr = document.createElement('tr'); tr.innerHTML = `
            <td>${aluno ? aluno.name : ''}</td>
            <td>${entrega.avaliacao.redacao?.conceito||'-'}<br><small>${entrega.avaliacao.redacao?.feedback||''}</small></td>
            <td>${entrega.avaliacao.lingua?.conceito||'-'}<br><small>${entrega.avaliacao.lingua?.feedback||''}</small></td>
            <td>${entrega.avaliacao.interpretacao?.conceito||'-'}<br><small>${entrega.avaliacao.interpretacao?.feedback||''}</small></td>
            <td><button class="btn btn-primary btn-edit" data-aluno="${aluno.id}" data-turma="${turma.id}">Editar</button></td>
          `; table.querySelector('tbody').appendChild(tr);
        });
        section.appendChild(table); main.appendChild(section);
        section.querySelectorAll('.btn-edit').forEach(btn=>{
          btn.onclick=()=>{
            const aluno=this.data.alunos.find(a=>a.id===btn.getAttribute('data-aluno'));
            const entrega=this.data.entregas.find(e=>e.turmaId===turma.id && e.alunoId===aluno.id)||{ alunoId:aluno.id,turmaId:turma.id,avaliacao:{} };
            this.modalAvaliacao(turma, aluno, entrega, ()=>this.renderAvaliacoes(main));
          };
        });
      });
    } else {
      // ALUNO
      this.data.turmas.filter(t=>t.alunos.includes(this.user.id)).forEach(turma=>{
        const entrega = this.data.entregas.find(e=>e.turmaId===turma.id && e.alunoId===this.user.id);
        const section = document.createElement('section');
        section.className = 'dp-card';
        section.innerHTML = `<div class="dp-card-title">${turma.name}</div>`;
        if (!entrega) { section.innerHTML += `<p>Sem avaliação registrada.</p>`; }
        else ['redacao','lingua','interpretacao'].forEach(campo=>{const bloco=entrega.avaliacao[campo];section.innerHTML += `<div style="margin-bottom:8px;"><b>${campo.charAt(0).toUpperCase()+campo.slice(1)}:</b> <span>${bloco?.conceito||'-'}</span> <small>${bloco?.feedback||''}</small></div>`;});
        main.appendChild(section);
      });
    }
  }

  modalAvaliacao(turma, aluno, entrega, cb) {
    this.modalOpen(`<form>
      <h2>Avaliar ${aluno.name} — ${turma.name}</h2>
      <div class="form-group"><label>Redação - Conceito</label>
        <select required>
          <option value="">Selecione</option>
          <option ${entrega.avaliacao.redacao?.conceito === 'A' ? 'selected':''}>A</option>
          <option ${entrega.avaliacao.redacao?.conceito === 'B' ? 'selected':''}>B</option>
          <option ${entrega.avaliacao.redacao?.conceito === 'C' ? 'selected':''}>C</option>
          <option ${entrega.avaliacao.redacao?.conceito === 'D' ? 'selected':''}>D</option>
        </select>
      </div>
      <div class="form-group"><label>Feedback Redação</label><input type="text" value="${entrega.avaliacao.redacao?.feedback||''}"></div>
      <div class="form-group"><label>Língua - Conceito</label>
        <select required>
          <option value="">Selecione</option>
          <option ${entrega.avaliacao.lingua?.conceito === 'A' ? 'selected':''}>A</option>
          <option ${entrega.avaliacao.lingua?.conceito === 'B' ? 'selected':''}>B</option>
          <option ${entrega.avaliacao.lingua?.conceito === 'C' ? 'selected':''}>C</option>
          <option ${entrega.avaliacao.lingua?.conceito === 'D' ? 'selected':''}>D</option>
        </select>
      </div>
      <div class="form-group"><label>Feedback Língua</label><input type="text" value="${entrega.avaliacao.lingua?.feedback||''}"></div>
      <div class="form-group"><label>Interpretação - Conceito</label>
        <select required>
          <option value="">Selecione</option>
          <option ${entrega.avaliacao.interpretacao?.conceito === 'A' ? 'selected':''}>A</option>
          <option ${entrega.avaliacao.interpretacao?.conceito === 'B' ? 'selected':''}>B</option>
_         <option ${entrega.avaliacao.interpretacao?.conceito === 'C' ? 'selected':''}>C</option>
          <option ${entrega.avaliacao.interpretacao?.conceito === 'D' ? 'selected':''}>D</option>
        </select>
      </div>
      <div class="form-group"><label>Feedback Interpretação</label><input type="text" value="${entrega.avaliacao.interpretacao?.feedback||''}"></div>
      <div class="btn-group">
        <button type="submit" class="btn btn-primary">Salvar</button>
        <button type="button" class="btn btn-danger">Cancelar</button>
      </div>
    </form>`, modal=>{
      modal.querySelector('form').onsubmit = e => {
        e.preventDefault();
        entrega.avaliacao = {
          redacao:  { conceito: modal.querySelectorAll('select')[0].value, feedback: modal.querySelectorAll('input')[0].value.trim() },
          lingua:   { conceito: modal.querySelectorAll('select')[1].value, feedback: modal.querySelectorAll('input')[1].value.trim() },
          interpretacao: { conceito: modal.querySelectorAll('select')[2].value, feedback: modal.querySelectorAll('input')[2].value.trim() }
        };
        if(!entrega.id) { entrega.id = 'e'+Date.now(); entrega.turmaId = turma.id; entrega.alunoId = aluno.id; this.data.entregas.push(entrega);}
        this.saveData(); this.modalClose(); cb();
      };
      modal.querySelector('.btn-danger').onclick=()=>this.modalClose();
    });
  }

  //---- CONFIG ----
  renderConfig(main) {
    main.innerHTML = `<h2 class="main-header">Configurações</h2>
      <p><strong>Nome:</strong> ${this.user.name}</p>
      <p><strong>Email:</strong> ${this.user.email}</p>
      <p><strong>Tipo:</strong> ${this.user.role}</p>
      <button id="btnLogout" class="btn btn-primary">Sair</button>
    `;
    document.getElementById('btnLogout').onclick = () => {
      sessionStorage.removeItem('NEXUS_SESSION');
      location.href = 'login.html';
    };
  }

  //---- ADMINISTRAÇÃO (PROFESSOR) ----
  renderAdmin(main) {
    main.innerHTML = `<h2 class="main-header">Administração</h2>`;
    const section = document.createElement('section');
    section.className = 'dp-card';
    section.innerHTML = `<div class="dp-card-title">Turmas Cadastradas</div>`;
    const table = document.createElement('table');
    table.className = 'table';
    table.innerHTML = `<thead><tr><th>Código</th><th>Nome</th><th>Curso</th><th>Alunos</th><th>Ações</th></tr></thead><tbody></tbody>`;
    this.data.turmas.filter(t=>t.professorId===this.user.id).forEach(t=>{
      const tr = document.createElement('tr');
      tr.innerHTML=`
        <td><span class="dp-code-badge">${t.code}</span></td>
        <td>${t.name}</td>
        <td>${t.curso}</td>
        <td>${t.alunos.length}</td>
        <td>
          <button class="btn btn-primary" data-id="${t.id}">Editar</button>
          <button class="btn btn-danger" data-id="${t.id}">Excluir</button>
        </td>`;
      table.querySelector('tbody').appendChild(tr);
    });
    section.appendChild(table);
    const btnAdd = document.createElement('button');
    btnAdd.className = 'btn btn-primary';
    btnAdd.textContent = '+ Nova Turma';
    btnAdd.onclick = () => this.modalTurma(null, t=>{
      this.data.turmas.push(t);
      this.saveData();
      this.renderAdmin(main);
    });
    section.appendChild(btnAdd);
    main.appendChild(section);
    table.querySelectorAll('.btn.btn-primary').forEach(btn=>{
      btn.onclick=()=>{
        const turma=this.data.turmas.find(t=>t.id===btn.dataset.id);
        this.modalTurma(turma, newData=>{
          Object.assign(turma,newData);this.saveData();this.renderAdmin(main);
        },true);
      };
    });
    table.querySelectorAll('.btn.btn-danger').forEach(btn=>{
      btn.onclick=()=>{
        const tId=btn.dataset.id;
        if(confirm('Confirma excluir a turma?')) {
          this.data.turmas=this.data.turmas.filter(t=>t.id!==tId);
          this.saveData(); this.renderAdmin(main);
        }
      };
    });
  }

  modalTurma(turma, cb, editing) {
    const code = turma?.code || (["INF","JOG","MEC","AUT"][Math.floor(Math.random()*4)] + Math.floor(1000+Math.random()*9000));
    this.modalOpen(`<form>
      <h2>${editing?'Editar':'Nova'} Turma</h2>
      <div class="form-group"><label>Nome</label><input type="text" value="${turma?turma.name:''}" required/></div>
      <div class="form-group"><label>Curso</label><input type="text" value="${turma?turma.curso:'Língua Portuguesa'}" required/></div>
      <div class="form-group"><label>Código da Turma</label><input type="text" value="${code}" required ${editing?'readonly':''}/></div>
      <div class="btn-group"><button type="submit" class="btn btn-primary">Salvar</button>
      <button type="button" class="btn btn-danger">Cancelar</button></div>
    </form>`, modal=>{
      const form=modal.querySelector('form');
      form.onsubmit=e=>{
        e.preventDefault();
        const novo ={
          id: turma?.id||'t'+Date.now(),
          name: form[0].value.trim(),
         curso: form[1].value.trim(),
          code: form[2].value.trim(),
          professorId: 'u1',
          alunos: turma?.alunos||[],
          modulos: turma?.modulos||[],
          apostilas: turma?.apostilas||[]
        };
        cb(novo); this.modalClose();
      };
      form.querySelector('.btn-danger').onclick=()=>this.modalClose();
    });
  }

  //--- MODAL GENERIC ---
  modalOpen(html, cb) {
    if(document.querySelector('#nexus-modal-bg')) return;
    const bg=document.createElement('div');
    bg.id='nexus-modal-bg';
    const modal=document.createElement('div');
    modal.className='nexus-modal';
    modal.innerHTML=html;
    bg.appendChild(modal);
   document.body.appendChild(bg);
    if(cb)cb(modal);
  }
  modalClose() {
    const el=document.querySelector('#nexus-modal-bg');
    if(el)document.body.removeChild(el);
  }
}

document.addEventListener('DOMContentLoaded',()=>{window.NEXUS_APP=new App();});