/* ============================================================
   FINANCESAPP — perfil.js
   Perfil do usuário, foto de perfil, configurações, temas,
   preferências, PIN de segurança, backup/exportação, exclusão
   de conta e logout.
   ============================================================ */


/* ===== [de app.js] app.js ===== */
function toggleSidebar(manterPreferencia = true) {
  const sidebar  = document.getElementById('sidebar');
  const btn      = document.getElementById('sidebar-toggle');
  const main     = document.querySelector('.main-content');
  const isCollapsed = sidebar.classList.contains('collapsed');

  if (isCollapsed) {
    // Expand
    sidebar.classList.remove('collapsed');
    btn.classList.remove('rotated');
    btn.title = 'Recolher menu';
    main.style.marginLeft = 'var(--sidebar-w)';
    main.style.width = 'calc(100vw - var(--sidebar-w))';
    btn.style.left = 'var(--sidebar-w)';
    btn.style.transform = 'translateY(-50%) translateX(-50%)';
  } else {
    // Collapse (mantém ícones, some só o texto — ver style_additions.css)
    sidebar.classList.add('collapsed');
    btn.classList.add('rotated');
    btn.title = 'Expandir menu';
    main.style.marginLeft = 'var(--sidebar-w-collapsed)';
    main.style.width = 'calc(100vw - var(--sidebar-w-collapsed))';
    btn.style.left = 'var(--sidebar-w-collapsed)';
    btn.style.transform = 'translateY(-50%) translateX(-50%)';
  }
  btn.classList.remove('pulse');

  if (manterPreferencia) {
    localStorage.setItem('sidebar_collapsed', String(!isCollapsed));
  }
}

/* ============================================
   CONFIGURAÇÕES — lógica completa
   ============================================ */

// Adicionar 'configuracoes' ao switchTab
function renderConfiguracoes() {
  const user = window.currentUser;
  if (!user) return;

  // Preenche nome
  const cfgNome = document.getElementById('cfg-nome');
  if (cfgNome) cfgNome.value = user.displayName || '';

  // Dados da conta
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  setVal('cfg-email-val', user.email);
  setVal('cfg-uid-val', user.uid);

  const createdAt = user.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleString('pt-BR')
    : '—';
  const lastLogin = user.metadata?.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleString('pt-BR')
    : '—';
  setVal('cfg-criado-val', createdAt);
  setVal('cfg-ultimo-val', lastLogin);

  // Restaurar accent salvo
  const savedAccent = localStorage.getItem('cfg_accent');
  if (savedAccent) {
    document.documentElement.style.setProperty('--accent', savedAccent);
    const hexEl = document.getElementById('cfg-accent-hex');
    if (hexEl) hexEl.textContent = savedAccent;
    const picker = document.getElementById('cfg-accent-picker');
    if (picker) picker.value = savedAccent;
    // Marcar preset ativo
    document.querySelectorAll('.cfg-preset[data-val]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === savedAccent);
    });
  }

  // Restaurar tema salvo
  const savedTheme = localStorage.getItem('cfg_theme') || 'dark';
  aplicarTemaPorNome(savedTheme, false);
  document.querySelectorAll('.cfg-theme-card').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === savedTheme);
  });
}

// ---- Salvar nome ----
window.salvarNome = async function() {
  const nome = document.getElementById('cfg-nome')?.value?.trim();
  const msg  = document.getElementById('cfg-perfil-msg');
  if (!nome) { showCfgMsg(msg, 'error', 'Digite um nome válido.'); return; }
  try {
    await window.firebaseFns.updateProfile(window.currentUser, { displayName: nome });
    // Atualizar sidebar-logo
    const logoSpan = document.querySelector('.sidebar-logo span');
    if (logoSpan) logoSpan.innerHTML = `Finances<b>App</b>`;
    showCfgMsg(msg, 'success', `Nome atualizado para "${nome}" com sucesso!`);
  } catch(e) {
    showCfgMsg(msg, 'error', 'Erro ao atualizar nome: ' + e.message);
  }
};

// ---- Salvar senha ----
window.salvarSenha = async function() {
  const s1  = document.getElementById('cfg-senha')?.value;
  const s2  = document.getElementById('cfg-senha2')?.value;
  const msg = document.getElementById('cfg-perfil-msg');
  if (!s1 || s1.length < 6) { showCfgMsg(msg, 'error', 'A senha deve ter pelo menos 6 caracteres.'); return; }
  if (s1 !== s2)             { showCfgMsg(msg, 'error', 'As senhas não coincidem.');                  return; }

  const { updatePassword, reauthenticateWithCredential, EmailAuthProvider } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const user = window.currentUser;

  const tentarTrocar = async () => {
    await updatePassword(user, s1);
    document.getElementById('cfg-senha').value  = '';
    document.getElementById('cfg-senha2').value = '';
    showCfgMsg(msg, 'success', 'Senha alterada com sucesso!');
    showToast('🔑 Senha alterada!');
  };

  try {
    await tentarTrocar();
  } catch(e) {
    if (e.code === 'auth/requires-recent-login') {
      // Pede a senha atual para reautenticar sem precisar de logout
      const senhaAtual = prompt('Por segurança, confirme sua senha atual para continuar:');
      if (!senhaAtual) { showCfgMsg(msg, 'error', 'Confirmação cancelada.'); return; }
      try {
        const cred = EmailAuthProvider.credential(user.email, senhaAtual);
        await reauthenticateWithCredential(user, cred);
        await tentarTrocar();
      } catch(e2) {
        showCfgMsg(msg, 'error', e2.code === 'auth/wrong-password'
          ? 'Senha atual incorreta. Tente novamente.'
          : 'Erro ao reautenticar: ' + e2.message);
      }
    } else {
      showCfgMsg(msg, 'error', 'Erro: ' + e.message);
    }
  }
};

