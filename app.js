/* ============================================================
   FINANCESAPP — app.js
   Orquestração geral: inicialização da aplicação, troca de
   abas, modais genéricos, sistema de undo/histórico, bus de
   eventos (AppBus) para atualização em tempo real entre telas,
   otimizações de performance e demais controles globais.
   Não deve conter regra de negócio específica de nenhum domínio.
   Carregado por último (depende dos demais módulos já definidos).
   ============================================================ */


/* ===== [de app.js] app.js ===== */
let currentTab  = 'dashboard';
let undoStack = []; // { tipo, dados, timestamp, descricao }

// Estado do calendário
window.appInit = async function () {
  setDefaultDate();
  await loadAll();
  switchTab('dashboard');
  renderDivisaoMeses();
  iniciarRelogio();
  verificarRecorrentes();
  verificarResumoMes();
};

function db()  { return window.firebaseDb; }
function fns() { return window.firebaseFns; }
function uid() { return window.currentUser.uid; }

async function loadAll() {
  await Promise.all([
    loadGastos(),
    loadSalarios(),
    loadCartoes(),
    loadMetas(),
    loadPagamentos(),
    loadRecorrentes(),
    loadEntradasFixas()
  ]);
  syncGlobals();
}

// Mantém window.gastos / window.metas / window.salarios sempre sincronizados
// com as variáveis locais, para que dashboard_widgets.js possa acessá-los.
function syncGlobals() {
  window.gastos    = gastos;
  window.metas     = metas;
  window.salarios  = salarios;
  window.cartoes   = cartoes;
  window.pagamentos  = pagamentos;
  window.recorrentes = recorrentes;
  window.entradasFixas = entradasFixas;
}

async function loadGastos() {
  const { collection, getDocs, query, orderBy } = fns();
  const q    = query(collection(db(), `users/${uid()}/gastos`), orderBy('data', 'desc'));
  const snap = await getDocs(q);
  gastos     = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  window.gastos = gastos;
}

async function loadSalarios() {
  const { collection, getDocs } = fns();
  const snap = await getDocs(collection(db(), `users/${uid()}/salarios`));
  salarios   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  window.salarios = salarios;
}

