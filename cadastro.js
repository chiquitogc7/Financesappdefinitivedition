/* ============================================================
   FINANCESAPP — cadastro.js
   Login, cadastro, recuperação de senha, verificação de e-mail
   e o Wizard (Quiz) de configuração inicial da conta.
   ============================================================ */


/* ===== [de app.js] app.js ===== */
function setLoginFeedback(id, msg, tipo = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `login-feedback ${tipo} visible`;
}

function clearLoginFeedback(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = '';
  el.className = 'login-feedback error';
}

function authMsg(e) {
  const code = e?.code || '';
  const map = {
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/missing-password': 'Informe sua senha.',
    'auth/user-not-found': 'Não encontramos uma conta com esse e-mail.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
    'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.'
  };
  return map[code] || 'Não foi possível concluir agora. Tente novamente.';
}

function mostrarFormLogin(nome) {
  ['login', 'cadastro', 'recuperar', 'verificacao'].forEach(f => {
    const el = document.getElementById(`form-${f}`);
    if (el) el.style.display = f === nome ? 'flex' : 'none';
  });
}

window.doLogin = async function () {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  clearLoginFeedback('login-error');
  if (!email || !pass) { setLoginFeedback('login-error', 'Informe e-mail e senha.'); return; }
  try {
    const { signInWithEmailAndPassword } = fns();
    const cred = await signInWithEmailAndPassword(window.firebaseAuth, email, pass);
    if (!cred.user.emailVerified) showVerificacao();
    // Limpa flag de conta excluída ao logar com sucesso
    try { localStorage.removeItem('fapp_conta_excluida'); } catch(_) {}
  } catch (e) {
    // Se a conta foi excluída anteriormente, direciona para cadastro
    const contaExcluida = localStorage.getItem('fapp_conta_excluida') === '1';
    const codigoNaoEncontrado = e?.code === 'auth/user-not-found' || e?.code === 'auth/invalid-credential';
    if (contaExcluida && codigoNaoEncontrado) {
      setLoginFeedback('login-error', '⚠️ Usuário não encontrado. Crie uma nova conta para continuar.', 'warning');
      setTimeout(() => { showCadastro(); }, 1800);
      return;
    }
    setLoginFeedback('login-error', authMsg(e));
  }
};

window.doCadastro = async function () {
  const nome  = document.getElementById('cad-nome').value.trim();
  const email = document.getElementById('cad-email').value.trim();
  const pass  = document.getElementById('cad-pass').value;
  const pass2 = document.getElementById('cad-pass2').value;
  clearLoginFeedback('cad-msg');

  if (!nome) { setLoginFeedback('cad-msg', 'Informe seu nome.'); return; }
  if (!email) { setLoginFeedback('cad-msg', 'Informe seu e-mail.'); return; }
  if (pass.length < 6) { setLoginFeedback('cad-msg', 'A senha precisa ter pelo menos 6 caracteres.'); return; }
  if (pass !== pass2) { setLoginFeedback('cad-msg', 'As senhas não conferem.'); return; }

  try {
    const { createUserWithEmailAndPassword, sendEmailVerification, updateProfile, setDoc, doc } = fns();
    const cred = await createUserWithEmailAndPassword(window.firebaseAuth, email, pass);
    await updateProfile(cred.user, { displayName: nome }).catch(() => {});
    await setDoc(doc(db(), 'users', cred.user.uid), {
      nome,
      email,
      emailVerificado: false,
      criadoEm: new Date().toISOString()
    }).catch(() => {});
    await sendEmailVerification(cred.user);
    showVerificacao();
    setLoginFeedback('ver-msg', 'Conta criada! Enviamos o e-mail de verificação.', 'success');
  } catch (e) {
    setLoginFeedback('cad-msg', authMsg(e));
  }
};

window.doLogout = async function () {
  const { signOut } = fns();
  await signOut(window.firebaseAuth);
};

window.showRecuperar = function () {
  mostrarFormLogin('recuperar');
  document.getElementById('rec-email').value = '';
  clearLoginFeedback('rec-msg');
};