// ---- Preset de cor ----
window.aplicarPreset = function(btn) {
  const val = btn.dataset.val;
  document.documentElement.style.setProperty('--accent', val);
  localStorage.setItem('cfg_accent', val);
  const hexEl = document.getElementById('cfg-accent-hex');
  if (hexEl) hexEl.textContent = val;
  const picker = document.getElementById('cfg-accent-picker');
  if (picker) picker.value = val;
  document.querySelectorAll('.cfg-preset[data-val]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Animação de feedback
  document.documentElement.style.setProperty('--accent-anim', val);
};

// ---- Cor customizada ----
window.aplicarCorCustom = function(varName, input) {
  const val = input.value;
  document.documentElement.style.setProperty(varName, val);
  localStorage.setItem('cfg_accent', val);
  const hexEl = document.getElementById('cfg-accent-hex');
  if (hexEl) hexEl.textContent = val;
  document.querySelectorAll('.cfg-preset[data-val]').forEach(b => b.classList.remove('active'));
};

// ---- Temas de fundo ----
const TEMAS = {
  // ── Escuros ──
  dark:    { bg: '#0d0f14', bg2: '#13161d', bg3: '#1a1e27', border: '#252935', text: '#f0f2f8', text2: '#8b92a8', text3: '#545c74', tipo: 'dark' },
  darker:  { bg: '#080a0e', bg2: '#0e1118', bg3: '#141820', border: '#1a1e27', text: '#f0f2f8', text2: '#8b92a8', text3: '#545c74', tipo: 'dark' },
  slate:   { bg: '#0f172a', bg2: '#1e293b', bg3: '#334155', border: '#475569', text: '#f0f2f8', text2: '#8b92a8', text3: '#545c74', tipo: 'dark' },
  forest:  { bg: '#0a110d', bg2: '#111f16', bg3: '#1e3528', border: '#2a4235', text: '#f0f2f8', text2: '#8b92a8', text3: '#545c74', tipo: 'dark' },
  ocean:   { bg: '#060d1a', bg2: '#0d1f35', bg3: '#162d4a', border: '#1e3d5c', text: '#f0f2f8', text2: '#8b92a8', text3: '#545c74', tipo: 'dark' },
  wine:    { bg: '#110810', bg2: '#1a0e1a', bg3: '#261426', border: '#362036', text: '#f0f2f8', text2: '#8b92a8', text3: '#545c74', tipo: 'dark' },
  // ── Claros ──
  white:   { bg: '#f8f9fb', bg2: '#ffffff', bg3: '#eef0f5', border: '#dde0ea', text: '#111318', text2: '#4a5068', text3: '#8890a8', tipo: 'light' },
  light:   { bg: '#eef1f7', bg2: '#f8faff', bg3: '#dde3f0', border: '#c8d0e4', text: '#181c2e', text2: '#404870', text3: '#8090b8', tipo: 'light' },
  beige:   { bg: '#f5f0e8', bg2: '#fdfaf4', bg3: '#e8dfc8', border: '#cfc4a4', text: '#2a2218', text2: '#5a4e38', text3: '#9a8e78', tipo: 'light' },
  nordic:  { bg: '#dfe4ef', bg2: '#edf0f8', bg3: '#cdd5e5', border: '#adb8d0', text: '#1c2235', text2: '#3d4a6a', text3: '#7888aa', tipo: 'light' },
  rose:    { bg: '#faeef0', bg2: '#fff8f9', bg3: '#f5d8dc', border: '#e8b0ba', text: '#2a0d12', text2: '#6a2035', text3: '#b07088', tipo: 'light' },
};

window.aplicarTema = function(btn) {
  const tema = btn.dataset.theme;
  aplicarTemaPorNome(tema, true);
  document.querySelectorAll('.cfg-theme-card').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

function aplicarTemaPorNome(tema, salvar) {
  const t = TEMAS[tema];
  if (!t) return;
  const root = document.documentElement;
  root.style.setProperty('--bg',     t.bg);
  root.style.setProperty('--bg2',    t.bg2);
  root.style.setProperty('--bg3',    t.bg3);
  root.style.setProperty('--border', t.border);
  if (t.text)  root.style.setProperty('--text',  t.text);
  if (t.text2) root.style.setProperty('--text2', t.text2);
  if (t.text3) root.style.setProperty('--text3', t.text3);
  // Ativa seletores CSS dos temas claros via data-theme
  if (t.tipo === 'light') {
    root.setAttribute('data-theme', tema);
  } else {
    root.removeAttribute('data-theme');
  }
  // Atualiza cores dos gráficos Chart.js
  try {
    const textColor = t.text2 || '#8b92a8';
    const gridColor = t.border || '#252935';
    if (typeof Chart !== 'undefined') {
      Chart.defaults.color = textColor;
    }
    if (window.chartPizza) {
      window.chartPizza.options.plugins.legend.labels.color = textColor;
      window.chartPizza.update('none');
    }
    if (window.chartBarra) {
      ['x','y'].forEach(ax => {
        if (window.chartBarra.options.scales?.[ax]?.ticks)
          window.chartBarra.options.scales[ax].ticks.color = textColor;
        if (window.chartBarra.options.scales?.[ax]?.grid)
          window.chartBarra.options.scales[ax].grid.color = gridColor;
      });
      window.chartBarra.update('none');
    }
  } catch(e) { /* ignora se charts não existem */ }
  if (salvar) {
    localStorage.setItem('cfg_theme', tema);
  }
}

// ---- Exportar backup ----
window.exportarBackup = async function() {
  const msg = document.getElementById('cfg-backup-msg');
  try {
    showCfgMsg(msg, 'success', '⏳ Coletando dados...');
    const backup = {
      versao: '1.0',
      exportadoEm: new Date().toISOString(),
      uid: uid(),
      gastos,
      salarios,
      cartoes,
      metas,
      pagamentos,
      recorrentes,
      entradasFixas
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `financesapp-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showCfgMsg(msg, 'success', `✅ Backup exportado com sucesso! (${gastos.length} gastos, ${salarios.length} salários, ${cartoes.length} cartões)`);
  } catch(e) {
    showCfgMsg(msg, 'error', 'Erro ao exportar: ' + e.message);
  }
};

// ---- Importar backup ----
window.importarBackup = async function(input) {
  const msg  = document.getElementById('cfg-backup-msg');
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.versao || !data.gastos) { showCfgMsg(msg, 'error', 'Arquivo inválido. Selecione um backup válido do FinancesApp.'); return; }

      confirmarAcao({
        titulo: 'Importar Backup?',
        mensagem: `Serão importados: ${data.gastos.length} gastos, ${data.salarios?.length||0} salários, ${data.cartoes?.length||0} cartões, ${data.metas?.length||0} metas. Dados atuais serão substituídos.`,
        icone: '📦',
        tipoBotao: 'warning',
        textoBotao: 'Importar',
        onConfirm: async () => {
          showCfgMsg(msg, 'success', '⏳ Importando dados...');
          try {
            const collections = ['gastos','salarios','cartoes','metas','pagamentos','recorrentes','entradasFixas'];
            for (const col of collections) {
              const arr = data[col] || [];
              const snap = await fns().getDocs(fns().collection(db(), `users/${uid()}/${col}`));
              for (const d of snap.docs) await fns().deleteDoc(d.ref);
              for (const item of arr) {
                const { id: _, ...rest } = item;
                await fns().addDoc(fns().collection(db(), `users/${uid()}/${col}`), rest);
              }
            }
            await loadAll();
            showCfgMsg(msg, 'success', `✅ Backup importado! ${data.gastos.length} gastos restaurados.`);
          } catch(err) {
            showCfgMsg(msg, 'error', 'Erro ao importar: ' + err.message);
          }
        }
      });
    } catch(err) {
      showCfgMsg(msg, 'error', 'Arquivo inválido ou corrompido.');
    }
    input.value = '';
  };
  reader.readAsText(file);
};

// ---- Limpar todos os dados ----
async function _executarLimpezaDados() {
  try {
    showToast('⏳ Apagando dados...');
    const cols = ['gastos','salarios','cartoes','metas','pagamentos','recorrentes','entradasFixas'];
    for (const col of cols) {
      const snap = await fns().getDocs(fns().collection(db(), `users/${uid()}/${col}`));
      for (const d of snap.docs) await fns().deleteDoc(d.ref);
    }
    gastos = []; salarios = []; cartoes = []; metas = []; pagamentos = []; recorrentes = []; entradasFixas = [];
    syncGlobals();
    try {
      localStorage.removeItem('fapp_backup_auto');
      localStorage.removeItem('fapp_backup_toast_ts');
      localStorage.removeItem('fapp_backup_toast_cnt');
    } catch(_) {}
    // Re-renderiza todas as abas afetadas imediatamente
    try { window.renderDashboard?.(); } catch(_) {}
    try { window.renderGastosList?.(); } catch(_) {}
    try { window.renderSalarios?.(); } catch(_) {}
    try { window.renderMetas?.(); } catch(_) {}
    try { window.renderCartoes?.(); } catch(_) {}
    try { window.renderExtrato?.(); } catch(_) {}
    try { window.renderParcelados?.(); } catch(_) {}
    try { window.renderRecorrentes?.(); } catch(_) {}
    try { window.renderPagamentos?.(); } catch(_) {}
    try { window.renderDivisao?.(); } catch(_) {}
    try { window.renderCalendario?.(); } catch(_) {}
    // Emite eventos para o live refresh também atualizar
    try {
      window.AppBus?.emit('gastos_changed');
      window.AppBus?.emit('salarios_changed');
      window.AppBus?.emit('cartoes_changed');
      window.AppBus?.emit('metas_changed');
      window.AppBus?.emit('pagamentos_changed');
      window.AppBus?.emit('recorrentes_changed');
    } catch(_) {}
    switchTab('dashboard');
    showToast('✅ Todos os dados foram apagados.');
  } catch(e) {
    showToast('Erro ao limpar dados: ' + e.message);
    console.error('[LimparDados]', e);
  }
}

window.confirmarLimparDados = function() {
  confirmarAcao({
    titulo: 'Limpar TODOS os dados?',
    mensagem: 'Essa ação é irreversível. Gastos, salários, metas, cartões, recorrentes, parcelados, extrato, saldo líquido, entradas fixas e histórico serão apagados.',
    icone: '🗑️',
    tipoBotao: 'danger',
    textoBotao: 'Sim, apagar tudo',
    onConfirm: _executarLimpezaDados
  });
};

// ---- Excluir conta ----
async function _executarExclusaoConta() {
  try {
    showToast('⏳ Excluindo conta...');

    // 1. Apaga todos os dados do Firestore
    const cols = ['gastos','salarios','cartoes','metas','pagamentos','recorrentes','entradasFixas'];
    for (const col of cols) {
      const snap = await fns().getDocs(fns().collection(db(), `users/${uid()}/${col}`));
      for (const d of snap.docs) await fns().deleteDoc(d.ref);
    }
    // Apaga documento raiz do usuário
    try { await fns().deleteDoc(fns().doc(db(), 'users', uid())); } catch(_) {}

    // 2. Limpa variáveis locais
    gastos = []; salarios = []; cartoes = []; metas = []; pagamentos = []; recorrentes = []; entradasFixas = [];
    syncGlobals();

    // 3. Limpa localStorage completamente
    try { localStorage.clear(); } catch(_) {}

    // 4. Deleta o usuário do Firebase Auth usando deleteUser do SDK
    const user = window.firebaseAuth?.currentUser || window.currentUser;
    if (user) {
      try {
        // Usa a função deleteUser exposta pelo firebaseFns (importada do SDK)
        if (typeof fns().deleteUser === 'function') {
          await fns().deleteUser(user);
        } else {
          // Fallback: método direto no objeto user
          await user.delete();
        }
      } catch(authErr) {
        console.warn('[ExcluirConta] deleteUser falhou:', authErr.code, authErr.message);
        // requires-recent-login: tenta signOut mesmo assim
        // A conta do Firestore já foi limpa; o usuário não conseguirá logar com dados
      }
    }

    // 5. Desloga de qualquer forma
    try { await fns().signOut(window.firebaseAuth); } catch(_) {}

  } catch(e) {
    showToast('Erro ao excluir conta: ' + e.message);
    console.error('[ExcluirConta]', e);
  }
}

window.confirmarExcluirConta = function() {
  // Primeira confirmação
  confirmarAcao({
    titulo: 'Excluir conta permanentemente?',
    mensagem: 'Todos os seus dados (gastos, salários, metas, cartões, recorrentes e histórico) serão apagados e sua conta excluída. Essa ação <b>não pode ser desfeita</b>.',
    icone: '⚠️',
    tipoBotao: 'danger',
    textoBotao: 'Continuar',
    onConfirm: function() {
      // Se PIN estiver definido, exige verificação antes de prosseguir
      const temPin = typeof pinDefinido === 'function' ? pinDefinido() : !!localStorage.getItem('fgab_security_pin');
      if (temPin) {
        // Solicita PIN antes da confirmação final
        (typeof solicitarPin === 'function'
          ? solicitarPin({ titulo: 'Confirmar exclusão de conta', icone: '🔐', subtitulo: 'Digite seu PIN para confirmar a exclusão permanente da conta.' })
          : Promise.resolve(true)
        ).then(function(ok) {
          if (!ok) return;
          _confirmarExclusaoFinal();
        });
      } else {
        _confirmarExclusaoFinal();
      }
    }
  });
};

function _confirmarExclusaoFinal() {
  confirmarAcao({
    titulo: 'Tem absoluta certeza?',
    mensagem: 'Você será desconectado e <b>não poderá recuperar nenhum dado</b>. Se tentar entrar com o mesmo e-mail, será necessário criar uma nova conta.',
    icone: '🚨',
    tipoBotao: 'danger',
    textoBotao: 'Excluir definitivamente',
    onConfirm: _executarExclusaoConta
  });
}

// ---- Helper: mensagem de feedback ----
function showCfgMsg(el, tipo, texto) {
  if (!el) return;
  el.className = 'cfg-msg ' + tipo;
  el.textContent = texto;
  clearTimeout(el._t);
  if (tipo === 'success') el._t = setTimeout(() => { el.className = 'cfg-msg'; el.textContent = ''; }, 5000);
}

// ---- Aplicar preferências salvas no boot ----
(function restaurarPreferencias() {
  const savedAccent = localStorage.getItem('cfg_accent');
  if (savedAccent) document.documentElement.style.setProperty('--accent', savedAccent);
  const savedTheme  = localStorage.getItem('cfg_theme');
  if (savedTheme)  aplicarTemaPorNome(savedTheme, false);
  // (temas claros extras removidos)
})();

// ============================================================
//  BACKUP AUTOMÁTICO — salva localmente a cada ação relevante
// ============================================================
const BACKUP_AUTO_KEY  = 'fapp_backup_auto';
const BACKUP_AUTO_MAX  = 5; // guarda os últimos 5 snapshots

function _tirarSnapshot() {
  try {
    const snapshot = {
      versao: '1.1',
      criadoEm: new Date().toISOString(),
      gastos:      window.gastos      || [],
      salarios:    window.salarios    || [],
      cartoes:     window.cartoes     || [],
      metas:       window.metas       || [],
      pagamentos:  window.pagamentos  || [],
      recorrentes: window.recorrentes || [],
      entradasFixas: window.entradasFixas || []
    };

    let backups = [];
    try { backups = JSON.parse(localStorage.getItem(BACKUP_AUTO_KEY) || '[]'); } catch(e) {}
    backups.unshift(snapshot);
    if (backups.length > BACKUP_AUTO_MAX) backups = backups.slice(0, BACKUP_AUTO_MAX);
    localStorage.setItem(BACKUP_AUTO_KEY, JSON.stringify(backups));

    // Avisa o usuário de vez em quando (1 a cada 4 saves, com cooldown de 2 min)
    const agora = Date.now();
    const ultima = parseInt(localStorage.getItem('fapp_backup_toast_ts') || '0');
    const contadorRaw = parseInt(localStorage.getItem('fapp_backup_toast_cnt') || '0');
    const contador = contadorRaw + 1;
    localStorage.setItem('fapp_backup_toast_cnt', contador);
    if (contador % 4 === 0 && agora - ultima > 2 * 60 * 1000) {
      localStorage.setItem('fapp_backup_toast_ts', agora);
      setTimeout(() => {
        if (typeof showToast === 'function') showToast('💾 Backup automático salvo!');
      }, 800);
    }
  } catch(e) {
    console.warn('[FinancesApp] Backup automático falhou:', e.message);
  }
}

// Intercepta funções de escrita para acionar backup automático
(function instalarAutoBackup() {
  const origSalvarGasto    = window.salvarGasto;
  const origDeletarGasto   = window.deletarGasto;
  const origSalvarSalario  = window.salvarSalario;
  const origDeletarSalario = window.deletarSalario;
  const origSalvarMeta     = window.salvarMeta;

  function comBackup(fn) {
    return async function(...args) {
      const res = await fn.apply(this, args);
      _tirarSnapshot();
      return res;
    };
  }

  // Aplica assim que o DOM estiver pronto (funções podem ser definidas depois)
  setTimeout(() => {
    if (window.salvarGasto)    window.salvarGasto    = comBackup(window.salvarGasto);
    if (window.deletarGasto)   window.deletarGasto   = comBackup(window.deletarGasto);
    if (window.salvarSalario)  window.salvarSalario  = comBackup(window.salvarSalario);
    if (window.deletarSalario) window.deletarSalario = comBackup(window.deletarSalario);
    if (window.salvarMeta)     window.salvarMeta     = comBackup(window.salvarMeta);
    if (window.atualizarCorMeta) window.atualizarCorMeta = comBackup(window.atualizarCorMeta);
    if (window.salvarEntradaFixa) window.salvarEntradaFixa = comBackup(window.salvarEntradaFixa);
    if (window.deletarEntradaFixa) window.deletarEntradaFixa = comBackup(window.deletarEntradaFixa);
    if (window.marcarRecorrenteComoPago) window.marcarRecorrenteComoPago = comBackup(window.marcarRecorrenteComoPago);
    if (window.pagarFaturaCartaoDivisao) window.pagarFaturaCartaoDivisao = comBackup(window.pagarFaturaCartaoDivisao);
  }, 2000);
})();

// ---- Funções para acessar backups automáticos ----
window.listarBackupsAuto = function() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_AUTO_KEY) || '[]');
  } catch(e) { return []; }
};

window.exportarBackupAuto = function(index = 0) {
  const backups = window.listarBackupsAuto();
  const b = backups[index];
  if (!b) { showToast('⚠️ Nenhum backup automático disponível'); return; }
  const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `financesapp-auto-backup-${b.criadoEm.slice(0,16).replace('T','-').replace(':','-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Backup automático exportado!');
};


/* ===== [de /home/claude/work/app_themes.js] ===== */
﻿/* ============================================================
   FINANCESAPP — TEMAS + MENU MOBILE v2 (corrigido)
   ============================================================ */

/* ── TEMAS COMPLETOS ── */

(function () {
  'use strict';

  /* ── Definição completa dos temas ── */
  const TEMAS_COMPLETOS = {
    // Escuros
    dark:   { bg:'#0d0f14', bg2:'#13161d', bg3:'#1a1e27', border:'#252935', text:'#f0f2f8', text2:'#8b92a8', text3:'#545c74', tipo:'dark' },
    darker: { bg:'#080a0e', bg2:'#0e1118', bg3:'#141820', border:'#1a1e27', text:'#f0f2f8', text2:'#8b92a8', text3:'#545c74', tipo:'dark' },
    slate:  { bg:'#0f172a', bg2:'#1e293b', bg3:'#334155', border:'#475569', text:'#f0f2f8', text2:'#8b92a8', text3:'#545c74', tipo:'dark' },
    forest: { bg:'#0a110d', bg2:'#111f16', bg3:'#1e3528', border:'#2a4235', text:'#f0f2f8', text2:'#8b92a8', text3:'#545c74', tipo:'dark' },
    ocean:  { bg:'#060d1a', bg2:'#0d1f35', bg3:'#162d4a', border:'#1e3d5c', text:'#f0f2f8', text2:'#8b92a8', text3:'#545c74', tipo:'dark' },
    wine:   { bg:'#110810', bg2:'#1a0e1a', bg3:'#261426', border:'#362036', text:'#f0f2f8', text2:'#8b92a8', text3:'#545c74', tipo:'dark' },
    // Claros
    white:  { bg:'#f8f9fb', bg2:'#ffffff', bg3:'#eef0f5', border:'#dde0ea', text:'#111318', text2:'#4a5068', text3:'#8890a8', tipo:'light' },
    light:  { bg:'#eef1f7', bg2:'#f8faff', bg3:'#dde3f0', border:'#c8d0e4', text:'#181c2e', text2:'#404870', text3:'#8090b8', tipo:'light' },
    beige:  { bg:'#f5f0e8', bg2:'#fdfaf4', bg3:'#e8dfc8', border:'#cfc4a4', text:'#2a2218', text2:'#5a4e38', text3:'#9a8e78', tipo:'light' },
    nordic: { bg:'#dfe4ef', bg2:'#edf0f8', bg3:'#cdd5e5', border:'#adb8d0', text:'#1c2235', text2:'#3d4a6a', text3:'#7888aa', tipo:'light' },
    rose:   { bg:'#faeef0', bg2:'#fff8f9', bg3:'#f5d8dc', border:'#e8b0ba', text:'#2a0d12', text2:'#6a2035', text3:'#b07088', tipo:'light' }
  };

  /* Aplica um tema por nome */
  function aplicarTemaPorNomeCompleto(tema, salvar) {
    const t = TEMAS_COMPLETOS[tema];
    if (!t) return;

    const root = document.documentElement;
    root.style.setProperty('--bg',     t.bg);
    root.style.setProperty('--bg2',    t.bg2);
    root.style.setProperty('--bg3',    t.bg3);
    root.style.setProperty('--border', t.border);
    root.style.setProperty('--text',   t.text);
    root.style.setProperty('--text2',  t.text2);
    root.style.setProperty('--text3',  t.text3);

    if (t.tipo === 'light') {
      root.setAttribute('data-theme', tema);
      atualizarChartTema(t.text2, t.border);
    } else {
      root.removeAttribute('data-theme');
      atualizarChartTema('#8b92a8', '#252935');
    }

    if (salvar) {
      localStorage.setItem('cfg_theme', tema);
      localStorage.removeItem('cfg_theme_extra');
    }
  }

  /* Atualiza eixos/grid dos gráficos Chart.js */
  function atualizarChartTema(textColor, gridColor) {
    if (typeof Chart !== 'undefined') {
      Chart.defaults.color = textColor;
      if (Chart.defaults.scale) {
        Chart.defaults.scale.grid = Chart.defaults.scale.grid || {};
        Chart.defaults.scale.grid.color = gridColor;
      }
    }
    try {
      if (window.chartPizza) {
        window.chartPizza.options.plugins.legend.labels.color = textColor;
        window.chartPizza.update();
      }
      if (window.chartBarra) {
        if (window.chartBarra.options.scales?.x?.ticks)
          window.chartBarra.options.scales.x.ticks.color = textColor;
        if (window.chartBarra.options.scales?.y?.ticks)
          window.chartBarra.options.scales.y.ticks.color = textColor;
        if (window.chartBarra.options.scales?.x?.grid)
          window.chartBarra.options.scales.x.grid.color = gridColor;
        if (window.chartBarra.options.scales?.y?.grid)
          window.chartBarra.options.scales.y.grid.color = gridColor;
        window.chartBarra.update();
      }
    } catch (e) { /* gráficos podem não existir ainda */ }
  }

  /* ── Inicialização após DOM pronto ── */
  window.addEventListener('DOMContentLoaded', function () {

    // Sobrescreve o objeto TEMAS global do app.js se existir
    if (typeof TEMAS !== 'undefined') {
      Object.assign(TEMAS, TEMAS_COMPLETOS);
    }

    // Expõe função de aplicar tema
    window.aplicarTemaPorNome = aplicarTemaPorNomeCompleto;

    // Chamado pelos botões de tema na tela de Configurações
    window.aplicarTema = function (btn) {
      const tema = btn.dataset.theme;
      aplicarTemaPorNomeCompleto(tema, true);
      document.querySelectorAll('.cfg-theme-card').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window.showToast?.('🎨 Tema aplicado com sucesso!');
    };

    // Restaura tema salvo
    const savedTheme = localStorage.getItem('cfg_theme') || 'dark';
    aplicarTemaPorNomeCompleto(savedTheme, false);
    document.querySelectorAll('.cfg-theme-card').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === savedTheme);
    });

  });

  window._aplicarTemaPorNomeCompleto = aplicarTemaPorNomeCompleto;

})();

/* ============================================================
   MENU MOBILE — Hambúrguer / Drawer lateral
   DESATIVADO: sidebar oculta no mobile via CSS (display:none).
   Navegação feita pelo botão de grade no topo direito.
   Funções mantidas como no-op para compatibilidade.
   ============================================================ */

(function () {
  'use strict';

  // No-ops: sidebar não existe no mobile, sem efeitos colaterais
  window.toggleMobileMenu = function () {};
  window.openMobileMenu   = function () {};
  window.closeMobileMenu  = function () {};

})();

/* ============================================================
   NAVEGAÇÃO RÁPIDA — Botão grade (canto superior direito)
   ============================================================ */

(function () {
  'use strict';

  let navAberto = false;

  /* Abre/fecha o dropdown */
  window.toggleMobileNav = function () {
    navAberto ? fecharMobileNav() : abrirMobileNav();
  };

  function abrirMobileNav() {
    navAberto = true;
    const dropdown = document.getElementById('mobile-nav-dropdown');
    if (!dropdown) return;

    // Posiciona o dropdown logo abaixo do botão que o acionou
    const btn = document.getElementById('mobile-nav-btn');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      dropdown.style.top   = (rect.bottom + 8) + 'px';
      dropdown.style.right = (window.innerWidth - rect.right) + 'px';
      dropdown.style.left  = ''; // remove left caso estivesse setado
      btn.classList.add('nav-open');
    }

    dropdown.classList.add('open');
    atualizarAbaAtiva();

    // Fecha o drawer se estiver aberto
    if (typeof closeMobileMenu === 'function') closeMobileMenu();
  }

  function fecharMobileNav() {
    navAberto = false;
    document.getElementById('mobile-nav-dropdown')?.classList.remove('open');
    document.getElementById('mobile-nav-btn')?.classList.remove('nav-open');
  }

  /* Navega para uma aba e fecha o dropdown */
  window.mobileNavTo = function (tab) {
    fecharMobileNav();
    if (typeof switchTab === 'function') switchTab(tab);
  };

  /* Marca o item ativo conforme aba atual */
  function atualizarAbaAtiva() {
    const ativo = document.querySelector('[data-tab].nav-item.active');
    const abaAtual = ativo ? ativo.dataset.tab : 'dashboard';
    document.querySelectorAll('.mobile-nav-item').forEach(function (btn) {
      const match = (btn.getAttribute('onclick') || '').match(/mobileNavTo\('([^']+)'\)/);
      if (match) btn.classList.toggle('active-tab', match[1] === abaAtual);
    });
  }

  /* Fecha ao clicar fora do dropdown */
  document.addEventListener('click', function (e) {
    if (!navAberto) return;
    const wrap = document.getElementById('mobile-nav-wrap');
    if (wrap && !wrap.contains(e.target)) fecharMobileNav();
  }, true);

  /* Fecha ao redimensionar para desktop */
  window.addEventListener('resize', function () {
    if (window.innerWidth > 1024 && navAberto) fecharMobileNav();
  });

  /* ── Wrap robusto do switchTab ──
     Fica tentando até a função existir (max 3s) em vez de um delay fixo.
  */
  document.addEventListener('DOMContentLoaded', function () {
    let tentativas = 0;
    const MAX = 30; // 30 × 100ms = 3s
    const intervalo = setInterval(function () {
      tentativas++;
      if (typeof window.switchTab === 'function') {
        clearInterval(intervalo);
        const orig = window.switchTab;
        window.switchTab = function (tab) {
          orig(tab);
          // Sincroniza marca ativa no dropdown
          document.querySelectorAll('.mobile-nav-item').forEach(function (btn) {
            const match = (btn.getAttribute('onclick') || '').match(/mobileNavTo\('([^']+)'\)/);
            if (match) btn.classList.toggle('active-tab', match[1] === tab);
          });
        };
      } else if (tentativas >= MAX) {
        clearInterval(intervalo);
      }
    }, 100);
  });

})();

/* ===== [de /home/claude/work/pin_security.js] ===== */
﻿/* =============================================================
   PIN DE SEGURANÇA + TEMAS + SCROLL FIX — FinancesApp v2
   ============================================================= */

/* ── 1. UTILITÁRIOS DE PIN ── */
const PIN_KEY = 'fgab_security_pin';
function pinDefinido()    { return !!localStorage.getItem(PIN_KEY); }
function pinCorreto(pin)  { return localStorage.getItem(PIN_KEY) === pin; }
function salvarPin(pin)   { localStorage.setItem(PIN_KEY, pin); }
function removerPin()     { localStorage.removeItem(PIN_KEY); }

/* ── 2. MODAL DE VERIFICAÇÃO DE PIN ── */
function solicitarPin({ titulo='Confirmação de segurança', icone='🔒', subtitulo='Digite seu PIN de 4 dígitos para continuar.' }={}) {
  return new Promise((resolve) => {
    document.getElementById('pin-modal-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'pin-modal-overlay';
    overlay.innerHTML = `
      <div class="pin-modal-box" id="pin-modal-box">
        <div class="pin-modal-icon">${icone}</div>
        <h3 class="pin-modal-titulo">${titulo}</h3>
        <p class="pin-modal-sub">${subtitulo}</p>
        <div class="pin-dots" id="pin-dots">
          <span class="pin-dot"></span><span class="pin-dot"></span>
          <span class="pin-dot"></span><span class="pin-dot"></span>
        </div>
        <div id="pin-error-msg" class="pin-error-msg"></div>
        <div class="pin-teclado">
          ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>`
            <button type="button" class="pin-key${k===''?' pin-key-empty':''}${k==='⌫'?' pin-key-del':''}"
              ${k!==''?`onclick="pinKeyPress('${k}')"`:'style="pointer-events:none"'}>${k}</button>
          `).join('')}
        </div>
        <p class="pin-keyboard-hint">💡 Você também pode digitar pelo teclado</p>
        <button type="button" class="pin-cancel-btn" onclick="pinCancelar()">Cancelar</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target===overlay) pinCancelar(); });

    let digitado = '';

    // ── TECLADO FÍSICO ──
    function onKeyDown(e) {
      if (e.key >= '0' && e.key <= '9') { pinKeyPress(e.key); }
      else if (e.key === 'Backspace')    { pinKeyPress('⌫'); }
      else if (e.key === 'Escape')       { pinCancelar(); }
    }
    document.addEventListener('keydown', onKeyDown);

    function cleanup() {
      document.removeEventListener('keydown', onKeyDown);
      limparPinHandlers();
    }

    window.pinKeyPress = function(k) {
      const err  = document.getElementById('pin-error-msg');
      const dots = document.querySelectorAll('#pin-dots .pin-dot');
      if (k==='⌫') digitado=digitado.slice(0,-1);
      else if (digitado.length<4) digitado+=k;
      dots.forEach((d,i) => d.classList.toggle('filled', i<digitado.length));
      if (err) err.textContent='';
      // Anima tecla pressionada no teclado virtual
      if (k!=='⌫') {
        document.querySelectorAll('.pin-key:not(.pin-key-del)').forEach(btn => {
          if (btn.textContent.trim()===String(k)) { btn.classList.add('pin-key-flash'); setTimeout(()=>btn.classList.remove('pin-key-flash'),150); }
        });
      }
      if (digitado.length<4) return;
      if (pinCorreto(digitado)) {
        const box=document.getElementById('pin-modal-box');
        if (box) box.classList.add('pin-sucesso');
        setTimeout(()=>{ overlay.remove(); cleanup(); resolve(true); },350);
      } else {
        sacudirEl('pin-modal-box');
        if (err) err.textContent='PIN incorreto. Tente novamente.';
        setTimeout(()=>{ digitado=''; dots.forEach(d=>d.classList.remove('filled')); },600);
      }
    };
    window.pinCancelar = function(){ overlay.remove(); cleanup(); resolve(false); };
  });
}

function limparPinHandlers() {
  ['pinKeyPress','pinCancelar'].forEach(k=>delete window[k]);
}

function sacudirEl(id) {
  const el=document.getElementById(id); if(!el) return;
  el.classList.add('pin-shake');
  setTimeout(()=>el.classList.remove('pin-shake'),600);
}

/* ── 3. MODAL DE CONFIGURAR/TROCAR PIN (com teclado físico) ── */
window.abrirConfigurarPin = function() {
  document.getElementById('pin-config-overlay')?.remove();
  const jaTemPin=pinDefinido();
  const overlay=document.createElement('div');
  overlay.id='pin-config-overlay';
  overlay.innerHTML=`
    <div class="pin-modal-box" id="pin-config-box">
      <div class="pin-modal-icon">🔐</div>
      <h3 class="pin-modal-titulo">${jaTemPin?'Trocar PIN':'Criar PIN de Segurança'}</h3>
      <p class="pin-modal-sub" id="pin-config-sub">${jaTemPin?'Digite seu PIN atual.':'Escolha um PIN de 4 dígitos.'}</p>
      <div class="pin-dots" id="pin-cfg-dots">
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
      </div>
      <div id="pin-cfg-err" class="pin-error-msg"></div>
      <div class="pin-teclado">
        ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>`
          <button type="button" class="pin-key${k===''?' pin-key-empty':''}${k==='⌫'?' pin-key-del':''}"
            ${k!==''?`onclick="pinConfigKey('${k}')"`:'style="pointer-events:none"'}>${k}</button>
        `).join('')}
      </div>
      <p class="pin-keyboard-hint">💡 Você também pode digitar pelo teclado</p>
      ${jaTemPin?`<button type="button" class="pin-danger-btn" onclick="pinRemoverConfirmar()">Remover PIN</button>`:''}
      <button type="button" class="pin-cancel-btn" onclick="pinConfigCancelar()">Cancelar</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e=>{ if(e.target===overlay) pinConfigCancelar(); });

  let etapa=jaTemPin?'atual':'novo';
  let pinAtual='',pinNovo='',pinConf='';

  function onKeyDown(e) {
    if (e.key>='0'&&e.key<='9') { pinConfigKey(e.key); }
    else if (e.key==='Backspace') { pinConfigKey('⌫'); }
    else if (e.key==='Escape')    { pinConfigCancelar(); }
  }
  document.addEventListener('keydown', onKeyDown);

  function cleanupCfg() {
    document.removeEventListener('keydown', onKeyDown);
    ['pinConfigKey','pinConfigCancelar','pinRemoverConfirmar'].forEach(k=>delete window[k]);
  }

  window.pinConfigKey=function(k){
    const err=document.getElementById('pin-cfg-err');
    const dots=document.querySelectorAll('#pin-cfg-dots .pin-dot');
    const sub=document.getElementById('pin-config-sub');
    let campo=etapa==='atual'?pinAtual:etapa==='novo'?pinNovo:pinConf;
    if(k==='⌫') campo=campo.slice(0,-1); else if(campo.length<4) campo+=k;
    if(etapa==='atual') pinAtual=campo; else if(etapa==='novo') pinNovo=campo; else pinConf=campo;
    dots.forEach((d,i)=>d.classList.toggle('filled',i<campo.length));
    if(err) err.textContent='';
    if(campo.length<4) return;

    if(etapa==='atual'){
      if(!pinCorreto(pinAtual)){
        sacudirEl('pin-config-box');
        if(err) err.textContent='PIN atual incorreto.';
        setTimeout(()=>{ pinAtual=''; dots.forEach(d=>d.classList.remove('filled')); },600);
        return;
      }
      etapa='novo'; pinNovo='';
      if(sub) sub.textContent='Escolha um novo PIN de 4 dígitos.';
      setTimeout(()=>dots.forEach(d=>d.classList.remove('filled')),300);
      return;
    }
    if(etapa==='novo'){
      etapa='confirmar'; pinConf='';
      if(sub) sub.textContent='Digite o PIN novamente para confirmar.';
      setTimeout(()=>dots.forEach(d=>d.classList.remove('filled')),300);
      return;
    }
    if(etapa==='confirmar'){
      if(pinNovo!==pinConf){
        sacudirEl('pin-config-box');
        if(err) err.textContent='Os PINs não coincidem.';
        setTimeout(()=>{ etapa='novo'; pinNovo=''; pinConf=''; if(sub) sub.textContent='Escolha um novo PIN de 4 dígitos.'; dots.forEach(d=>d.classList.remove('filled')); },700);
        return;
      }
      salvarPin(pinNovo);
      const box=document.getElementById('pin-config-box');
      if(box) box.classList.add('pin-sucesso');
      setTimeout(()=>{ overlay.remove(); cleanupCfg(); window.showToast?.('🔐 PIN salvo com sucesso!'); atualizarUiPin(); },450);
    }
  };
  window.pinConfigCancelar=()=>{ overlay.remove(); cleanupCfg(); };
  window.pinRemoverConfirmar=async()=>{
    const ok=await solicitarPin({titulo:'Remover PIN',icone:'⚠️',subtitulo:'Digite o PIN atual para removê-lo.'});
    if(ok){ removerPin(); overlay.remove(); cleanupCfg(); window.showToast?.('PIN removido.'); atualizarUiPin(); }
  };
};

function atualizarUiPin(){
  const btn=document.getElementById('btn-pin');
  if(btn) btn.textContent=pinDefinido()?'🔐 Trocar PIN':'🔓 Criar PIN de segurança';
  const st=document.getElementById('pin-status');
  if(st) st.innerHTML=pinDefinido()?'🟢 PIN ativo — ações protegidas.':'🔴 PIN inativo — sem proteção extra.';
}

/* ── 4. INTERCEPTAR AÇÕES CRÍTICAS ── */
async function comPin(fn,opts={}){
  if(!pinDefinido()) return fn();
  const ok=await solicitarPin(opts);
  if(ok) return fn();
}

window.addEventListener('load',()=>{
  const oE=window.exportarBackup, oL=window.confirmarLimparDados, oS=window.salvarSenha, oI=window.importarBackup;
  window.exportarBackup      = async()=>comPin(()=>oE?.(),{titulo:'Exportar Backup',icone:'📦',subtitulo:'Confirme o PIN para exportar.'});
  window.confirmarLimparDados= async()=>comPin(()=>oL?.(),{titulo:'Apagar todos os dados',icone:'🗑️',subtitulo:'Confirme o PIN para apagar tudo.'});
  window.salvarSenha         = async()=>comPin(()=>oS?.(),{titulo:'Mudar senha da conta',icone:'🔑',subtitulo:'Confirme o PIN para trocar a senha.'});
  window.importarBackup      = async(input)=>comPin(()=>oI?.(input),{titulo:'Importar Backup',icone:'📂',subtitulo:'Confirme o PIN para substituir os dados.'});
});

/* ── 5. CARD DE PIN NA ABA CONFIGURAÇÕES ── */
(function patchRenderConfiguracoes(){
  function tentar(){
    if(typeof window.renderConfiguracoes!=='function'){ setTimeout(tentar,500); return; }
    const orig=window.renderConfiguracoes;
    window.renderConfiguracoes=function(){
      orig();
      setTimeout(()=>{
        if(document.getElementById('config-pin-section')) return;
        const target=document.getElementById('config-conta');
        if(!target) return;
        const sec=document.createElement('div');
        sec.className='config-section'; sec.id='config-pin-section';
        sec.innerHTML=`
          <div class="config-section-header">
            <div class="config-section-icon" style="background:rgba(155,114,232,0.12);color:var(--purple)">
              <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
            </div>
            <div><h3>PIN de Segurança</h3><p>Proteja ações críticas com um código numérico</p></div>
          </div>
          <div class="config-body">
            <p style="font-size:13px;color:var(--text2);line-height:1.6">
              Protege: <strong style="color:var(--text)">exportar backup, importar backup, apagar dados e mudar senha</strong>.
            </p>
            <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;background:var(--bg3);border:1px solid var(--border);margin-top:4px">
              <span id="pin-status" style="font-size:13px;color:var(--text2)">${pinDefinido()?'🟢 PIN ativo — ações protegidas.':'🔴 PIN inativo — sem proteção extra.'}</span>
            </div>
            <button type="button" id="btn-pin" class="config-save-btn" style="background:linear-gradient(135deg,var(--purple),#7b52c8);color:#fff;border:none;margin-top:4px"
              onclick="abrirConfigurarPin()">${pinDefinido()?'🔐 Trocar PIN':'🔓 Criar PIN de segurança'}</button>
          </div>`;
        target.parentNode.insertBefore(sec,target);
      },80);
    };
  }
  tentar();
})();

/* ── 6. SCROLL FIX ── */
document.addEventListener('DOMContentLoaded',()=>{
  const origToggle=window.toggleSidebar;
  window.toggleSidebar=function(){
    document.body.style.overflow='hidden';
    if(typeof origToggle==='function') origToggle();
    setTimeout(()=>{ document.body.style.overflow=''; },450);
  };
  const s=document.createElement('style');
  s.textContent=`
    html,body{overflow-x:hidden;}
    html::-webkit-scrollbar,body::-webkit-scrollbar{display:none;}
    html,body{scrollbar-width:none;-ms-overflow-style:none;}
    .sidebar{overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none;}
    .sidebar::-webkit-scrollbar{display:none;}
    .main-content{overflow-y:auto;height:100vh;scrollbar-width:thin;scrollbar-color:var(--border) transparent;}
    .main-content::-webkit-scrollbar{width:4px;}
    .main-content::-webkit-scrollbar-track{background:transparent;}
    .main-content::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;}
  `;
  document.head.appendChild(s);
});


/* ── 8. CSS DO MODAL DE PIN ── */
(()=>{
  const s=document.createElement('style');
  s.textContent=`
    #pin-modal-overlay,#pin-config-overlay{
      position:fixed;inset:0;z-index:9999;
      background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);
      display:flex;align-items:center;justify-content:center;
      animation:pinFadeIn .2s ease;
    }
    @keyframes pinFadeIn{from{opacity:0}to{opacity:1}}
    .pin-modal-box{
      background:var(--bg2,#13161d);border:1px solid var(--border,#252935);
      border-radius:24px;padding:36px 32px 28px;width:320px;max-width:95vw;
      display:flex;flex-direction:column;align-items:center;gap:14px;
      box-shadow:0 24px 64px rgba(0,0,0,0.6);
      animation:pinSlideUp .25s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes pinSlideUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}
    .pin-shake{animation:pinShk .5s cubic-bezier(.36,.07,.19,.97)!important}
    @keyframes pinShk{10%,90%{transform:translateX(-4px)}20%,80%{transform:translateX(6px)}30%,50%,70%{transform:translateX(-8px)}40%,60%{transform:translateX(8px)}}
    .pin-sucesso{border-color:var(--green,#3dd68c)!important;transition:border-color .2s}
    .pin-modal-icon{font-size:40px;line-height:1}
    .pin-modal-titulo{font-family:var(--font-head,'Outfit',sans-serif);font-size:18px;font-weight:700;color:var(--text,#f0f2f8);text-align:center;margin:0}
    .pin-modal-sub{font-size:13px;color:var(--text2,#8b92a8);text-align:center;line-height:1.5;margin:0}
    .pin-keyboard-hint{font-size:11px;color:var(--text3,#545c74);text-align:center;margin:-4px 0 0;opacity:.7}
    .pin-dots{display:flex;gap:14px;margin:6px 0}
    .pin-dot{width:16px;height:16px;border-radius:50%;border:2px solid var(--border,#252935);background:transparent;transition:background .15s,border-color .15s,transform .15s}
    .pin-dot.filled{background:var(--accent,#f0c040);border-color:var(--accent,#f0c040);transform:scale(1.15)}
    .pin-error-msg{font-size:12px;color:var(--red,#e05454);min-height:16px;text-align:center;border-radius:8px;padding:0 10px;transition:all .2s}
    .pin-error-msg:not(:empty){padding:8px 14px;background:rgba(224,84,84,0.1)}
    .pin-teclado{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%}
    .pin-key{background:var(--bg3,#1a1e27);border:1px solid var(--border,#252935);border-radius:12px;color:var(--text,#f0f2f8);font-family:var(--font-head,'Outfit',sans-serif);font-size:20px;font-weight:600;padding:14px 0;cursor:pointer;transition:background .15s,transform .1s,border-color .15s,box-shadow .1s;user-select:none}
    .pin-key:hover{background:var(--border,#252935);border-color:var(--text3,#545c74)}
    .pin-key:active,.pin-key-flash{transform:scale(.93);background:var(--accent,#f0c040);color:#0d0f14;border-color:var(--accent,#f0c040);box-shadow:0 0 0 3px rgba(240,192,64,0.3)}
    .pin-key-empty{pointer-events:none!important;background:transparent!important;border-color:transparent!important}
    .pin-key-del{font-size:22px;color:var(--text2,#8b92a8)}
    .pin-cancel-btn{background:none;border:1px solid var(--border,#252935);border-radius:10px;color:var(--text2,#8b92a8);cursor:pointer;font-family:var(--font-body,'Manrope',sans-serif);font-size:13px;padding:10px 24px;width:100%;transition:border-color .2s,color .2s}
    .pin-cancel-btn:hover{border-color:var(--text3,#545c74);color:var(--text,#f0f2f8)}
    .pin-danger-btn{background:rgba(224,84,84,0.1);border:1px solid rgba(224,84,84,0.25);border-radius:10px;color:var(--red,#e05454);cursor:pointer;font-family:var(--font-body,'Manrope',sans-serif);font-size:13px;padding:10px 24px;width:100%;transition:background .2s}
    .pin-danger-btn:hover{background:rgba(224,84,84,0.2)}
  `;
  document.head.appendChild(s);
})();
/* ===== [de app_patches.js] ===== */
(function patchLimparDados() {
  function tentar() {
    if (typeof window.confirmarLimparDados !== 'function') { setTimeout(tentar, 500); return; }

    // Guarda a referência original (que já pode estar wrappada pelo PIN)
    const origComPin = window.confirmarLimparDados;

    // Substitui a função base (antes do PIN a encapsular)
    window._limparDadosBase = async function() {
      const confirmado = await window.mostrarConfirm?.({
        icon: '🗑️',
        titulo: 'Limpar TODOS os dados?',
        mensagem: 'Essa ação é IRREVERSÍVEL. Gastos, salários, parcelados, recorrentes, entradas fixas, metas, cartões, pagamentos, backups automáticos e histórico de ações serão apagados permanentemente.',
        textoBotao: 'Sim, apagar absolutamente tudo',
        tipo: 'danger'
      });
      if (!confirmado) return;

      try {
        const fns = window.firebaseFns;
        const db  = window.firebaseDb;
        const uid = window.currentUser.uid;

        const cols = ['gastos','salarios','cartoes','metas','pagamentos','recorrentes','entradasFixas'];
        for (const col of cols) {
          const snap = await fns.getDocs(fns.collection(db, `users/${uid}/${col}`));
          for (const d of snap.docs) await fns.deleteDoc(d.ref);
        }

        // Apaga localStorage completamente (backups, histórico, preferências de tema NÃO)
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (
            k.startsWith('fapp_') ||
            k === 'fgab_security_pin' // NÃO remove o PIN — segurança deve manter
            // Mantém: cfg_theme, cfg_accent (preferências visuais)
          )) {
            // Remove tudo fapp_ exceto tema/accent
            if (k !== 'cfg_theme' && k !== 'cfg_accent') keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // Reset variáveis globais
        if (window.gastos)       window.gastos       = [];
        if (window.salarios)     window.salarios      = [];
        if (window.cartoes)      window.cartoes       = [];
        if (window.metas)        window.metas         = [];
        if (window.pagamentos)   window.pagamentos    = [];
        if (window.recorrentes)  window.recorrentes   = [];
        if (window.entradasFixas) window.entradasFixas= [];

        // undoStack
        if (typeof undoStack !== 'undefined') { try { undoStack.length = 0; } catch(e){} }

        window.showToast?.('✅ Todos os dados foram apagados. Conta zerada!');
        if (typeof window.switchTab === 'function') window.switchTab('dashboard');
        if (typeof window.renderDashboard === 'function') setTimeout(window.renderDashboard, 200);
      } catch(e) {
        window.showToast?.('❌ Erro ao limpar dados: ' + e.message);
      }
    };

    // Reaplica wrapper de PIN se existir
    window.addEventListener('_pinReady', function() {
      // já tratado pelo pin_security.js
    });

    // Substitui confirmarLimparDados considerando que o PIN já pode estar wrappando
    // Verificamos se há PIN definido; se sim, solicitamos antes
    window.confirmarLimparDados = async function() {
      if (typeof pinDefinido === 'function' && pinDefinido()) {
        const ok = await solicitarPin({ titulo: 'Apagar todos os dados', icone: '🗑️', subtitulo: 'Confirme o PIN para apagar tudo.' });
        if (!ok) return;
      }
      await window._limparDadosBase();
    };
  }
  tentar();
})();


/* ──────────────────────────────────────────────────────────────
   PATCH 6 — Ao apagar gasto da aba "Gastos", o valor NÃO
              deve retornar ao saldo líquido (sem undo de saldo)
   ────────────────────────────────────────────────────────────── */

/* ===== [de app_patches.js] ===== */
(function patchPinParaTudo() {
  // Aguarda PIN e funções estarem disponíveis
  function tentar() {
    if (typeof solicitarPin !== 'function' || typeof pinDefinido !== 'function') {
      setTimeout(tentar, 500);
      return;
    }

    // Helper
    async function comPinLocal(fn, opts) {
      if (!pinDefinido()) return fn();
      const ok = await solicitarPin(opts || {});
      if (ok) return fn();
    }

    // 1. Backup automático (download)
    if (typeof window.exportarBackupAuto === 'function') {
      const origAutoExport = window.exportarBackupAuto;
      window.exportarBackupAuto = async function(index) {
        await comPinLocal(() => origAutoExport(index), {
          titulo: 'Baixar Backup Automático',
          icone: '💾',
          subtitulo: 'Confirme o PIN para exportar o backup automático.'
        });
      };
    }

    // 2. exportarBackup (manual) — já patchado pelo pin_security.js mas garantimos
    if (typeof window.exportarBackup === 'function') {
      const origExport = window.exportarBackup;
      window.exportarBackup = async function() {
        await comPinLocal(origExport, {
          titulo: 'Exportar Backup',
          icone: '📦',
          subtitulo: 'Confirme o PIN para exportar.'
        });
      };
    }

    // 3. importarBackup — já patchado mas garantimos
    if (typeof window.importarBackup === 'function') {
      const origImport = window.importarBackup;
      window.importarBackup = async function(input) {
        await comPinLocal(() => origImport(input), {
          titulo: 'Importar Backup',
          icone: '📂',
          subtitulo: 'Confirme o PIN para substituir os dados.'
        });
      };
    }

    // 4. Alterar PIN — já tem PIN no fluxo interno, mas protegemos a abertura do modal
    if (typeof window.abrirConfigurarPin === 'function') {
      const origAbrirPin = window.abrirConfigurarPin;
      window.abrirConfigurarPin = async function() {
        // Se já tem PIN, exige confirmação antes de abrir a tela de trocar
        if (pinDefinido()) {
          const ok = await solicitarPin({
            titulo: 'Alterar PIN',
            icone: '🔐',
            subtitulo: 'Confirme o PIN atual para continuar.'
          });
          if (!ok) return;
        }
        origAbrirPin();
      };
      // Atualiza botão na UI
      const btn = document.getElementById('btn-pin');
      if (btn) btn.onclick = function() { window.abrirConfigurarPin(); };
    }

    // 5. confirmarLimparDados — já tratado no PATCH 5 mas garantimos aqui também
    // (O patch 5 já injeta a verificação de PIN)

  }

  // Tenta após carregamento completo
  if (document.readyState === 'complete') {
    setTimeout(tentar, 1000);
  } else {
    window.addEventListener('load', () => setTimeout(tentar, 1000));
  }
})();


/* ──────────────────────────────────────────────────────────────
   PATCH 9 — Botão "Marcar como pago" nos gastos "Sobrou do
              último mês" pendentes (não pagos na adição)
   ────────────────────────────────────────────────────────────── */

/* ===== [de /home/claude/work/app_senha_visivel.js] ===== */
/* ============================================================
   FINANCESAPP — MOSTRAR SENHA
   Adiciona um botão de "olho" em todo campo type="password"
   existente na página (login, cadastro e configurações),
   sem alterar o HTML original nem quebrar o layout.
   ============================================================ */

(function () {
  'use strict';

  const ICONE_OLHO = `
    <svg viewBox="0 0 24 24">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>`;

  const ICONE_OLHO_FECHADO = `
    <svg viewBox="0 0 24 24">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06"/>
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-3.22 4.44"/>
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>`;

  /* Envolve o input em um wrapper e injeta o botão de alternância */
  function tornarSenhaVisivel(input) {
    if (!input || input.closest('.senha-wrapper')) return; // já processado

    const wrapper = document.createElement('div');
    wrapper.className = 'senha-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'senha-toggle-btn';
    btn.setAttribute('aria-label', 'Mostrar senha');
    btn.setAttribute('aria-pressed', 'false');
    btn.tabIndex = 0;
    btn.innerHTML = ICONE_OLHO;
    wrapper.appendChild(btn);

    btn.addEventListener('click', function () {
      const estaMostrando = input.type === 'text';

      // Pequena animação de transição entre os ícones
      btn.classList.add('animando');
      setTimeout(() => {
        input.type = estaMostrando ? 'password' : 'text';
        btn.innerHTML = estaMostrando ? ICONE_OLHO : ICONE_OLHO_FECHADO;
        btn.setAttribute('aria-label', estaMostrando ? 'Mostrar senha' : 'Ocultar senha');
        btn.setAttribute('aria-pressed', String(!estaMostrando));
        btn.classList.remove('animando');
      }, 120);

      // Mantém o foco no campo após alternar, para não atrapalhar a digitação
      input.focus({ preventScroll: true });
    });
  }

  function iniciar() {
    document.querySelectorAll('input[type="password"]').forEach(tornarSenhaVisivel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  // Reaplica caso algum campo de senha seja inserido dinamicamente depois
  // (ex.: futuras telas de wizard/cadastro)
  const observer = new MutationObserver(function (mutations) {
    for (const m of mutations) {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('input[type="password"]')) tornarSenhaVisivel(node);
        node.querySelectorAll?.('input[type="password"]').forEach(tornarSenhaVisivel);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  console.log('[SenhaVisivel] Botão de mostrar senha ativo ✓');
})();

/* ===== [de /home/claude/work/app_sidebar_minimizada.js] ===== */
/* ============================================================
   FINANCESAPP — SIDEBAR MINIMIZADA (restaurar preferência)
   A lógica de colapsar/expandir já vive em toggleSidebar()
   (app.js). Aqui só restauramos o último estado escolhido
   pelo usuário, sem animação, assim que a página carrega.
   ============================================================ */

(function () {
  'use strict';

  function restaurarPreferenciaSidebar() {
    const sidebar = document.getElementById('sidebar');
    const btn     = document.getElementById('sidebar-toggle');
    const main    = document.querySelector('.main-content');
    if (!sidebar || !btn || !main) return;

    const deveEstarColapsada = localStorage.getItem('sidebar_collapsed') === 'true';
    if (!deveEstarColapsada) return;

    // Aplica o estado direto, sem disparar a animação de entrada,
    // para a sidebar já nascer minimizada como o usuário deixou.
    sidebar.classList.add('no-transition');
    main.classList.add('no-transition');
    btn.classList.add('no-transition');

    sidebar.classList.add('collapsed');
    btn.classList.add('rotated');
    btn.classList.remove('pulse'); // usuário já conhece o recurso
    btn.title = 'Expandir menu';
    main.style.marginLeft = 'var(--sidebar-w-collapsed)';
    main.style.width = 'calc(100vw - var(--sidebar-w-collapsed))';
    btn.style.left = 'var(--sidebar-w-collapsed)';
    btn.style.transform = 'translateY(-50%) translateX(-50%)';

    // Reativa as transições no próximo quadro, para os próximos toggles animarem
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        sidebar.classList.remove('no-transition');
        main.classList.remove('no-transition');
        btn.classList.remove('no-transition');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restaurarPreferenciaSidebar);
  } else {
    restaurarPreferenciaSidebar();
  }
})();

/* ===== [de /home/claude/work/app_foto_perfil.js] ===== */
/* ============================================================
   FINANCESAPP — FOTO DE PERFIL
   Upload (JPEG/PNG), preview, recorte (crop) e remoção da foto.
   A foto é salva no Firebase Storage em avatars/{uid}.jpg e o
   link é gravado em photoURL do usuário (Firebase Auth).
   ============================================================ */

(function () {
  'use strict';

  const TAMANHO_MAX_MB   = 5;
  const CANVAS_TELA      = 320;   // tamanho do canvas exibido no modal
  const SAIDA_PX         = 480;   // resolução final salva da foto

  const estado = {
    img: null,
    escalaBase: 1,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    arrastando: false,
    ultimoX: 0,
    ultimoY: 0
  };

  /* ────────────────────────────────────────────────
     RENDER — avatar (config + mini avatar da sidebar)
     ──────────────────────────────────────────────── */
  function iniciaisDoUsuario(user) {
    const base = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
    if (!base) return '?';
    const partes = base.split(/\s+/).filter(Boolean);
    const letras = partes.length > 1
      ? (partes[0][0] + partes[partes.length - 1][0])
      : base.slice(0, 2);
    return letras.toUpperCase();
  }

  function renderAvatarPerfil() {
    const user = window.currentUser;
    if (!user) return;

    const iniciais = iniciaisDoUsuario(user);
    const temFoto  = !!user.photoURL;

    // Avatar grande — Configurações > Perfil
    const spanCfg = document.getElementById('perfil-foto-iniciais');
    const imgCfg  = document.getElementById('perfil-foto-img');
    if (spanCfg && imgCfg) {
      if (temFoto) {
        imgCfg.loading  = 'lazy';
        imgCfg.decoding = 'async';
        imgCfg.src = user.photoURL;
        imgCfg.style.display = 'block';
        spanCfg.style.display = 'none';
      } else {
        imgCfg.style.display = 'none';
        spanCfg.style.display = 'block';
        spanCfg.textContent = iniciais;
      }
    }
    const btnRemover = document.getElementById('perfil-foto-remover-btn');
    if (btnRemover) btnRemover.style.display = temFoto ? 'inline-block' : 'none';

    // Mini avatar — rodapé da sidebar
    const spanSide = document.getElementById('sidebar-user-iniciais');
    const imgSide  = document.getElementById('sidebar-user-img');
    if (spanSide && imgSide) {
      if (temFoto) {
        imgSide.loading  = 'lazy';
        imgSide.decoding = 'async';
        imgSide.src = user.photoURL;
        imgSide.style.display = 'block';
        spanSide.style.display = 'none';
      } else {
        imgSide.style.display = 'none';
        spanSide.style.display = 'block';
        spanSide.textContent = iniciais;
      }
    }
    const nomeSide = document.getElementById('sidebar-user-nome');
    if (nomeSide) {
      nomeSide.textContent = user.displayName || user.email?.split('@')[0] || 'Minha conta';
    }
  }
  window.renderAvatarPerfil = renderAvatarPerfil;

  /* ────────────────────────────────────────────────
     SELEÇÃO DE ARQUIVO
     ──────────────────────────────────────────────── */
  function aoSelecionarArquivo(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite selecionar o mesmo arquivo de novo depois
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      window.showToast?.('❌ Envie uma imagem JPEG ou PNG.');
      return;
    }
    if (file.size > TAMANHO_MAX_MB * 1024 * 1024) {
      window.showToast?.(`❌ A imagem deve ter até ${TAMANHO_MAX_MB}MB.`);
      return;
    }

    const leitor = new FileReader();
    leitor.onload = function (ev) {
      const img = new Image();
      img.onload = function () {
        abrirCropFoto(img);
      };
      img.onerror = function () {
        window.showToast?.('❌ Não foi possível ler essa imagem.');
      };
      img.src = ev.target.result;
    };
    leitor.readAsDataURL(file);
  }

  /* ────────────────────────────────────────────────
     MODAL DE RECORTE
     ──────────────────────────────────────────────── */
  function abrirCropFoto(img) {
    estado.img = img;
    estado.escalaBase = Math.max(CANVAS_TELA / img.width, CANVAS_TELA / img.height);
    estado.zoom = 1;
    estado.offsetX = 0;
    estado.offsetY = 0;

    const zoomInput = document.getElementById('crop-zoom');
    if (zoomInput) zoomInput.value = '1';

    desenharCrop();
    document.getElementById('modal-crop-foto')?.classList.add('open');
  }

  window.fecharCropFoto = function () {
    document.getElementById('modal-crop-foto')?.classList.remove('open');
    estado.img = null;
  };

  function desenharCrop() {
    const canvas = document.getElementById('crop-canvas');
    if (!canvas || !estado.img) return;
    const ctx = canvas.getContext('2d');
    const escala = estado.escalaBase * estado.zoom;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 + estado.offsetX, canvas.height / 2 + estado.offsetY);
    ctx.scale(escala, escala);
    ctx.drawImage(estado.img, -estado.img.width / 2, -estado.img.height / 2);
    ctx.restore();
  }

  // Arraste para reposicionar (mouse e toque)
  function ligarArrasteCanvas() {
    const canvas = document.getElementById('crop-canvas');
    if (!canvas) return;

    canvas.addEventListener('pointerdown', function (e) {
      if (!estado.img) return;
      estado.arrastando = true;
      estado.ultimoX = e.clientX;
      estado.ultimoY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!estado.arrastando) return;
      estado.offsetX += e.clientX - estado.ultimoX;
      estado.offsetY += e.clientY - estado.ultimoY;
      estado.ultimoX = e.clientX;
      estado.ultimoY = e.clientY;
      desenharCrop();
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt =>
      canvas.addEventListener(evt, () => { estado.arrastando = false; })
    );

    const zoomInput = document.getElementById('crop-zoom');
    zoomInput?.addEventListener('input', function () {
      estado.zoom = parseFloat(zoomInput.value) || 1;
      desenharCrop();
    });
  }

  // ── FIX: upload travando indefinidamente em "Salvando..." ──────────
  // Causa raiz: nenhuma das etapas assíncronas (gerar o blob da imagem via
  // canvas.toBlob, enviar ao Storage, obter a URL, atualizar o perfil) tinha
  // um limite de tempo. Se o navegador nunca chamar o callback do toBlob()
  // (comum em dispositivos com pouca memória) ou se a requisição de rede
  // travar (conexão instável, bloqueio por extensão/ad-blocker, proxy
  // corporativo, etc.), a Promise correspondente nunca se resolve NEM
  // rejeita. Como tudo roda dentro de um único await/try, o bloco `finally`
  // também nunca chega a executar — e o botão fica preso em "Salvando..."
  // para sempre, sem erro e sem sucesso.
  // A correção envolve cada etapa com um timeout: assim toda a operação
  // SEMPRE se resolve (com sucesso ou com um erro claro ao usuário), o
  // `finally` sempre roda e a UI nunca fica travada.
  function comTimeout(promise, ms, mensagemTimeout) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(mensagemTimeout)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  window.confirmarCropFoto = async function () {
    if (!estado.img) return;
    const user = window.currentUser;
    if (!user) return;

    const btn = document.getElementById('crop-confirmar-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
      // Redesenha em resolução final, aplicando a mesma transformação
      const fator = SAIDA_PX / CANVAS_TELA;
      const saida = document.createElement('canvas');
      saida.width = SAIDA_PX;
      saida.height = SAIDA_PX;
      const ctx = saida.getContext('2d');
      const escala = estado.escalaBase * estado.zoom * fator;

      ctx.save();
      ctx.translate(SAIDA_PX / 2 + estado.offsetX * fator, SAIDA_PX / 2 + estado.offsetY * fator);
      ctx.scale(escala, escala);
      ctx.drawImage(estado.img, -estado.img.width / 2, -estado.img.height / 2);
      ctx.restore();

      const blob = await comTimeout(
        new Promise((resolve, reject) => {
          try {
            saida.toBlob(b => b ? resolve(b) : reject(new Error('Falha ao gerar imagem.')), 'image/jpeg', 0.88);
          } catch (e) { reject(e); }
        }),
        15000,
        'Tempo esgotado ao processar a imagem. Tente novamente.'
      );

      const { ref, uploadBytes, getDownloadURL, updateProfile } = window.firebaseFns || {};
      if (!window.firebaseStorage || !ref || !uploadBytes || !getDownloadURL || !updateProfile) {
        throw new Error('Serviço de armazenamento indisponível. Recarregue a página e tente novamente.');
      }
      const caminho = ref(window.firebaseStorage, `avatars/${user.uid}.jpg`);

      await comTimeout(
        uploadBytes(caminho, blob, { contentType: 'image/jpeg' }),
        30000,
        'Tempo esgotado ao enviar a foto. Verifique sua conexão e tente novamente.'
      );
      const url = await comTimeout(
        getDownloadURL(caminho),
        15000,
        'Tempo esgotado ao obter o link da foto. Tente novamente.'
      );
      await comTimeout(
        updateProfile(user, { photoURL: url }),
        15000,
        'Tempo esgotado ao atualizar o perfil. Tente novamente.'
      );

      renderAvatarPerfil();
      window.showToast?.('📸 Foto de perfil atualizada!');
      window.fecharCropFoto();
    } catch (err) {
      console.error('[FotoPerfil] erro ao salvar', err);
      window.showToast?.('❌ Erro ao salvar a foto: ' + (err.message || err));
    } finally {
      // Sempre restaura o botão, mesmo se qualquer etapa acima travar —
      // cada await agora tem um teto máximo de espera garantido acima.
      if (btn) { btn.disabled = false; btn.textContent = 'Salvar foto'; }
    }
  };

  /* ────────────────────────────────────────────────
     REMOVER FOTO
     ──────────────────────────────────────────────── */
  window.removerFotoPerfil = async function () {
    const user = window.currentUser;
    if (!user || !user.photoURL) return;
    if (!confirm('Remover sua foto de perfil?')) return;

    try {
      const { ref, deleteObject, updateProfile } = window.firebaseFns;
      // Remoção do arquivo é best-effort: se não existir mais, seguimos em frente
      try { await deleteObject(ref(window.firebaseStorage, `avatars/${user.uid}.jpg`)); } catch (e) {}
      await updateProfile(user, { photoURL: null });
      renderAvatarPerfil();
      window.showToast?.('🗑️ Foto de perfil removida.');
    } catch (err) {
      console.error('[FotoPerfil] erro ao remover', err);
      window.showToast?.('❌ Erro ao remover a foto: ' + (err.message || err));
    }
  };

  /* ────────────────────────────────────────────────
     INICIALIZAÇÃO
     ──────────────────────────────────────────────── */
  function iniciar() {
    document.getElementById('perfil-foto-input')?.addEventListener('change', aoSelecionarArquivo);
    ligarArrasteCanvas();

    // Atualiza os avatares assim que o usuário estiver disponível
    let tentativas = 0;
    const espera = setInterval(() => {
      tentativas++;
      if (window.currentUser) {
        clearInterval(espera);
        renderAvatarPerfil();
      } else if (tentativas > 100) { // ~30s
        clearInterval(espera);
      }
    }, 300);

    // Também re-renderiza sempre que a tela de Configurações abrir
    const origRenderConfig = window.renderConfiguracoes;
    if (typeof origRenderConfig === 'function') {
      window.renderConfiguracoes = function () {
        origRenderConfig.apply(this, arguments);
        renderAvatarPerfil();
      };
    }

    // Mantém sincronizado quando o nome é alterado (iniciais mudam)
    if (window.AppBus?.on) {
      window.AppBus.on('nome_alterado', renderAvatarPerfil);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  console.log('[FotoPerfil] Upload/recorte de foto de perfil ativo ✓');
})();