async function loadCartoes() {
  const { collection, getDocs } = fns();
  const snap = await getDocs(collection(db(), `users/${uid()}/cartoes`));
  cartoes    = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadMetas() {
  const { collection, getDocs } = fns();
  const snap = await getDocs(collection(db(), `users/${uid()}/metas`));
  metas      = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  window.metas = metas;
}

async function loadPagamentos() {
  const { collection, getDocs } = fns();
  const snap = await getDocs(collection(db(), `users/${uid()}/pagamentos`));
  pagamentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadRecorrentes() {
  const { collection, getDocs } = fns();
  const snap  = await getDocs(collection(db(), `users/${uid()}/recorrentes`));
  recorrentes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadEntradasFixas() {
  const { collection, getDocs } = fns();
  const snap = await getDocs(collection(db(), `users/${uid()}/entradasFixas`));
  entradasFixas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  window.entradasFixas = entradasFixas;
}

// ============ ATALHOS DE TECLADO ============
document.addEventListener('keydown', e => {
  if (e.isComposing || e.repeat) return;

  if (e.key === 'Escape') {
    const confirm = document.getElementById('confirm-overlay');
    if (confirm) { confirm.remove(); e.preventDefault(); return; }
    const customDash = document.getElementById('customizar-dashboard-overlay');
    if (customDash) { customDash.remove(); e.preventDefault(); return; }
    if (document.getElementById('modal-futura')?.classList.contains('open')) { fecharModalFutura(); e.preventDefault(); return; }
    if (document.getElementById('modal-parcelas')?.classList.contains('open')) { fecharModalParcelas(); e.preventDefault(); return; }
    if (document.getElementById('modal-overlay')?.classList.contains('open')) { closeModal(); e.preventDefault(); return; }
    if (document.getElementById('mobile-nav-dropdown')?.classList.contains('open')) { toggleMobileNav(); e.preventDefault(); return; }
    if (document.getElementById('sidebar')?.classList.contains('mobile-open')) { closeMobileMenu(); e.preventDefault(); return; }
  }

  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
  const tag = (e.target?.tagName || '').toLowerCase();
  if (tag === 'textarea') return;

  const confirmOk = document.getElementById('confirm-btn-ok');
  if (confirmOk) { confirmOk.click(); e.preventDefault(); return; }
  if (document.getElementById('modal-overlay')?.classList.contains('open')) { salvarGasto(); e.preventDefault(); return; }

  const loginVisivel = document.getElementById('login-screen')?.style.display !== 'none';
  if (loginVisivel) return;

  const target = e.target;
  if (target?.closest?.('.meta-form-box')) { salvarMeta(); e.preventDefault(); return; }
  if (target?.closest?.('.cartao-form-box')) { salvarCartao(); e.preventDefault(); return; }
  if (target?.closest?.('.salario-box')) {
    if (target.id?.startsWith('sal-fixa')) salvarEntradaFixa();
    else if (target.id?.startsWith('sal-extra')) salvarDinheiroExtra();
    else salvarSalario();
    e.preventDefault();
  }
});
// ============ VERIFICAR RECORRENTES ============
async function verificarRecorrentes() {
  const { collection, addDoc } = fns();
  const mesAtual = new Date().toISOString().slice(0, 7);
  const ultimoDiaMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  for (const rec of recorrentes) {
    if (!rec.ativo) continue;
    const jaExiste = gastos.find(g => g.recorrenteId === rec.id && g.data.startsWith(mesAtual));
    if (!jaExiste) {
      const diaVenc = Math.min(parseInt(rec.vencimentoDia) || 1, ultimoDiaMes);
      const dataVenc = `${mesAtual}-${String(diaVenc).padStart(2, '0')}`;
      const novoGasto = {
        categoria:   'Compras recorrentes',
        valor:       rec.valor,
        data:        dataVenc,
        loja:        rec.loja,
        descricao:   rec.cartaoNome ? `Pagar para: ${rec.cartaoNome}` : (rec.descricao || ''),
        parcelas:    1,
        parcelaPaga: 1,
        cartaoId:    rec.cartaoId || null,
        cartaoNome:  rec.cartaoNome || '',
        vencimentoDia: rec.vencimentoDia || null,
        recorrente:  true,
        recorrenteId: rec.id,
        criadoEm:   new Date().toISOString()
      };
      await addDoc(collection(db(), `users/${uid()}/gastos`), novoGasto);
    }
  }
  await loadGastos();
  if (currentTab === 'dashboard') renderDashboard();
  if (currentTab === 'gastos') renderGastosList();
  if (currentTab === 'recorrentes') renderRecorrentes();
  if (currentTab === 'calendario') renderCalendario();
}

// ============ VERIFICAR RESUMO DO MÊS ============
window.switchTab = function (tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

  const titles = {
    dashboard:  ['Dashboard',      'Visão geral das suas finanças'],
    gastos:     ['Gastos',         'Lista de todos os lançamentos'],
    extrato:    ['Extrato',        'Gastos agrupados por dia'],
    parcelados: ['Parcelados',     'Compras parceladas em andamento'],
    salario:    ['Salário',        'Registre sua renda mensal'],
    divisao:    ['Divisão 15/30',  'Quanto pagar em cada data'],
    calendario: ['Calendário',     'Visualize seus gastos por dia'],
    cartoes:    ['Cartões',        'Gerencie seus cartões'],
    recorrentes:['Recorrentes',    'Compras fixas que vencem todo mês'],
    metas:      ['Metas',          'Acompanhe suas metas financeiras'],
    pagamentos: ['Pagamentos',     'Registre e acompanhe seus pagamentos']
  };

  document.getElementById('tab-title').textContent    = titles[tab][0];
  document.getElementById('tab-subtitle').textContent = titles[tab][1];

  if (tab === 'dashboard')  renderDashboard();
  if (tab === 'gastos')     { renderGastosList(); atualizarBadgesFuturas(); }
  if (tab === 'extrato')    renderExtrato();
  if (tab === 'parcelados') renderParcelados();
  if (tab === 'salario')    renderSalarios();
  if (tab === 'divisao')    renderDivisao();
  if (tab === 'calendario') renderCalendario();
  if (tab === 'cartoes')    renderCartoes();
  if (tab === 'recorrentes') renderRecorrentes();
  if (tab === 'metas')      renderMetas();
  if (tab === 'pagamentos') renderPagamentos();
};

// ============ MODAL ============
window.openModal = function () {
  editandoGastoId = null;
  editandoRecorrenteId = null;
  document.getElementById('modal-overlay').classList.add('open');
  document.querySelector('#modal-overlay .modal-header h3').textContent = 'Adicionar Gasto';
  document.querySelector('#modal-overlay .modal-footer .btn-primary').textContent = 'Salvar';
  document.getElementById('m-cat').disabled     = false;
  document.getElementById('m-cat').value       = 'Alimentação';
  document.getElementById('m-valor').value     = '';
  document.getElementById('m-parcelas').value  = '';
  document.getElementById('m-vencimento').value = '';
  document.getElementById('m-loja').value      = '';
  document.getElementById('m-desc').value      = '';
  recDivisivel = null;
  _renderDivisivelBtns();
  document.getElementById('data-error').style.display = 'none';
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('m-data').value = today;
  toggleParcelas();
  populateCartaoSelect();
};

window.closeModal = function () {
  document.getElementById('modal-overlay').classList.remove('open');
  editandoGastoId = null;
  editandoRecorrenteId = null;
  document.getElementById('m-cat').disabled = false;
};

window.closeModalOutside = function (e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
};

window.confirmarAcao = function({ titulo, mensagem, icone, tipoBotao, textoBotao, onConfirm }) {
  // Remove anterior se existir
  document.getElementById('confirm-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'confirm-overlay';
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-modal">
      <div class="confirm-icon confirm-icon-${tipoBotao}">${icone}</div>
      <h3 class="confirm-titulo">${titulo}</h3>
      <p class="confirm-msg">${mensagem}</p>
      <div class="confirm-footer">
        <button class="confirm-btn-cancel" onclick="document.getElementById('confirm-overlay').remove()">
          Cancelar
        </button>
        <button class="confirm-btn-ok confirm-btn-${tipoBotao}" id="confirm-btn-ok">
          ${textoBotao}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  document.getElementById('confirm-btn-ok').onclick = async () => {
    await onConfirm();
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
    }
  });
};

// ============ UNDO ============
window.desfazerUltimaAcao = async function () {
  if (!undoStack.length) { showToast('⚠️ Nada para desfazer'); return; }
  const acao = undoStack.pop();

  try {
    const { collection, addDoc, doc, deleteDoc } = fns();
    if (acao.tipo === 'deleteGasto') {
      // Restaurar gasto deletado
      const { id, ...dados } = acao.dados;
      await addDoc(collection(db(), `users/${uid()}/gastos`), dados);
      await loadGastos();
      showToast(`↩️ Restaurado: ${acao.dados.loja}`);
      if (currentTab === 'dashboard')  renderDashboard();
      if (currentTab === 'gastos')     renderGastosList();
      if (currentTab === 'extrato')    renderExtrato();
      if (currentTab === 'parcelados') renderParcelados();
      if (currentTab === 'calendario') renderCalendario();
    } else if (acao.tipo === 'addGasto') {
      // Remover gasto recém adicionado
      await deleteDoc(doc(db(), `users/${uid()}/gastos`, acao.id));
      await loadGastos();
      showToast(`↩️ Adição desfeita: ${acao.dados.loja}`);
      if (currentTab === 'dashboard')  renderDashboard();
      if (currentTab === 'gastos')     renderGastosList();
      if (currentTab === 'extrato')    renderExtrato();
      if (currentTab === 'parcelados') renderParcelados();
      if (currentTab === 'calendario') renderCalendario();
    } else if (acao.tipo === 'deleteSalario') {
      await addDoc(collection(db(), `users/${uid()}/salarios`), acao.dados);
      await loadSalarios();
      showToast('↩️ Salário restaurado');
      renderSalarios(); renderDashboard();
    }
    renderHistoricoAcoes();
  } catch(e) {
    showToast('❌ Erro ao desfazer: ' + e.message);
  }
};

// ============ PAINEL DE HISTÓRICO ============
window.abrirHistorico = function () {
  document.getElementById('historico-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'historico-overlay';
  overlay.className = 'historico-overlay';

  const itens = [...undoStack].reverse();
  const html = itens.length ? itens.map((a, i) => `
    <div class="historico-item">
      <div class="historico-item-ico">${a.tipo.includes('delete') ? '🗑️' : '➕'}</div>
      <div class="historico-item-info">
        <div class="historico-item-desc">${a.descricao}</div>
        <div class="historico-item-time">${timeAgo(a.timestamp)}</div>
      </div>
    </div>
  `).join('') : '<p style="color:var(--text3);font-size:13px;padding:20px;text-align:center">Nenhuma ação recente.</p>';

  overlay.innerHTML = `
    <div class="historico-painel">
      <div class="historico-header">
        <span>Histórico de Ações</span>
        <div style="display:flex;gap:8px">
          <button class="historico-undo-btn" onclick="desfazerUltimaAcao()">
            ↩️ Desfazer última
          </button>
          <button class="historico-close" onclick="document.getElementById('historico-overlay').remove()">✕</button>
        </div>
      </div>
      <div class="historico-lista">${html}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
};

function renderHistoricoAcoes() {
  // atualiza badge do botão undo na topbar
  const badge = document.getElementById('undo-badge');
  if (badge) badge.textContent = undoStack.length > 0 ? undoStack.length : '';
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'agora mesmo';
  if (diff < 3600000) return `${Math.floor(diff/60000)} min atrás`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h atrás`;
  return `${Math.floor(diff/86400000)}d atrás`;
}

function iniciarRelogio() {
  function atualizar() {
    const agora = new Date();
    const hora  = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const data  = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    document.getElementById('relogio-hora').textContent = hora;
    document.getElementById('relogio-data').textContent = data;
  }
  atualizar();
  setInterval(atualizar, 1000);
}

// ============ UTILIDADES ============
(function patchSwitchTab() {
  const orig = window.switchTab;
  window.switchTab = function(tab) {
    if (tab === 'configuracoes') {
      // Trocar tab manualmente sem precisar de titles no original
      currentTab = tab;
      document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
      const section = document.getElementById('tab-configuracoes');
      if (section) section.classList.add('active');
      const navItem = document.querySelector('[data-tab="configuracoes"]');
      if (navItem) navItem.classList.add('active');
      document.getElementById('tab-title').textContent    = 'Configurações';
      document.getElementById('tab-subtitle').textContent = 'Personalize o app e gerencie sua conta';
      renderConfiguracoes();
      return;
    }
    orig(tab);
  };
})();

// ---- Renderizar dados da conta ----

/* ===== [de app_patches.js] ===== */
(function injetarCssPatches() {
  const s = document.createElement('style');
  s.textContent = `
    /* Saudação dashboard */
    #dashboard-saudacao {
      animation: fadeInDown 0.5s ease both;
    }
    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Fade btn-add */
    .topbar .btn-add {
      will-change: opacity, transform, visibility;
    }

    /* Campo modo entrada fixa */
    #sal-fixa-modo-group { animation: fadeIn 0.3s ease; }

    /* Ajuste parcelado item atraso — destaque individual */
    .atraso-item {
      border-left: 3px solid var(--red);
      padding-left: 10px;
    }

    /* Campos sobrou-extra no modal */
    #sobrou-extra-group .input-group { margin-top: 0 !important; }
  `;
  document.head.appendChild(s);
})();

/* NOTA: o antigo patch fixo "Divisão 15/30 — Recorrentes e
   Parcelados separados" foi removido daqui. Essa lógica agora é
   dinâmica (baseada nos dias de recebimento cadastrados pelo
   usuário) e vive inteiramente em
   app_patch_fase2_divisao_dinamica.js, que substitui
   window.renderDivisao por completo. */

/* ===== [de /home/claude/work/app_patch_botao_adicionar.js] ===== */
/* ============================================================
   FINANCESAPP — PATCH: BOTÃO "ADICIONAR" SÓ EM GASTOS/PARCELADOS/RECORRENTES
   Carregue depois de app.js e app_patches.js.

   Causa raiz do botão "sumido": a regra que deveria controlar a
   visibilidade do .btn-add por aba nunca chegou a ser carregada
   nesta página (o arquivo que a continha não está presente), então
   não havia NENHUM código mostrando/escondendo o botão — e, a
   depender da ordem de carregamento dos outros patches, o botão
   podia ficar com display none aplicado (ex.: por um estado de
   transição de tela) sem nada para revertê-lo.

   Este patch centraliza a regra: o botão "Adicionar" (.btn-add, no
   topo da tela) só fica visível nas abas Gastos, Parcelados e
   Recorrentes — em qualquer outra aba ele é escondido.
   ============================================================ */

(function () {
  'use strict';

  const ABAS_COM_BOTAO = ['gastos', 'parcelados', 'recorrentes'];

  function atualizarBotaoAdicionar(tab) {
    const btn = document.querySelector('.topbar .btn-add');
    if (!btn) return;
    const deveAparecer = ABAS_COM_BOTAO.includes(tab);
    btn.style.display = deveAparecer ? 'flex' : 'none';
  }

  function patchSwitchTabParaBotao() {
    function tentar() {
      if (typeof window.switchTab !== 'function') { setTimeout(tentar, 250); return; }
      if (window.switchTab._comBotaoAdicionar) return;
      const orig = window.switchTab;
      const nova = function (tab) {
        orig.apply(this, arguments);
        atualizarBotaoAdicionar(tab);
      };
      nova._comBotaoAdicionar = true;
      window.switchTab = nova;

      // Estado inicial: aplica a regra assim que o app abrir, sem esperar
      // o usuário trocar de aba pela primeira vez.
      atualizarBotaoAdicionar(window.currentTab || 'dashboard');
    }
    tentar();
  }

  // Também reaplica ao restaurar/entrar no app, caso a aba inicial já
  // seja uma das que mostram o botão (ex.: usuário recarrega a página
  // estando em Gastos).
  function iniciar() {
    patchSwitchTabParaBotao();
    if (window.AppBus?.on) {
      window.AppBus.on('tab_changed', atualizarBotaoAdicionar);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  console.log('[BotaoAdicionar] Visível somente em Gastos/Parcelados/Recorrentes ✓');
})();

/* ===== [de /home/claude/work/app_live_refresh.js] ===== */
/* ============================================================
   FINANCESAPP — LIVE REFRESH SYSTEM
   Garante que todas as abas se atualizam em tempo real sem F5.
   Carregue este arquivo APÓS app.js e app_patches.js.
   ============================================================ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     1. BUS DE EVENTOS — sistema centralizado de notificações
     ────────────────────────────────────────────────────────── */
  const _listeners = {};
  const AppBus = {
    on(evento, fn) {
      if (!_listeners[evento]) _listeners[evento] = [];
      _listeners[evento].push(fn);
    },
    emit(evento, dados) {
      (_listeners[evento] || []).forEach(fn => { try { fn(dados); } catch(e) { console.warn('[AppBus]', evento, e); } });
    }
  };
  window.AppBus = AppBus;

  /* ──────────────────────────────────────────────────────────
     2. HELPER — executa um render só se a aba está visível,
        ou agenda para quando ela abrir
     ────────────────────────────────────────────────────────── */
  function renderSeAtiva(tab, fn) {
    if (window.currentTab === tab) {
      try { fn(); } catch(e) {}
    }
  }

  /* ──────────────────────────────────────────────────────────
     3. SAUDAÇÃO REATIVA — atualiza imediatamente ao trocar nome
     ────────────────────────────────────────────────────────── */
  function getSaudacao() {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'Bom dia';
    if (h >= 12 && h < 18) return 'Boa tarde';
    if (h >= 18 && h < 24) return 'Boa noite';
    return 'Boa madrugada';
  }

  function atualizarSaudacao() {
    const el = document.getElementById('dashboard-saudacao');
    if (!el) return;
    const user = window.currentUser;
    const nome = user?.displayName
      ? user.displayName.split(' ')[0]
      : (user?.email ? user.email.split('@')[0] : '');
    const span = el.querySelector('span:last-child');
    if (span) span.textContent = `${getSaudacao()}${nome ? ', ' + nome : ''}!`;
  }

  // Expõe para uso externo
  window.atualizarSaudacao = atualizarSaudacao;

  /* ──────────────────────────────────────────────────────────
     4. PATCHA salvarNome — atualiza saudação e sidebar
     ────────────────────────────────────────────────────────── */
  function patchSalvarNome() {
    if (typeof window.salvarNome !== 'function') { setTimeout(patchSalvarNome, 300); return; }
    const orig = window.salvarNome;
    window.salvarNome = async function () {
      await orig.apply(this, arguments);
      // Pequeno delay para o Firebase propagar o displayName
      setTimeout(() => {
        atualizarSaudacao();
        AppBus.emit('nome_alterado');
      }, 300);
    };
  }
  patchSalvarNome();

  /* ──────────────────────────────────────────────────────────
     5. PATCHA switchTab — sempre re-renderiza ao entrar na aba
     ────────────────────────────────────────────────────────── */
  function patchSwitchTab() {
    if (typeof window.switchTab !== 'function') { setTimeout(patchSwitchTab, 300); return; }
    const orig = window.switchTab;
    window.switchTab = function (tab) {
      orig.apply(this, arguments);
      AppBus.emit('tab_changed', { tab });
    };
  }
  patchSwitchTab();

  /* ──────────────────────────────────────────────────────────
     6. PATCHA todas as funções de salvar/deletar para emitir
        eventos que atualizam as abas relevantes
     ────────────────────────────────────────────────────────── */

  // Helper: patcha uma função assíncrona e emite um evento após
  function patchFn(nome, evento) {
    function tentar() {
      if (typeof window[nome] !== 'function') { setTimeout(tentar, 400); return; }
      const orig = window[nome];
      window[nome] = async function () {
        const res = await orig.apply(this, arguments);
        AppBus.emit(evento);
        return res;
      };
    }
    tentar();
  }

  // Gastos → afeta dashboard, gastos, extrato, parcelados, divisão, calendário
  patchFn('salvarGasto',   'gastos_changed');
  patchFn('deletarGasto',  'gastos_changed');

  // Salários → afeta dashboard, salário, divisão
  patchFn('salvarSalario',       'salarios_changed');
  patchFn('deletarSalario',      'salarios_changed');
  patchFn('salvarDinheiroExtra', 'salarios_changed');
  patchFn('deletarDinheiroExtra','salarios_changed');
  patchFn('salvarEntradaFixa',   'salarios_changed');
  patchFn('deletarEntradaFixa',  'salarios_changed');

  // Cartões → afeta cartões, divisão, dashboard
  patchFn('salvarCartao',  'cartoes_changed');
  patchFn('deletarCartao', 'cartoes_changed');

  // Metas → afeta metas, dashboard
  patchFn('salvarMeta',         'metas_changed');
  patchFn('deletarMeta',        'metas_changed');
  patchFn('adicionarAMeta',     'metas_changed');
  patchFn('atualizarCorMeta',   'metas_changed');

  // Pagamentos → afeta pagamentos, divisão
  patchFn('registrarPagamento',      'pagamentos_changed');
  patchFn('removerPagamento',        'pagamentos_changed');
  patchFn('pagarFaturaCartaoDivisao','pagamentos_changed');

  // Recorrentes → afeta recorrentes, gastos, dashboard
  patchFn('cancelarRecorrente',         'recorrentes_changed');
  patchFn('marcarRecorrenteComoPago',   'recorrentes_changed');

  /* ──────────────────────────────────────────────────────────
     7. REAÇÕES AOS EVENTOS — re-render das abas afetadas
     ────────────────────────────────────────────────────────── */

  // Gastos mudaram
  AppBus.on('gastos_changed', function () {
    try {
      renderSeAtiva('dashboard',  () => window.renderDashboard?.());
      renderSeAtiva('gastos',     () => { window.renderGastosList?.(); window.atualizarBadgesFuturas?.(); });
      renderSeAtiva('extrato',    () => window.renderExtrato?.());
      renderSeAtiva('parcelados', () => window.renderParcelados?.());
      renderSeAtiva('divisao',    () => window.renderDivisao?.());
      renderSeAtiva('calendario', () => window.renderCalendario?.());
    } catch(e) {}
  });

  // Salários/entradas mudaram
  AppBus.on('salarios_changed', function () {
    try {
      renderSeAtiva('dashboard', () => window.renderDashboard?.());
      renderSeAtiva('salario',   () => window.renderSalarios?.());
      renderSeAtiva('divisao',   () => { window.renderDivisaoMeses?.(); window.renderDivisao?.(); });
    } catch(e) {}
  });

  // Cartões mudaram
  AppBus.on('cartoes_changed', function () {
    try {
      renderSeAtiva('cartoes',   () => window.renderCartoes?.());
      renderSeAtiva('dashboard', () => window.renderDashboard?.());
      renderSeAtiva('divisao',   () => window.renderDivisao?.());
    } catch(e) {}
  });

  // Metas mudaram
  AppBus.on('metas_changed', function () {
    try {
      renderSeAtiva('metas',     () => window.renderMetas?.());
      renderSeAtiva('dashboard', () => window.renderDashboard?.());
    } catch(e) {}
  });

  // Pagamentos mudaram
  AppBus.on('pagamentos_changed', function () {
    try {
      renderSeAtiva('pagamentos', () => window.renderPagamentos?.());
      renderSeAtiva('divisao',    () => window.renderDivisao?.());
      renderSeAtiva('parcelados', () => window.renderParcelados?.());
      renderSeAtiva('dashboard',  () => window.renderDashboard?.());
    } catch(e) {}
  });

  // Recorrentes mudaram
  AppBus.on('recorrentes_changed', function () {
    try {
      renderSeAtiva('recorrentes', () => window.renderRecorrentes?.());
      renderSeAtiva('gastos',      () => window.renderGastosList?.());
      renderSeAtiva('dashboard',   () => window.renderDashboard?.());
    } catch(e) {}
  });

  /* ──────────────────────────────────────────────────────────
     8. AO TROCAR ABA — garante render sempre atualizado
        (mesmo que os dados não tenham mudado desde a última vez)
     ────────────────────────────────────────────────────────── */
  AppBus.on('tab_changed', function ({ tab }) {
    // switchTab já chama o render correto via app.js
    // Aqui só precisamos garantir casos especiais:

    // Saudação: se voltou ao dashboard, garante nome atualizado
    if (tab === 'dashboard') {
      setTimeout(atualizarSaudacao, 50);
    }

    // Divisão: recalcula tudo ao entrar
    if (tab === 'divisao') {
      setTimeout(() => { try { window.renderDivisaoMeses?.(); } catch(e){} }, 50);
    }
  });

  /* ──────────────────────────────────────────────────────────
     9. VISIBILIDADE DA PÁGINA — atualiza ao voltar da aba do browser
     ────────────────────────────────────────────────────────── */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    const tab = window.currentTab;
    if (!tab) return;
    try {
      if (tab === 'dashboard')   { window.renderDashboard?.();  atualizarSaudacao(); }
      if (tab === 'gastos')      { window.renderGastosList?.(); window.atualizarBadgesFuturas?.(); }
      if (tab === 'extrato')     window.renderExtrato?.();
      if (tab === 'parcelados')  window.renderParcelados?.();
      if (tab === 'salario')     window.renderSalarios?.();
      if (tab === 'divisao')     { window.renderDivisaoMeses?.(); window.renderDivisao?.(); }
      if (tab === 'calendario')  window.renderCalendario?.();
      if (tab === 'cartoes')     window.renderCartoes?.();
      if (tab === 'recorrentes') window.renderRecorrentes?.();
      if (tab === 'metas')       window.renderMetas?.();
      if (tab === 'pagamentos')  window.renderPagamentos?.();
    } catch(e) {}
  });

  /* ──────────────────────────────────────────────────────────
     10. PATCH saudação — torna reativa (nunca bloqueia re-render)
         Substitui a lógica do app_patches.js que impedia update
     ────────────────────────────────────────────────────────── */
  function patchInjetarSaudacao() {
    if (typeof window.renderDashboard !== 'function') { setTimeout(patchInjetarSaudacao, 300); return; }

    // Sobrescreve injetarSaudacao para sempre atualizar o conteúdo
    const origRender = window.renderDashboard;
    window.renderDashboard = function () {
      origRender.apply(this, arguments);
      // Após render, verifica se o elemento existe e atualiza o nome
      requestAnimationFrame(() => {
        const el = document.getElementById('dashboard-saudacao');
        if (el) {
          const user = window.currentUser;
          const nome = user?.displayName
            ? user.displayName.split(' ')[0]
            : (user?.email ? user.email.split('@')[0] : '');
          const span = el.querySelector('span:last-child');
          if (span) span.textContent = `${getSaudacao()}${nome ? ', ' + nome : ''}!`;
        }
      });
    };
  }
  patchInjetarSaudacao();

  /* ──────────────────────────────────────────────────────────
     11. PATCH confirmarLimparDados — após limpar, re-renderiza
         tudo imediatamente sem precisar de F5
     ────────────────────────────────────────────────────────── */
  function patchLimparDados() {
    if (typeof window.confirmarLimparDados !== 'function') { setTimeout(patchLimparDados, 500); return; }
    const orig = window.confirmarLimparDados;
    window.confirmarLimparDados = function () {
      // Envolve a lógica original e após limpeza emite evento global
      const origOnConfirm = orig;
      // Intercepta a execução real via override temporário de switchTab
      const origSwitch = window.switchTab;
      window.switchTab = function (tab) {
        origSwitch.apply(this, arguments);
        // Restaura e emite os eventos de dados zerados
        window.switchTab = origSwitch;
        AppBus.emit('gastos_changed');
        AppBus.emit('salarios_changed');
        AppBus.emit('cartoes_changed');
        AppBus.emit('metas_changed');
      };
      orig.apply(this, arguments);
    };
  }
  patchLimparDados();

  /* ──────────────────────────────────────────────────────────
     12. RELÓGIO — atualiza a saudação na virada de hora
     ────────────────────────────────────────────────────────── */
  let _ultimaHora = new Date().getHours();
  setInterval(function () {
    const h = new Date().getHours();
    if (h !== _ultimaHora) {
      _ultimaHora = h;
      atualizarSaudacao();
    }
  }, 60_000);

  console.log('[LiveRefresh] Sistema de atualização em tempo real carregado ✓');
})();

/* ===== [de /home/claude/work/app_performance.js] ===== */
/* ============================================================
   FINANCESAPP — OTIMIZAÇÕES DE DESEMPENHO
   Carregue este arquivo por último (depois de app.js e dos
   demais patches). Ele não substitui nenhuma função existente
   por uma versão "diferente" — apenas torna as chamadas já
   existentes mais baratas (debounce, cache, batching de DOM).
   ============================================================ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     1. DEBOUNCE nos campos de busca (oninput="renderX()")
        Hoje cada tecla digitada dispara um innerHTML completo da
        lista. Com listas grandes isso trava a digitação. Aqui a
        gente troca a função original por uma versão "debounced"
        (só executa a busca depois que o usuário para de digitar
        por ~180ms), sem mudar o comportamento visível.
     ────────────────────────────────────────────────────────── */
  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function aplicarDebounce(nomeFn, ms) {
    function tentar() {
      if (typeof window[nomeFn] !== 'function') { setTimeout(tentar, 300); return; }
      if (window[nomeFn]._debounced) return; // evita aplicar 2x
      const orig = window[nomeFn];
      const deb  = debounce(orig, ms || 180);
      deb._debounced = true;
      deb._original   = orig;
      window[nomeFn]  = deb;
    }
    tentar();
  }

  // Listas que são re-renderizadas via oninput a cada tecla digitada
  [
    'renderGastosList', 'renderExtrato', 'renderFuturasList',
    'renderReprovadosList', 'renderRecorrentes', 'renderCartoes',
    'aoFiltrarPagos'
  ].forEach(nome => aplicarDebounce(nome, 180));

  /* ──────────────────────────────────────────────────────────
     2. requestAnimationFrame para animações de barra de progresso
        Evita forçar reflow síncrono lendo/escrevendo estilo em
        loop; agrupa a escrita no próximo frame de pintura.
     ────────────────────────────────────────────────────────── */
  function animarBarrasProgresso() {
    const barras = document.querySelectorAll('.progress-bar-fill[data-target]:not([data-animado])');
    if (!barras.length) return;
    requestAnimationFrame(() => {
      barras.forEach(el => {
        el.style.width = el.dataset.target + '%';
        el.setAttribute('data-animado', '1');
      });
    });
  }
  // Observa inserções de novas barras de progresso (parcelados, metas etc.)
  // e anima em lote no próximo frame, em vez de vários setTimeout soltos.
  const _barraObserver = new MutationObserver(() => animarBarrasProgresso());
  document.addEventListener('DOMContentLoaded', function () {
    const alvo = document.getElementById('app') || document.body;
    _barraObserver.observe(alvo, { childList: true, subtree: true });
  });

  /* ──────────────────────────────────────────────────────────
     3. CONTENT-VISIBILITY nas listas longas (extrato, gastos,
        parcelados, recorrentes) — o navegador pula o cálculo de
        layout/pintura de itens fora da tela, o que acelera
        bastante listas de meses/anos de histórico.
        Aplicado via classe CSS (ver app_performance.css /
        style_fase_b.css), então isso aqui só garante a classe.
     ────────────────────────────────────────────────────────── */
  function marcarListasLongas() {
    ['extrato-list', 'gastos-list', 'parcelados-list', 'parcelados-pagos-list', 'recorrentes-list']
      .forEach(id => document.getElementById(id)?.classList.add('lista-otimizada'));
  }

  /* ──────────────────────────────────────────────────────────
     4. LAZY LOAD de imagens inseridas dinamicamente
        (avatares, ícones de cartão etc.) — garante loading="lazy"
        em qualquer <img> nova, sem alterar o HTML estático.
     ────────────────────────────────────────────────────────── */
  const _imgObserver = new MutationObserver(muts => {
    for (const m of muts) {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG' && !node.loading) node.loading = 'lazy';
        node.querySelectorAll?.('img:not([loading])').forEach(img => { img.loading = 'lazy'; });
      });
    }
  });

  /* ──────────────────────────────────────────────────────────
     5. Cache leve de leituras repetidas do DOM dentro de uma
        mesma "rodada" de render (evita várias chamadas idênticas
        a getElementById durante o mesmo ciclo de eventos).
        Uso opcional: window.$cached(id) — não obrigatório, mas
        disponível para os novos patches (fase B) usarem.
     ────────────────────────────────────────────────────────── */
  let _cache = new Map();
  let _cacheAgendado = false;
  window.$cached = function (id) {
    if (_cache.has(id)) return _cache.get(id);
    const el = document.getElementById(id);
    _cache.set(id, el);
    if (!_cacheAgendado) {
      _cacheAgendado = true;
      // Limpa o cache no fim da microtask atual — garante que nunca
      // devolvemos uma referência "presa" depois de um re-render.
      Promise.resolve().then(() => { _cache.clear(); _cacheAgendado = false; });
    }
    return el;
  };

  /* ──────────────────────────────────────────────────────────
     6. Torna passivos os listeners de scroll/touch mais comuns,
        reduzindo o custo de rolagem em listas longas no mobile.
     ────────────────────────────────────────────────────────── */
  ['touchstart', 'touchmove', 'wheel'].forEach(evt => {
    document.addEventListener(evt, function () {}, { passive: true });
  });

  /* ──────────────────────────────────────────────────────────
     7. Transição Login → Dashboard: evita "flash" e recalcs
        redundantes de layout, garantindo que a troca de display
        aconteça em um único frame (sem intercalar leitura/escrita
        de estilo, que é a causa mais comum de travadas visuais).
     ────────────────────────────────────────────────────────── */
  const _origAppInit = null; // (mantido apenas como referência; ver nota abaixo)
  // Nota: a troca real de tela (login-screen -> app) já acontece dentro do
  // onAuthStateChanged do index.html. Aqui só suavizamos a chegada ao
  // dashboard aguardando um frame antes de disparar renders pesados,
  // evitando competir com a animação de entrada da sidebar/cards.
  function suavizarEntradaDashboard() {
    function tentar() {
      if (typeof window.appInit !== 'function') { setTimeout(tentar, 200); return; }
      if (window.appInit._otimizado) return;
      const orig = window.appInit;
      window.appInit = function (...args) {
        requestAnimationFrame(() => orig.apply(this, args));
      };
      window.appInit._otimizado = true;
    }
    tentar();
  }
  suavizarEntradaDashboard();

  /* ──────────────────────────────────────────────────────────
     8. INICIALIZAÇÃO
     ────────────────────────────────────────────────────────── */
  function iniciar() {
    marcarListasLongas();
    _imgObserver.observe(document.body, { childList: true, subtree: true });
    animarBarrasProgresso();

    // Reaplica a marcação de "lista longa" sempre que uma aba é trocada,
    // pois algumas listas só existem no DOM depois do primeiro render.
    if (window.AppBus?.on) {
      window.AppBus.on('tab_changed', marcarListasLongas);
    } else {
      // Fallback simples caso o AppBus ainda não tenha carregado
      let tentativas = 0;
      const t = setInterval(() => {
        tentativas++;
        if (window.AppBus?.on) { window.AppBus.on('tab_changed', marcarListasLongas); clearInterval(t); }
        else if (tentativas > 50) clearInterval(t);
      }, 200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  console.log('[Performance] Otimizações de carregamento e navegação ativas ✓');
})();