window.showCadastro = function () {
  mostrarFormLogin('cadastro');
  ['cad-nome', 'cad-email', 'cad-pass', 'cad-pass2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  clearLoginFeedback('cad-msg');
};

window.showLogin = function () {
  mostrarFormLogin('login');
  clearLoginFeedback('login-error');
};

window.showVerificacao = function () {
  mostrarFormLogin('verificacao');
  const user = window.firebaseAuth?.currentUser || window.currentUser;
  const emailEl = document.getElementById('ver-email');
  if (emailEl) emailEl.textContent = user?.email || '';
  clearLoginFeedback('ver-msg');
};

window.doRecuperar = async function () {
  const email = document.getElementById('rec-email').value.trim();
  clearLoginFeedback('rec-msg');
  if (!email) { setLoginFeedback('rec-msg', 'Informe seu e-mail.'); return; }
  try {
    const { sendPasswordResetEmail } = fns();
    await sendPasswordResetEmail(window.firebaseAuth, email);
    setLoginFeedback('rec-msg', '✅ Link enviado! Verifique seu e-mail.', 'success');
  } catch (e) {
    setLoginFeedback('rec-msg', authMsg(e));
  }
};

window.reenviarEmailVerificacao = async function () {
  const user = window.firebaseAuth?.currentUser || window.currentUser;
  if (!user) { showLogin(); return; }
  try {
    const { sendEmailVerification } = fns();
    await sendEmailVerification(user);
    setLoginFeedback('ver-msg', '✅ Novo e-mail de verificação enviado.', 'success');
  } catch (e) {
    setLoginFeedback('ver-msg', authMsg(e));
  }
};

window.checarEmailVerificado = async function () {
  const user = window.firebaseAuth?.currentUser || window.currentUser;
  if (!user) { showLogin(); return; }
  await user.reload();
  if (!user.emailVerified) {
    setLoginFeedback('ver-msg', 'Ainda não aparece como verificado. Abra o link do e-mail e tente novamente.');
    return;
  }
  const { doc, updateDoc } = fns();
  await updateDoc(doc(db(), 'users', user.uid), {
    emailVerificado: true,
    verificadoEm: new Date().toISOString()
  }).catch(() => {});
  window.location.reload();
};

// ============ RELÓGIO ============

/* ===== [de /home/claude/work/app_wizard_cadastro.js] ===== */
/* ============================================================
   FINANCESAPP — WIZARD DE CADASTRO (Quiz de configuração inicial)
   Carregue por último (depois de app.js e dos demais patches).

   O que este arquivo faz:
   1) Assume o controle de window.doCadastro: cria a conta com os
      mesmos 4 campos de sempre (nome, e-mail, senha, confirmar
      senha) e mostra a tela de "verifique seu e-mail".
   2) Só depois que o e-mail é confirmado (via checarEmailVerificado)
      é que o Wizard (Quiz) é aberto — a confirmação de e-mail
      acontece SEMPRE antes do Quiz, nunca depois.
   3) Conduz o Quiz (perfil, dias de recebimento, frequência de
      entradas para Empreendedor/Autônomo, meta opcional ou dívida
      para quem quer "Sair das dívidas"), persistindo tudo em
      users/{uid} (e em users/{uid}/metas quando houver meta ou
      dívida a quitar).
   4) Carrega o perfil salvo (para qualquer sessão, não só a de
      cadastro) e injeta uma dica personalizada no Dashboard.
   ============================================================ */

(function () {
  'use strict';

  const ICONES_META = ['🎯','🏠','🚗','✈️','🎓','💰','📱','👶','💍','🏖️','🛡️','🎁'];

  const DICAS_PERFIL = {
    investidor: '📈 Foco em investimentos: acompanhe suas metas para não perder o ritmo de aportes.',
    dividas:    '🆘 Prioridade: quitar dívidas. Fique de olho nos parcelados e recorrentes em atraso.',
    controle:   '🧭 Controle pessoal: use o Extrato e o Calendário para manter tudo organizado.',
    autonomo:   '💼 Renda variável: registre entradas extras sempre que possível para um saldo mais realista.',
    casal:      '❤️ Conta a dois: a Divisão te ajuda a equilibrar quem paga o quê.'
  };

  const estado = {
    step: 'perfil',
    perfil: null,
    tipoRecebimento: null,
    diaUnico: null,
    diasMultiplos: [],
    temMeta: null,
    // Empreendedor/Autônomo — frequência de lançamento de entradas
    frequenciaEntradas: null,   // 'diaria' | 'semanal' | 'mensal'
    diaSemanaEntradas: null,    // 0-6 (0 = domingo), quando semanal
    diaMesEntradas: null,       // 1-31, quando mensal
    // "Quero sair das dívidas" — substitui a pergunta de meta
    valorDivida: null
  };

  function resetEstado() {
    estado.step = 'perfil';
    estado.perfil = null;
    estado.tipoRecebimento = null;
    estado.diaUnico = null;
    estado.diasMultiplos = [];
    estado.temMeta = null;
    estado.frequenciaEntradas = null;
    estado.diaSemanaEntradas = null;
    estado.diaMesEntradas = null;
    estado.valorDivida = null;
  }

  /* ────────────────────────────────────────────────
     HELPERS DE UI (reaproveitam o app.js quando existem)
     ──────────────────────────────────────────────── */
  function feedback(msg) {
    const el = document.getElementById('wizard-msg');
    if (!el) return;
    if (!msg) {
      el.textContent = '';
      el.className = 'login-feedback error';
      return;
    }
    if (typeof window.setLoginFeedback === 'function') {
      window.setLoginFeedback('wizard-msg', msg);
      return;
    }
    el.textContent = msg;
    el.classList.add('visible');
  }

  function toast(msg) {
    window.showToast?.(msg);
  }

  function mostrarFormulario(nome) {
    ['login', 'cadastro', 'wizard', 'recuperar', 'verificacao'].forEach(f => {
      const el = document.getElementById(`form-${f}`);
      if (el) el.style.display = f === nome ? 'flex' : 'none';
    });
  }

  /* ────────────────────────────────────────────────
     TRANSIÇÃO WIPE
     ──────────────────────────────────────────────── */
  function dispararWipe(aoMeio) {
    const overlay = document.getElementById('cadastro-wipe-overlay');
    if (!overlay) { aoMeio(); return; }
    overlay.classList.remove('rodando');
    // força reflow para reiniciar a animação caso já tenha rodado antes
    void overlay.offsetWidth;
    overlay.classList.add('rodando');
    // Troca o conteúdo por baixo quando o wipe cobre a tela por completo (~48% de 0.85s)
    setTimeout(aoMeio, 410);
    // Remove a classe ao fim da animação, liberando o overlay para o próximo uso
    setTimeout(() => overlay.classList.remove('rodando'), 900);
  }

  /* ────────────────────────────────────────────────
     GRADE DE ÍCONES DA META
     ──────────────────────────────────────────────── */
  function montarGradeIcones() {
    const grid = document.getElementById('wizard-icone-grid');
    if (!grid || grid.childElementCount) return; // monta uma única vez
    ICONES_META.forEach((icone, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wizard-icone-btn' + (i === 0 ? ' active' : '');
      btn.textContent = icone;
      btn.dataset.icone = icone;
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.wizard-icone-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      grid.appendChild(btn);
    });
  }

  function iconeMetaSelecionado() {
    const ativo = document.querySelector('#wizard-icone-grid .wizard-icone-btn.active');
    return ativo?.dataset.icone || ICONES_META[0];
  }

  /* ────────────────────────────────────────────────
     CHIPS DE DIAS MÚLTIPLOS
     ──────────────────────────────────────────────── */
  function renderChipsDias() {
    const wrap = document.getElementById('wizard-dias-chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    estado.diasMultiplos.slice().sort((a, b) => a - b).forEach(dia => {
      const chip = document.createElement('span');
      chip.className = 'wizard-dia-chip';
      chip.innerHTML = `Dia ${String(dia).padStart(2, '0')} <button type="button" aria-label="Remover">✕</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        estado.diasMultiplos = estado.diasMultiplos.filter(d => d !== dia);
        renderChipsDias();
      });
      wrap.appendChild(chip);
    });
  }

  function adicionarDiaMultiplo() {
    const input = document.getElementById('wizard-dia-novo');
    const dia = parseInt(input?.value, 10);
    if (!dia || dia < 1 || dia > 31) { feedback('Informe um dia válido (1 a 31).'); return; }
    if (estado.diasMultiplos.includes(dia)) { feedback('Esse dia já foi adicionado.'); return; }
    estado.diasMultiplos.push(dia);
    if (input) input.value = '';
    feedback('');
    renderChipsDias();
  }

  /* ────────────────────────────────────────────────
     PASSO "freq" — tela própria de frequência de entradas
     (só existe no fluxo de quem escolhe o perfil Empreendedor/Autônomo)
     ──────────────────────────────────────────────── */
  function limparEscolhaFrequencia() {
    // Limpa a escolha para não persistir dados de um perfil que não é mais o atual
    estado.frequenciaEntradas = null;
    estado.diaSemanaEntradas = null;
    estado.diaMesEntradas = null;
    document.querySelectorAll('#wizard-freq-entradas-options .wizard-card').forEach(c => c.classList.remove('active'));
    const semanaBlock = document.getElementById('wizard-freq-semana-block');
    const mesBlock = document.getElementById('wizard-freq-mes-block');
    if (semanaBlock) semanaBlock.style.display = 'none';
    if (mesBlock) mesBlock.style.display = 'none';
  }

  function atualizarBlocoFrequencia(valor) {
    estado.frequenciaEntradas = valor;
    const semanaBlock = document.getElementById('wizard-freq-semana-block');
    const mesBlock = document.getElementById('wizard-freq-mes-block');
    if (semanaBlock) semanaBlock.style.display = valor === 'semanal' ? 'flex' : 'none';
    if (mesBlock) mesBlock.style.display = valor === 'mensal' ? 'flex' : 'none';
  }

  /* ────────────────────────────────────────────────
     PASSO 3 — meta financeira x dívida (dinâmico conforme perfil)
     ──────────────────────────────────────────────── */
  function atualizarStep3ParaPerfil() {
    const titulo = document.getElementById('wizard-step3-title');
    const subtitulo = document.getElementById('wizard-step3-subtitle');
    const blocoMetaOptions = document.getElementById('wizard-meta-options');
    const blocoMetaForm = document.getElementById('wizard-meta-form');
    const blocoDivida = document.getElementById('wizard-divida-form');

    if (estado.perfil === 'dividas') {
      if (titulo) titulo.textContent = 'Qual o valor total da sua dívida?';
      if (subtitulo) subtitulo.textContent = 'Vamos criar uma meta para te ajudar a acompanhar até quitar tudo.';
      if (blocoMetaOptions) blocoMetaOptions.style.display = 'none';
      if (blocoMetaForm) blocoMetaForm.style.display = 'none';
      if (blocoDivida) blocoDivida.style.display = 'flex';
    } else {
      if (titulo) titulo.textContent = 'Você possui alguma meta financeira?';
      if (subtitulo) subtitulo.textContent = 'Se tiver, já criamos ela pra você.';
      if (blocoMetaOptions) blocoMetaOptions.style.display = 'grid';
      if (blocoDivida) blocoDivida.style.display = 'none';
      // blocoMetaForm volta a obedecer estado.temMeta normalmente
      if (blocoMetaForm) blocoMetaForm.style.display = estado.temMeta ? 'flex' : 'none';
    }
  }

  /* ────────────────────────────────────────────────
     SELEÇÃO DE CARDS (perfil / recebimento / meta / freq. entradas)
     ──────────────────────────────────────────────── */
  function ligarGrupoCards(containerId, onEscolher) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.wizard-card').forEach(card => {
      card.addEventListener('click', () => {
        container.querySelectorAll('.wizard-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        feedback('');
        onEscolher(card.dataset.value);
      });
    });
  }

  function iniciarSelecaoCards() {
    ligarGrupoCards('wizard-perfil-options', (valor) => {
      estado.perfil = valor;
      if (valor !== 'autonomo') limparEscolhaFrequencia();
      atualizarStep3ParaPerfil();
    });

    ligarGrupoCards('wizard-freq-entradas-options', atualizarBlocoFrequencia);

    ligarGrupoCards('wizard-recebimento-options', (valor) => {
      estado.tipoRecebimento = valor;
      const blocoUnico = document.getElementById('wizard-dia-unico-block');
      const blocoMulti = document.getElementById('wizard-dias-multiplos-block');
      if (blocoUnico) blocoUnico.style.display = valor === 'unico' ? 'flex' : 'none';
      if (blocoMulti) blocoMulti.style.display = valor === 'multiplo' ? 'flex' : 'none';
    });

    ligarGrupoCards('wizard-meta-options', (valor) => {
      estado.temMeta = valor === 'sim';
      const form = document.getElementById('wizard-meta-form');
      if (form) form.style.display = estado.temMeta ? 'flex' : 'none';
    });

    document.getElementById('wizard-dia-add-btn')?.addEventListener('click', adicionarDiaMultiplo);
    document.getElementById('wizard-dia-novo')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); adicionarDiaMultiplo(); }
    });

    document.getElementById('wizard-btn-avancar')?.addEventListener('click', aoClicarAvancar);
    document.getElementById('wizard-btn-voltar')?.addEventListener('click', aoClicarVoltar);
  }

  /* ────────────────────────────────────────────────
     NAVEGAÇÃO ENTRE PASSOS
     A tela de frequência de entradas ("freq") só entra na sequência
     quando o perfil escolhido no Passo 1 é Empreendedor/Autônomo —
     assim ela vira uma tela própria (com seu próprio Avançar/Voltar),
     em vez de empurrar mais perguntas para dentro do Passo 1.
     ──────────────────────────────────────────────── */
  function getSequenciaPassos() {
    const seq = ['perfil'];
    if (estado.perfil === 'autonomo') seq.push('freq');
    seq.push('recebimento', 'meta');
    return seq;
  }

  function irParaStep(id) {
    estado.step = id;
    const seq = getSequenciaPassos();
    const idx = seq.indexOf(id);

    document.querySelectorAll('.wizard-step').forEach(el => {
      el.classList.toggle('active', el.id === `wizard-step-${id}`);
    });

    document.querySelectorAll('.wizard-dot').forEach(dot => {
      const passoId = dot.dataset.step;
      const naSequencia = seq.includes(passoId);
      dot.style.display = naSequencia ? '' : 'none';
      if (!naSequencia) return;
      const posicao = seq.indexOf(passoId);
      dot.classList.toggle('active', passoId === id);
      dot.classList.toggle('concluido', posicao < idx);
    });

    const btnVoltar = document.getElementById('wizard-btn-voltar');
    if (btnVoltar) btnVoltar.style.visibility = idx > 0 ? 'visible' : 'hidden';
    const btnAvancar = document.getElementById('wizard-btn-avancar');
    if (btnAvancar) btnAvancar.textContent = idx === seq.length - 1 ? 'Concluir' : 'Avançar';
    feedback('');
  }

  function validarStepAtual() {
    if (estado.step === 'perfil') {
      if (!estado.perfil) { feedback('Escolha uma opção para continuar.'); return false; }
      return true;
    }
    if (estado.step === 'freq') {
      if (!estado.frequenciaEntradas) { feedback('Escolha como deseja adicionar suas entradas.'); return false; }
      if (estado.frequenciaEntradas === 'semanal') {
        const sel = document.getElementById('wizard-dia-semana-entradas');
        estado.diaSemanaEntradas = sel ? parseInt(sel.value, 10) : null;
        if (estado.diaSemanaEntradas === null || Number.isNaN(estado.diaSemanaEntradas)) {
          feedback('Escolha o dia da semana para adicionar suas entradas.'); return false;
        }
      }
      if (estado.frequenciaEntradas === 'mensal') {
        const dia = parseInt(document.getElementById('wizard-dia-mes-entradas')?.value, 10);
        if (!dia || dia < 1 || dia > 31) { feedback('Informe um dia do mês válido (1 a 31).'); return false; }
        estado.diaMesEntradas = dia;
      }
      return true;
    }
    if (estado.step === 'recebimento') {
      if (!estado.tipoRecebimento) { feedback('Escolha uma opção para continuar.'); return false; }
      if (estado.tipoRecebimento === 'unico') {
        const input = document.getElementById('wizard-dia-unico');
        const dia = parseInt(input?.value, 10);
        if (!dia || dia < 1 || dia > 31) { feedback('Informe o dia do recebimento (1 a 31).'); return false; }
        estado.diaUnico = dia;
      } else {
        if (estado.diasMultiplos.length < 2) { feedback('Adicione pelo menos 2 dias de recebimento.'); return false; }
      }
      return true;
    }
    if (estado.step === 'meta') {
      if (estado.perfil === 'dividas') {
        const valor = parseFloat(document.getElementById('wizard-divida-valor')?.value) || 0;
        if (valor <= 0) { feedback('Informe o valor total da sua dívida.'); return false; }
        estado.valorDivida = valor;
        return true;
      }
      if (estado.temMeta === null) { feedback('Escolha uma opção para continuar.'); return false; }
      if (estado.temMeta) {
        const nome = document.getElementById('wizard-meta-nome')?.value.trim();
        const objetivo = parseFloat(document.getElementById('wizard-meta-objetivo')?.value) || 0;
        if (!nome || objetivo <= 0) { feedback('Informe nome e valor alvo da meta.'); return false; }
      }
      return true;
    }
    return true;
  }

  function aoClicarAvancar() {
    if (!validarStepAtual()) return;
    const seq = getSequenciaPassos();
    const idx = seq.indexOf(estado.step);
    if (idx < seq.length - 1) { irParaStep(seq[idx + 1]); return; }
    finalizarWizard();
  }

  function aoClicarVoltar() {
    const seq = getSequenciaPassos();
    const idx = seq.indexOf(estado.step);
    if (idx > 0) irParaStep(seq[idx - 1]);
  }

  /* ────────────────────────────────────────────────
     PERSISTÊNCIA + FINALIZAÇÃO
     ──────────────────────────────────────────────── */
  async function finalizarWizard() {
    const btn = document.getElementById('wizard-btn-avancar');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
    document.getElementById('wizard-btn-voltar')?.setAttribute('disabled', 'true');

    try {
      const user = window._wizardUser || window.firebaseAuth?.currentUser || window.currentUser;
      if (!user) throw new Error('Sessão não encontrada. Faça login novamente.');

      const { doc, updateDoc, collection, addDoc } = window.firebaseFns;
      const diasRecebimento = estado.tipoRecebimento === 'unico'
        ? [estado.diaUnico]
        : estado.diasMultiplos.slice().sort((a, b) => a - b);

      const dadosPerfil = {
        perfilFinanceiro: estado.perfil,
        diasRecebimento,
        quizConcluido: true,
        quizConcluidoEm: new Date().toISOString()
      };

      // Empreendedor/Autônomo: salva a frequência escolhida para adicionar
      // entradas — usado depois para gerar os lembretes automáticos.
      if (estado.perfil === 'autonomo' && estado.frequenciaEntradas) {
        dadosPerfil.frequenciaEntradas = estado.frequenciaEntradas;
        dadosPerfil.diaSemanaEntradas = estado.frequenciaEntradas === 'semanal' ? estado.diaSemanaEntradas : null;
        dadosPerfil.diaMesEntradas    = estado.frequenciaEntradas === 'mensal'  ? estado.diaMesEntradas    : null;
      }

      await updateDoc(doc(window.firebaseDb, 'users', user.uid), dadosPerfil);

      if (estado.perfil === 'dividas' && estado.valorDivida > 0) {
        // Cria automaticamente a meta de "Quitar dívidas", no mesmo padrão
        // usado pelas demais metas do sistema (window.salvarMeta).
        await addDoc(collection(window.firebaseDb, `users/${user.uid}/metas`), {
          nome: 'Quitar dívidas',
          objetivo: estado.valorDivida,
          atual: 0,
          onde: '',
          corGrafico: '#e05454',
          icone: '🆘',
          criadoEm: new Date().toISOString()
        });
      } else if (estado.temMeta) {
        const nome = document.getElementById('wizard-meta-nome')?.value.trim();
        const objetivo = parseFloat(document.getElementById('wizard-meta-objetivo')?.value) || 0;
        const inicial = Math.max(0, parseFloat(document.getElementById('wizard-meta-inicial')?.value) || 0);
        const cor = document.getElementById('wizard-meta-cor')?.value || '#f0c040';
        const icone = iconeMetaSelecionado();
        await addDoc(collection(window.firebaseDb, `users/${user.uid}/metas`), {
          nome, objetivo, atual: inicial, onde: '', corGrafico: cor, icone,
          criadoEm: new Date().toISOString()
        });
      }

      window.userProfile = {
        perfilFinanceiro: estado.perfil,
        diasRecebimento,
        quizConcluido: true,
        frequenciaEntradas: dadosPerfil.frequenciaEntradas || null,
        diaSemanaEntradas: dadosPerfil.diaSemanaEntradas ?? null,
        diaMesEntradas: dadosPerfil.diaMesEntradas ?? null
      };
      window.AppBus?.emit?.('metas_changed');
      window.AppBus?.emit?.('perfil_usuario_changed');

      toast('✅ Tudo pronto! Sua conta foi configurada.');
      window._wizardEmAndamento = false;

      // A confirmação de e-mail já aconteceu ANTES do Quiz — o usuário
      // chega aqui só depois de clicar em "Já verifiquei meu e-mail".
      // Por isso, ao concluir o Wizard, seguimos direto para o app
      // (em vez de voltar para a tela de verificação).
      window.location.reload();
    } catch (e) {
      console.error('[WizardCadastro] erro ao salvar quiz', e);
      feedback('Não foi possível salvar suas respostas. Tente novamente.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Concluir'; }
      document.getElementById('wizard-btn-voltar')?.removeAttribute('disabled');
    }
  }

  /* ────────────────────────────────────────────────
     ABERTURA DO WIZARD
     Chamada depois que o e-mail já foi confirmado (ver
     instalarChecarEmailComQuiz mais abaixo).
     ──────────────────────────────────────────────── */
  function abrirWizard(user) {
    window._wizardUser = user;
    window._wizardEmAndamento = true;
    resetEstado();
    montarGradeIcones();

    // Limpa campos de todos os passos
    ['wizard-dia-unico', 'wizard-dia-novo', 'wizard-meta-nome', 'wizard-meta-objetivo',
     'wizard-meta-inicial', 'wizard-dia-mes-entradas', 'wizard-divida-valor']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const cor = document.getElementById('wizard-meta-cor');
    if (cor) cor.value = '#f0c040';
    const selSemana = document.getElementById('wizard-dia-semana-entradas');
    if (selSemana) selSemana.selectedIndex = 0;
    document.querySelectorAll('.wizard-card').forEach(c => c.classList.remove('active'));
    ['wizard-dia-unico-block', 'wizard-dias-multiplos-block', 'wizard-meta-form',
     'wizard-freq-semana-block', 'wizard-freq-mes-block',
     'wizard-divida-form'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    renderChipsDias();
    atualizarStep3ParaPerfil();
    irParaStep('perfil');

    dispararWipe(() => mostrarFormulario('wizard'));
  }
  // Exposto para index.html: cobre logins de contas com e-mail já
  // verificado mas que nunca chegaram a concluir o Quiz.
  window.abrirWizardExistente = abrirWizard;

  /* ────────────────────────────────────────────────
     SUBSTITUI window.doCadastro
     A conta é criada e o e-mail de verificação é enviado, mas o
     Quiz só é aberto DEPOIS que o e-mail for confirmado — ver
     instalarChecarEmailComQuiz().
     ──────────────────────────────────────────────── */
  function instalarDoCadastro() {
    window.doCadastro = async function () {
      const nome  = document.getElementById('cad-nome').value.trim();
      const email = document.getElementById('cad-email').value.trim();
      const pass  = document.getElementById('cad-pass').value;
      const pass2 = document.getElementById('cad-pass2').value;
      if (typeof window.clearLoginFeedback === 'function') window.clearLoginFeedback('cad-msg');

      if (!nome)  { window.setLoginFeedback('cad-msg', 'Informe seu nome.'); return; }
      if (!email) { window.setLoginFeedback('cad-msg', 'Informe seu e-mail.'); return; }
      if (pass.length < 6) { window.setLoginFeedback('cad-msg', 'A senha precisa ter pelo menos 6 caracteres.'); return; }
      if (pass !== pass2) { window.setLoginFeedback('cad-msg', 'As senhas não conferem.'); return; }

      try {
        const { createUserWithEmailAndPassword, sendEmailVerification, updateProfile, setDoc, doc } = window.firebaseFns;
        const cred = await createUserWithEmailAndPassword(window.firebaseAuth, email, pass);
        await updateProfile(cred.user, { displayName: nome }).catch(() => {});
        await setDoc(doc(window.firebaseDb, 'users', cred.user.uid), {
          nome, email, emailVerificado: false, quizConcluido: false, criadoEm: new Date().toISOString()
        }).catch(() => {});
        await sendEmailVerification(cred.user).catch(() => {});

        window._wizardUser = cred.user;
        mostrarFormulario('verificacao');
        window.showVerificacao?.();
        if (typeof window.setLoginFeedback === 'function') {
          window.setLoginFeedback('ver-msg', 'Conta criada! Confirme seu e-mail para continuarmos a configuração.', 'success');
        }
      } catch (e) {
        const msg = typeof window.authMsg === 'function' ? window.authMsg(e) : 'Não foi possível concluir agora. Tente novamente.';
        window.setLoginFeedback('cad-msg', msg);
      }
    };
  }

  /* ────────────────────────────────────────────────
     ORDEM DO FLUXO: confirmação de e-mail ANTES do Quiz.
     Envolve window.checarEmailVerificado (definido em app.js): depois
     que o e-mail é confirmado, em vez de recarregar direto para o
     app, verifica se o Quiz ainda não foi concluído e, se for o
     caso, abre o Wizard antes de liberar o acesso.
     ──────────────────────────────────────────────── */
  function instalarChecarEmailComQuiz() {
    function tentar() {
      if (typeof window.checarEmailVerificado !== 'function') { setTimeout(tentar, 250); return; }
      if (window.checarEmailVerificado._comQuiz) return;

      const orig = window.checarEmailVerificado;
      const nova = async function () {
        const user = window.firebaseAuth?.currentUser || window.currentUser;
        if (!user) { window.showLogin?.(); return; }

        await user.reload();
        if (!user.emailVerified) {
          window.setLoginFeedback?.('ver-msg', 'Ainda não aparece como verificado. Abra o link do e-mail e tente novamente.');
          return;
        }

        try {
          const { doc, updateDoc, getDoc } = window.firebaseFns;
          await updateDoc(doc(window.firebaseDb, 'users', user.uid), {
            emailVerificado: true,
            verificadoEm: new Date().toISOString()
          }).catch(() => {});

          const snap = await getDoc(doc(window.firebaseDb, 'users', user.uid));
          const quizConcluido = snap.exists() && !!snap.data().quizConcluido;

          if (!quizConcluido) {
            // E-mail confirmado, mas o Quiz de configuração inicial ainda
            // não foi feito — abre o Wizard agora, antes de liberar o app.
            abrirWizard(user);
            return;
          }
        } catch (e) {
          console.warn('[WizardCadastro] erro ao checar quizConcluido, seguindo fluxo padrão', e);
        }

        // Quiz já concluído (ou não foi possível checar): segue o fluxo
        // padrão de sempre.
        window.location.reload();
      };
      nova._comQuiz = true;
      window.checarEmailVerificado = nova;
    }
    tentar();
  }

  /* ────────────────────────────────────────────────
     PERSONALIZAÇÃO DO DASHBOARD CONFORME O PERFIL
     ──────────────────────────────────────────────── */
  function injetarDicaPerfil() {
    const tab = document.getElementById('tab-dashboard');
    if (!tab) return;
    const perfil = window.userProfile?.perfilFinanceiro;
    let el = document.getElementById('dashboard-dica-perfil');
    if (!perfil) { el?.remove(); return; }
    const texto = DICAS_PERFIL[perfil];
    if (!texto) { el?.remove(); return; }

    if (!el) {
      el = document.createElement('div');
      el.id = 'dashboard-dica-perfil';
      el.style.cssText = `
        font-size: 13px; color: var(--text2); background: var(--bg3);
        border: 1px solid var(--border); border-radius: 10px;
        padding: 10px 14px; margin-bottom: 14px; line-height: 1.5;
      `;
      const saudacao = document.getElementById('dashboard-saudacao');
      if (saudacao?.nextSibling) tab.insertBefore(el, saudacao.nextSibling);
      else if (saudacao) saudacao.insertAdjacentElement('afterend', el);
      else tab.insertAdjacentElement('afterbegin', el);
    }
    el.textContent = texto;
  }

  function patchRenderDashboardParaDica() {
    function tentar() {
      if (typeof window.renderDashboard !== 'function') { setTimeout(tentar, 300); return; }
      if (window.renderDashboard._comDicaPerfil) return;
      const orig = window.renderDashboard;
      const comDica = function () {
        orig.apply(this, arguments);
        setTimeout(injetarDicaPerfil, 60);
      };
      comDica._comDicaPerfil = true;
      window.renderDashboard = comDica;
    }
    tentar();
  }

  async function carregarPerfilUsuario() {
    let tentativas = 0;
    const esperar = setInterval(async () => {
      tentativas++;
      const user = window.currentUser;
      const { getDoc, doc } = window.firebaseFns || {};
      if (user && getDoc && doc && window.firebaseDb) {
        clearInterval(esperar);
        try {
          const snap = await getDoc(doc(window.firebaseDb, 'users', user.uid));
          if (snap.exists()) {
            const dados = snap.data();
            window.userProfile = {
              perfilFinanceiro: dados.perfilFinanceiro || null,
              diasRecebimento: dados.diasRecebimento || [],
              quizConcluido: !!dados.quizConcluido,
              frequenciaEntradas: dados.frequenciaEntradas || null,
              diaSemanaEntradas: dados.diaSemanaEntradas ?? null,
              diaMesEntradas: dados.diaMesEntradas ?? null
            };
            window.AppBus?.emit?.('perfil_usuario_changed');
            if (window.currentTab === 'dashboard') window.renderDashboard?.();
          }
        } catch (e) { console.warn('[WizardCadastro] não foi possível carregar o perfil', e); }
      } else if (tentativas > 100) {
        clearInterval(esperar);
      }
    }, 300);
  }

  /* ────────────────────────────────────────────────
     INICIALIZAÇÃO
     ──────────────────────────────────────────────── */
  function iniciar() {
    instalarDoCadastro();
    instalarChecarEmailComQuiz();
    iniciarSelecaoCards();
    patchRenderDashboardParaDica();
    carregarPerfilUsuario();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  console.log('[WizardCadastro] Fluxo cadastro → verificação de e-mail → Quiz ativo ✓');
})();
