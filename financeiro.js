/* ============================================================
   FINANCESAPP — financeiro.js
   Toda a lógica financeira: gastos, receitas/entradas, cartões,
   parcelamentos, dívidas/atrasos, salários, recorrentes, metas,
   pagamentos, divisão de contas, calendário financeiro e
   lembretes de entradas. Cálculos e atualização de saldo/listas.
   ============================================================ */


/* ===== [de app.js] app.js ===== */
let gastos      = [];
let salarios    = [];
let cartoes     = [];
let metas       = [];
let pagamentos  = [];
let recorrentes = [];
let entradasFixas = [];
// ===== RENDA =====
let editandoGastoId = null;
let editandoRecorrenteId = null;
let recDivisivel = null; // null = não respondido, true = sim, false = não

// ===== UNDO / HISTÓRICO =====
let calMesAtual       = new Date().getMonth();
let calAnoAtual       = new Date().getFullYear();
let calDiaSelecionado = null;

// ============ INICIALIZAÇÃO ============
function setDefaultDate() {
  const today    = new Date().toISOString().split('T')[0];
  const monthNow = new Date().toISOString().slice(0, 7);
  document.getElementById('m-data').value        = today;
  document.getElementById('sal-mes').value        = monthNow;
  const salExtraData = document.getElementById('sal-extra-data');
  if (salExtraData) salExtraData.value = today;
  const filterStart = document.getElementById('filter-start');
  const filterEnd   = document.getElementById('filter-end');
  if (filterStart) filterStart.value = `${monthNow}-01`;
  if (filterEnd) {
    const agora = new Date();
    const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    filterEnd.value = `${monthNow}-${String(ultimoDia).padStart(2, '0')}`;
  }
  const pagosStart = document.getElementById('pagos-start');
  const pagosEnd   = document.getElementById('pagos-end');
  const atrasoMes  = document.getElementById('atraso-mes');
  if (pagosStart) pagosStart.value = `${monthNow}-01`;
  if (pagosEnd) {
    const agora = new Date();
    const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    pagosEnd.value = `${monthNow}-${String(ultimoDia).padStart(2, '0')}`;
  }
  if (atrasoMes) atrasoMes.value = monthNow;
}

// ============ FIREBASE HELPERS ============
window.toggleParcelas = function () {
  const cat = document.getElementById('m-cat').value;
  const pg  = document.getElementById('parcelas-group');
  const cg  = document.getElementById('cartao-group');
  const vg  = document.getElementById('vencimento-group');
  const dg  = document.getElementById('data-group');
  const descg = document.getElementById('desc-group');
  const isParc = cat === 'Compras parceladas';
  const isRec  = cat === 'Compras recorrentes';
  const isFut  = cat === 'Compras futuras';

  pg.style.display    = isParc ? 'flex' : 'none';
  cg.style.display    = (isParc || isRec || isFut) ? 'flex' : 'none';
  vg.style.display    = (isParc || isRec) ? 'flex' : 'none';
  dg.style.display    = isRec ? 'none' : 'flex';
  descg.style.display = isRec ? 'none' : 'flex';

  if (isRec) document.getElementById('data-error').style.display = 'none';

  const cartaoLabel = document.getElementById('cartao-label');
  if (cartaoLabel) {
    if (isRec) cartaoLabel.textContent = 'Para quem devo pagar';
    else if (isFut) cartaoLabel.textContent = 'Qual cartão pagar';
    else cartaoLabel.textContent = 'Cartão utilizado';
  }

  const vencLabel = document.getElementById('vencimento-label');
  if (vencLabel) vencLabel.textContent = isRec ? 'Dia que vence' : 'Dia de vencimento da fatura';

  const lojaLabel = document.getElementById('loja-label');
  if (lojaLabel) lojaLabel.textContent = isRec ? 'Nome da compra recorrente' : 'Loja / Estabelecimento';

  // Campo divisível: só aparece para recorrentes
  const divGroup = document.getElementById('divisivel-group');
  if (divGroup) divGroup.style.display = isRec ? 'flex' : 'none';
  if (!isRec) recDivisivel = null; // limpa ao mudar de categoria

  // Para compras futuras, remover restrição de data futura no campo
  const mDataInput = document.getElementById('m-data');
  if (mDataInput) {
    if (isFut) {
      mDataInput.removeAttribute('max');
      mDataInput.removeAttribute('oninput');
      document.getElementById('data-error').style.display = 'none';
    } else {
      mDataInput.setAttribute('oninput', 'validarData()');
    }
  }
};

// ============ CAMPO DIVISÍVEL 15/30 ============
window.setDivisivel = function (val) {
  recDivisivel = val;
  _renderDivisivelBtns();
  atualizarHintDivisivel();
};

window.atualizarHintDivisivel = function () {
  const hint   = document.getElementById('divisivel-hint');
  const vencDia = parseInt(document.getElementById('m-vencimento')?.value) || null;
  if (!hint) return;
  if (recDivisivel === true) {
    hint.textContent = '✂️ Será incluído na Divisão 15/30 e dividido igualmente entre o dia 15 e o dia 30.';
    hint.style.color = 'var(--accent)';
  } else if (recDivisivel === false) {
    const diaTexto = vencDia ? `dia ${vencDia}` : 'o dia de vencimento';
    hint.textContent = `📅 Não entra na Divisão 15/30. Aparecerá no calendário integralmente no ${diaTexto}.`;
    hint.style.color = 'var(--blue)';
  } else {
    hint.textContent = '';
  }
};

function _renderDivisivelBtns() {
  const btnSim = document.getElementById('divisivel-btn-sim');
  const btnNao = document.getElementById('divisivel-btn-nao');
  if (!btnSim || !btnNao) return;

  // Reset ambos
  [btnSim, btnNao].forEach(b => {
    b.style.borderColor = 'var(--border)';
    b.style.background  = 'var(--bg3)';
    b.style.color       = 'var(--text2)';
    b.style.fontWeight  = '400';
  });

  if (recDivisivel === true) {
    btnSim.style.borderColor = 'var(--accent)';
    btnSim.style.background  = 'rgba(240,192,64,0.12)';
    btnSim.style.color       = 'var(--accent)';
    btnSim.style.fontWeight  = '700';
  } else if (recDivisivel === false) {
    btnNao.style.borderColor = 'var(--blue)';
    btnNao.style.background  = 'rgba(77,157,224,0.10)';
    btnNao.style.color       = 'var(--blue)';
    btnNao.style.fontWeight  = '700';
  }
}

function populateCartaoSelect() {
  const sel = document.getElementById('m-cartao');
  const catAtual = document.getElementById('m-cat')?.value;
  const placeholder = catAtual === 'Compras parceladas'
    ? '<option value="">Selecione o cartão...</option>'
    : '<option value="">Selecione...</option>';
  sel.innerHTML = placeholder
    + cartoes.map(c => `<option value="${c.id}">${escHtml(c.nome)}</option>`).join('')
    + '<option value="__novo__">+ Cadastrar novo cartão</option>';
}

// Ao escolher um cartão na compra parcelada, preenche automaticamente o dia
// de vencimento cadastrado nesse cartão (o usuário ainda pode ajustar).
window.aoEscolherCartaoGasto = function () {
  const sel = document.getElementById('m-cartao');
  if (!sel) return;
  if (sel.value === '__novo__') {
    sel.value = '';
    switchTab('cartoes');
    showToast('💳 Cadastre o novo cartão aqui e volte para lançar a compra.');
    return;
  }
  const cat = document.getElementById('m-cat')?.value;
  if (cat !== 'Compras parceladas') return;
  const c = cartoes.find(x => x.id === sel.value);
  const vencInput = document.getElementById('m-vencimento');
  if (c && c.vencimentoDia && vencInput) {
    vencInput.value = c.vencimentoDia;
    atualizarHintDivisivel();
  }
};

// ============ VALIDAR DATA ============
window.validarData = function () {
  const cat   = document.getElementById('m-cat')?.value || '';
  if (cat === 'Compras futuras') return; // datas futuras permitidas
  const val   = document.getElementById('m-data').value;
  const errEl = document.getElementById('data-error');
  const errTx = document.getElementById('data-error-text');
  if (!val) { errEl.style.display = 'none'; return; }
  const [y, m, d] = val.split('-').map(Number);
  const sel  = new Date(y, m - 1, d);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (sel > hoje) {
    errTx.textContent = 'A data não pode ser no futuro para esta categoria.';
    errEl.style.display = 'flex';
  } else {
    errEl.style.display = 'none';
  }
};

// ============ SALVAR GASTO ============
window.salvarGasto = async function () {
  const cat       = document.getElementById('m-cat').value;
  const valor     = parseFloat(document.getElementById('m-valor').value);
  const data      = document.getElementById('m-data').value;
  const loja      = document.getElementById('m-loja').value.trim();
  const desc      = document.getElementById('m-desc').value.trim();
  const parcNum   = parseInt(document.getElementById('m-parcelas').value) || 1;
  const cartaoId  = document.getElementById('m-cartao').value;
  const vencDia   = parseInt(document.getElementById('m-vencimento').value) || null;
  const isRecCat  = cat === 'Compras recorrentes';

  if (!valor || valor <= 0)  { showToast('⚠️ Informe um valor válido'); return; }
  if (!isRecCat && !data)     { showToast('⚠️ Informe a data');         return; }
  if (!loja)                  { showToast(isRecCat ? '⚠️ Informe o nome da compra recorrente' : '⚠️ Informe a loja'); return; }
  if ((cat === 'Compras parceladas' || isRecCat) && !vencDia) { showToast('⚠️ Informe o dia de vencimento'); return; }
  if (isRecCat && !cartaoId)  { showToast('⚠️ Informe para quem deve pagar'); return; }
  if (cat === 'Compras parceladas' && !cartaoId) { showToast('⚠️ Selecione o cartão usado nessa compra'); return; }
  if (isRecCat && recDivisivel === null) { showToast('⚠️ Informe se entra na Divisão 15/30'); return; }

  if (!isRecCat) {
    const [y, m, d] = data.split('-').map(Number);
    const sel  = new Date(y, m - 1, d);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    // Compras futuras podem ter data futura — não bloquear
    if (sel > hoje && cat !== 'Compras futuras') { showToast('⚠️ Data não pode ser no futuro'); return; }
  }

  const cartaoObj = cartoes.find(c => c.id === cartaoId);

  if (isRecCat) {
    try {
      const { collection, addDoc, doc, updateDoc } = fns();
      const mesAtual = new Date().toISOString().slice(0, 7);
      const hoje = new Date();
      const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
      const dataVenc = `${mesAtual}-${String(Math.min(vencDia, ultimoDiaMes)).padStart(2, '0')}`;
      const rec = {
        categoria: 'Compras recorrentes',
        valor,
        loja,
        descricao: desc,
        cartaoId,
        cartaoNome: cartaoObj?.nome || '',
        vencimentoDia: vencDia,
        divisivel: recDivisivel === true,
        ativo: true,
        criadoEm: new Date().toISOString()
      };
      if (editandoRecorrenteId) {
        const existente = recorrentes.find(r => r.id === editandoRecorrenteId);
        if (!existente) { showToast('⚠️ Recorrente não encontrado'); return; }

        await updateDoc(doc(db(), `users/${uid()}/recorrentes`, editandoRecorrenteId), {
          ...rec,
          criadoEm: existente.criadoEm || rec.criadoEm,
          atualizadoEm: new Date().toISOString()
        });

        const gastosDoMes = gastos.filter(g =>
          g.recorrenteId === editandoRecorrenteId &&
          g.data &&
          g.data.startsWith(mesAtual)
        );
        await Promise.all(gastosDoMes.map(g => updateDoc(doc(db(), `users/${uid()}/gastos`, g.id), {
          categoria: 'Compras recorrentes',
          valor,
          data: dataVenc,
          loja,
          descricao: `Pagar para: ${cartaoObj?.nome || ''}`,
          cartaoId,
          cartaoNome: cartaoObj?.nome || '',
          vencimentoDia: vencDia,
          atualizadoEm: new Date().toISOString()
        })));

        await loadRecorrentes();
        await loadGastos();
        closeModal();
        showToast('✅ Recorrente atualizado!');
        renderDashboard();
        renderGastosList();
        renderRecorrentes();
        if (currentTab === 'calendario') renderCalendario();
        return;
      }
      const recRef = await addDoc(collection(db(), `users/${uid()}/recorrentes`), rec);
      const gasto = {
        categoria: 'Compras recorrentes',
        valor,
        data: dataVenc,
        loja,
        descricao: `Pagar para: ${cartaoObj?.nome || ''}`,
        parcelas: 1,
        parcelaPaga: 1,
        parcelasPagas: [],
        cartaoId,
        cartaoNome: cartaoObj?.nome || '',
        vencimentoDia: vencDia,
        recorrente: true,
        recorrenteId: recRef.id,
        criadoEm: new Date().toISOString()
      };
      const gastoRef = await addDoc(collection(db(), `users/${uid()}/gastos`), gasto);
      undoStack.push({ tipo: 'addGasto', id: gastoRef.id, dados: gasto, timestamp: Date.now(), descricao: `Recorrente: ${loja} ${fmtR(valor)}` });
      if (undoStack.length > 20) undoStack.shift();
      await loadRecorrentes();
      await loadGastos();
      closeModal();
      showToast('✅ Compra recorrente criada!', true);
      if (currentTab === 'dashboard') renderDashboard();
      if (currentTab === 'gastos') renderGastosList();
      if (currentTab === 'recorrentes') renderRecorrentes();
      if (currentTab === 'calendario') renderCalendario();
      return;
    } catch (e) {
      showToast('❌ Erro ao salvar recorrente: ' + e.message);
      return;
    }
  }

  if (editandoGastoId) {
    const existente = gastos.find(g => g.id === editandoGastoId);
    if (!existente) { showToast('⚠️ Gasto não encontrado'); return; }

    const atualizado = existente.categoria === 'Compras parceladas'
      ? (() => {
          const parcelasPagas = Array.isArray(existente.parcelasPagas)
            ? existente.parcelasPagas.filter(p => p.num <= parcNum)
            : [];
          return {
            categoria: 'Compras parceladas',
            valor,
            data,
            loja,
            descricao: desc,
            parcelas: parcNum,
            parcelaPaga: parcelasPagas.length,
            parcelasPagas,
            cartaoId: cartaoId || null,
            cartaoNome: cartaoObj?.nome || '',
            vencimentoDia: vencDia,
            parcelasValores: Array.isArray(existente.parcelasValores)
              ? existente.parcelasValores.filter(p => p.num <= parcNum)
              : [],
            recorrente: false,
            atualizadoEm: new Date().toISOString()
          };
        })()
      : {
          categoria: existente.categoria,
          valor,
          data,
          loja,
          descricao: desc,
          parcelas: 1,
          parcelaPaga: 1,
          parcelasPagas: [],
          cartaoId: null,
          cartaoNome: '',
          vencimentoDia: null,
          recorrente: false,
          atualizadoEm: new Date().toISOString()
        };

    try {
      const { doc, updateDoc } = fns();
      await updateDoc(doc(db(), `users/${uid()}/gastos`, editandoGastoId), atualizado);
      await loadGastos();
      closeModal();
      showToast(existente.categoria === 'Compras parceladas' ? '✅ Parcelado atualizado!' : '✅ Gasto atualizado!', true);
      renderDashboard();
      renderGastosList();
      renderParcelados();
      if (currentTab === 'extrato') renderExtrato();
      if (currentTab === 'calendario') renderCalendario();
    } catch (e) {
      showToast('❌ Erro ao atualizar: ' + e.message);
    }
    return;
  }

  const isFutura = cat === 'Compras futuras';

  const gasto = {
    categoria:   cat,
    valor,
    data,
    loja,
    descricao:   desc,
    parcelas:    cat === 'Compras parceladas' ? parcNum : 1,
    parcelaPaga: 0,
    parcelasPagas: [],
    cartaoId:    (cat === 'Compras parceladas' || isFutura) ? (cartaoId || null) : null,
    cartaoNome:  (cat === 'Compras parceladas' || isFutura) ? (cartaoObj?.nome || '') : '',
    vencimentoDia: cat === 'Compras parceladas' ? vencDia : null,
    recorrente:  false,
    // Para compras futuras: aguardando aprovação
    statusFutura: isFutura ? null : undefined,
    criadoEm:   new Date().toISOString()
  };

  // Remove chave undefined do objeto
  if (!isFutura) delete gasto.statusFutura;

  try {
    const { collection, addDoc } = fns();
    const docRef = await addDoc(collection(db(), `users/${uid()}/gastos`), gasto);
    gasto.id = docRef.id;

    // Push undo
    undoStack.push({ tipo: 'addGasto', id: docRef.id, dados: gasto, timestamp: Date.now(), descricao: `Gasto: ${loja} ${fmtR(valor)}` });
    if (undoStack.length > 20) undoStack.shift();

    await loadGastos();
    closeModal();
    if (isFutura) {
      showToast('🔮 Compra futura registrada! Aguardando aprovação.', true);
      switchGastosSubtab('pendentes');
    } else {
      showToast('✅ Gasto adicionado!', true);
    }
    if (currentTab === 'dashboard')  renderDashboard();
    if (currentTab === 'gastos')     { renderGastosList(); renderFuturasList(); renderReprovadosList(); atualizarBadgesFuturas(); }
    if (currentTab === 'extrato')    renderExtrato();
    if (currentTab === 'parcelados') renderParcelados();
    if (currentTab === 'calendario') renderCalendario();
  } catch (e) {
    showToast('❌ Erro ao salvar: ' + e.message);
  }
};

// ============ DELETAR GASTO (com modal customizado) ============
window.deletarGasto = async function (id, skipConfirm) {
  const g = gastos.find(x => x.id === id);
  if (!g) return;

  if (!skipConfirm) {
    confirmarAcao({
      titulo: 'Remover gasto',
      mensagem: `Deseja remover <b>${escHtml(g.loja)}</b> (${fmtR(g.valor)})?`,
      icone: '🗑️',
      tipoBotao: 'danger',
      textoBotao: 'Sim, remover',
      onConfirm: () => deletarGasto(id, true)
    });
    return;
  }

  const { doc, deleteDoc } = fns();
  // Salva para undo antes de deletar
  undoStack.push({ tipo: 'deleteGasto', dados: { ...g }, timestamp: Date.now(), descricao: `Excluiu: ${g.loja} ${fmtR(g.valor)}` });
  if (undoStack.length > 20) undoStack.shift();

  await deleteDoc(doc(db(), `users/${uid()}/gastos`, id));
  await loadGastos();
  showToast('🗑️ Gasto removido', true);
  renderDashboard();
  renderGastosList();
  renderParcelados();
  if (currentTab === 'extrato') renderExtrato();
  if (currentTab === 'calendario') renderCalendario();
};

// ============ CANCELAR RECORRENTE ============
window.cancelarRecorrente = async function (recId) {
  confirmarAcao({
    titulo: 'Cancelar recorrente',
    mensagem: 'Deseja cancelar? Os lançamentos deste mês em diante também serão removidos.',
    icone: '🔕',
    tipoBotao: 'warning',
    textoBotao: 'Sim, cancelar',
    onConfirm: async () => {
      const { doc, updateDoc, deleteDoc } = fns();
      await updateDoc(doc(db(), `users/${uid()}/recorrentes`, recId), { ativo: false });
      const mesAtual = new Date().toISOString().slice(0, 7);
      const vinculados = gastos.filter(g => g.recorrenteId === recId && g.data >= mesAtual + '-01');
      await Promise.all(vinculados.map(g => deleteDoc(doc(db(), `users/${uid()}/gastos`, g.id))));
      await loadRecorrentes();
      await loadGastos();
      showToast('🔕 Recorrente cancelado e lançamentos removidos');
      renderGastosList();
      renderRecorrentes();
      renderDashboard();
      renderDivisao();
      if (currentTab === 'calendario') renderCalendario();
    }
  });
};

window.marcarRecorrenteComoPago = async function (recId) {
  const r = recorrentes.find(x => x.id === recId);
  if (!r) return;
  const mes = new Date().toISOString().slice(0, 7);
  const key = recorrentePagamentoKey(recId, mes);

  if (recorrentePagoMes(recId, mes)) {
    showToast('✅ Esse recorrente já foi pago neste mês.');
    return;
  }

  if (!recorrenteVencidaNoMes(r, mes)) {
    showToast(`⚠️ Esse recorrente vence em ${formatData(dataRecorrenteNoMes(r, mes))}.`);
    return;
  }

  confirmarAcao({
    titulo: 'Marcar recorrente como pago',
    mensagem: `Confirmar pagamento de <b>${escHtml(r.loja || 'Recorrente')}</b> no valor de <b>${fmtR(r.valor || 0)}</b>?`,
    icone: '✅',
    tipoBotao: 'info',
    textoBotao: 'Marcar como pago',
    onConfirm: async () => {
      const { collection, addDoc } = fns();
      const dia = parseInt(dataRecorrenteNoMes(r, mes).slice(8, 10));
      const docRef = await addDoc(collection(db(), `users/${uid()}/pagamentos`), {
        mes,
        dia,
        valor: parseFloat(r.valor) || 0,
        valorSaldo: parseFloat(r.valor) || 0,
        tipo: 'recorrente',
        descricao: `Recorrente: ${r.loja || 'Recorrente'}`,
        recorrenteId: recId,
        recorrenteKey: key,
        cartaoId: r.cartaoId || null,
        cartaoNome: r.cartaoNome || '',
        criadoEm: new Date().toISOString()
      });
      pagamentos.push({ id: docRef.id, mes, dia, valor: parseFloat(r.valor) || 0, valorSaldo: parseFloat(r.valor) || 0, tipo: 'recorrente', descricao: `Recorrente: ${r.loja || 'Recorrente'}`, recorrenteId: recId, recorrenteKey: key });
      await loadPagamentos();
      showToast('✅ Recorrente pago e saldo atualizado!', true);
      renderRecorrentes();
      renderDashboard();
      renderDivisao();
      if (currentTab === 'calendario') renderCalendario();
    }
  });
};
function renderRecorrentes() {
  const list = document.getElementById('recorrentes-list');
  if (!list) return;

  const ativos = recorrentes.filter(r => r.ativo !== false);
  if (!ativos.length) {
    list.innerHTML = '<p style="color:var(--text3);font-size:14px;padding:20px 0">Nenhuma compra recorrente cadastrada.</p>';
    return;
  }

  const mesAtual = new Date().toISOString().slice(0, 7);
  list.innerHTML = ativos
    .sort((a, b) => (a.vencimentoDia || 99) - (b.vencimentoDia || 99))
    .map(r => {
      const pago = recorrentePagoMes(r.id, mesAtual);
      const vencida = recorrenteVencidaNoMes(r, mesAtual);
      return `
      <div class="recorrente-item">
        <div class="recorrente-icon">🔁</div>
        <div class="recorrente-info">
          <div class="recorrente-nome">${escHtml(r.loja)}</div>
          <div class="recorrente-sub">
            Vence dia ${r.vencimentoDia || '-'} • Pagar para ${escHtml(r.cartaoNome || 'não informado')}
            ${r.divisivel === true
              ? ' • <span style="color:var(--accent);font-weight:700">✂️ Divide 15/30</span>'
              : r.divisivel === false
                ? ' • <span style="color:var(--blue)">📅 Só no vencimento</span>'
                : ''}
          </div>
        </div>
        <div class="recorrente-valor">${fmtR(r.valor)}</div>
        <button type="button" class="gasto-del" style="color:var(--green);border-color:rgba(61,214,140,0.35)" ${pago || !vencida ? 'disabled' : ''} onclick="marcarRecorrenteComoPago('${r.id}')">${pago ? 'Pago' : 'Marcar como pago'}</button>
        <button type="button" class="gasto-del" style="color:var(--blue);border-color:rgba(77,157,224,0.3)" onclick="editarRecorrente('${r.id}')">Editar</button>
        <button type="button" class="gasto-del" onclick="cancelarRecorrente('${r.id}')">Cancelar</button>
      </div>
    `}).join('');
}

// ============ CONFIRMAÇÃO CUSTOMIZADA ============
function extrasSalario(sal) {
  return Array.isArray(sal?.extras) ? sal.extras : [];
}

function totalExtrasSalario(sal) {
  return extrasSalario(sal).reduce((s, e) => s + (parseFloat(e.valor) || 0), 0);
}

function isSobrouMesAnterior(g) {
  return g?.categoria === 'Sobrou do último mês';
}

function totalSobrouMes(mesStr) {
  return gastos
    .filter(g => g.data?.startsWith(mesStr) && isSobrouMesAnterior(g))
    .reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
}

function totalSobrouPeriodo(inicio, fim) {
  return gastos
    .filter(g => isSobrouMesAnterior(g) && inPeriodo(g.data, inicio, fim))
    .reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
}

function entradasFixasAtivas() {
  return entradasFixas.filter(e => e.ativo !== false);
}

function totalEntradasFixasMes(mes) {
  if (!mes) return 0;
  return entradasFixasAtivas()
    .filter(e => !e.inicioMes || e.inicioMes <= mes)
    .reduce((s, e) => s + (parseFloat(e.valor) || 0), 0);
}

function valorPagamentoSaldo(p) {
  if (p && p.valorSaldo !== undefined) return parseFloat(p.valorSaldo) || 0;
  return parseFloat(p?.valor) || 0;
}

function recorrentePagamentoKey(recId, mes) {
  return `${mes}|${recId}`;
}

function pagamentoRecorrenteMes(recId, mes) {
  const key = recorrentePagamentoKey(recId, mes);
  return pagamentos.find(p => p.tipo === 'recorrente' && p.recorrenteKey === key);
}

function recorrentePagoMes(recId, mes) {
  return !!pagamentoRecorrenteMes(recId, mes);
}

function dataRecorrenteNoMes(r, mes) {
  const [ano, mesNum] = mes.split('-').map(Number);
  const ultimoDia = new Date(ano, mesNum, 0).getDate();
  const dia = Math.min(parseInt(r?.vencimentoDia) || 1, ultimoDia);
  return `${mes}-${String(dia).padStart(2, '0')}`;
}

function recorrenteVencidaNoMes(r, mes) {
  const hoje = new Date().toISOString().slice(0, 10);
  return dataRecorrenteNoMes(r, mes) <= hoje;
}

function salarioBase(sal) {
  if (!sal) return 0;
  const temPartes = sal.val15 !== undefined || sal.val30 !== undefined;
  if (temPartes) return (parseFloat(sal.val15) || 0) + (parseFloat(sal.val30) || 0);
  return Math.max((parseFloat(sal.valor) || 0) - totalExtrasSalario(sal), 0);
}

function salarioTotal(sal) {
  return salarioBase(sal) + totalExtrasSalario(sal);
}

function salarioPorMes(mes) {
  return salarios.find(s => s.mes === mes) || null;
}

function salarioMaisRecenteAte(mes) {
  return [...salarios]
    .filter(s => s.mes && s.mes <= mes)
    .sort((a, b) => b.mes.localeCompare(a.mes))[0] || null;
}

function rendaTotalMes(sal, mesForcar) {
  const mes = mesForcar || sal?.mes || '';
  return salarioTotal(sal) + totalEntradasFixasMes(mes) + totalSobrouMes(mes);
}

function rendaDashboardMes(mes) {
  return rendaTotalMes(salarioPorMes(mes) || salarioMaisRecenteAte(mes), mes);
}

function valorParcela(g, numParcela) {
  const custom = Array.isArray(g?.parcelasValores)
    ? g.parcelasValores.find(p => p.num === numParcela)
    : null;
  return custom ? (parseFloat(custom.valor) || 0) : ((parseFloat(g?.valor) || 0) / (parseInt(g?.parcelas) || 1));
}

function totalParcelas(g, nums) {
  return nums.reduce((s, num) => s + valorParcela(g, num), 0);
}

function numsParcelasPagas(g) {
  return Array.isArray(g?.parcelasPagas) ? g.parcelasPagas.map(p => p.num) : [];
}

function parcelasPagasObj(g) {
  return Array.isArray(g?.parcelasPagas) ? g.parcelasPagas : [];
}

function mesParcela(g, numParcela) {
  if (!g?.data) return '';
  const inicio = new Date(g.data + 'T12:00:00');
  const dataParcela = new Date(inicio);
  dataParcela.setMonth(inicio.getMonth() + numParcela - 1);
  return dataParcela.toISOString().slice(0, 7);
}

function numParcelaNoMes(g, mesStr) {
  if (!g?.data || !mesStr) return null;
  const inicio = new Date(g.data + 'T12:00:00');
  const [ano, mes] = mesStr.split('-').map(Number);
  const num = ((ano * 12) + (mes - 1)) - ((inicio.getFullYear() * 12) + inicio.getMonth()) + 1;
  return num >= 1 && num <= (parseInt(g.parcelas) || 1) ? num : null;
}

function diaVencimentoNoMes(g, mesStr) {
  const [ano, mes] = mesStr.split('-').map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const diaBase = parseInt(g?.vencimentoDia) || 1;
  return Math.min(diaBase, ultimoDia);
}

function parcelasAdiantadasNoMes(g, mesStr, numParcelaAtual) {
  return parcelasPagasObj(g).filter(p =>
    p.adiantadaMes === mesStr && p.num !== numParcelaAtual
  );
}

function diaPagamentoParcelasNoMes(g, mesStr) {
  // Considera tanto pagas confirmadas quanto agendadas (pré-confirmação)
  const adiantadasConfirmadas = parcelasPagasObj(g).filter(p => p.adiantadaMes === mesStr && p.adiantadaDia);
  const adiantadasAgendadas   = Array.isArray(g.parcelasAgendadas)
    ? g.parcelasAgendadas.filter(a => a.adiantadaMes === mesStr && a.adiantadaDia)
    : [];
  const todasAdiantadas = [...adiantadasConfirmadas, ...adiantadasAgendadas];
  if (!todasAdiantadas.length) return diaVencimentoNoMes(g, mesStr);
  const dia = parseInt(todasAdiantadas[0].adiantadaDia);
  const [ano, mes] = mesStr.split('-').map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return Math.min(dia || diaVencimentoNoMes(g, mesStr), ultimoDia);
}

function valorParcelasNoMes(g, mesStr) {
  const numAtual = numParcelaNoMes(g, mesStr);
  const pagas = parcelasPagasObj(g);
  let total = 0;

  if (numAtual) {
    const pagaAtual = pagas.find(p => p.num === numAtual);
    if (!pagaAtual?.adiantadaMes || pagaAtual.adiantadaMes === mesStr) {
      total += valorParcela(g, numAtual);
    }
  }

  total += parcelasAdiantadasNoMes(g, mesStr, numAtual)
    .reduce((s, p) => s + valorParcela(g, p.num), 0);

  // Inclui agendadas (para exibição no calendário)
  const agendadas = Array.isArray(g.parcelasAgendadas)
    ? g.parcelasAgendadas.filter(a => a.adiantadaMes === mesStr && (!numAtual || a.num !== numAtual))
    : [];
  total += agendadas.reduce((s, a) => s + valorParcela(g, a.num), 0);

  return total;
}

// Valor das parcelas deste mês que ainda NÃO foram pagas (para Divisão 15/30)
// Inclui agendadas para adiantamento — aparecem no cálculo ANTES de "Fatura do mês paga"
function valorParcelasNoMesPendente(g, mesStr) {
  const numAtual  = numParcelaNoMes(g, mesStr);
  const pagas     = parcelasPagasObj(g);
  const pagasNums = pagas.map(p => p.num);
  let total = 0;

  // Parcela do mês atual (se ainda não paga)
  if (numAtual && !pagasNums.includes(numAtual)) {
    const pagaAtual = pagas.find(p => p.num === numAtual);
    if (!pagaAtual?.adiantadaMes || pagaAtual.adiantadaMes === mesStr) {
      total += valorParcela(g, numAtual);
    }
  }

  // Adiantadas já confirmadas (em parcelasPagas) deste mês, ainda não pagas
  total += parcelasAdiantadasNoMes(g, mesStr, numAtual)
    .filter(p => !pagasNums.includes(p.num))
    .reduce((s, p) => s + valorParcela(g, p.num), 0);

  // Agendadas para adiantamento (ainda não confirmadas via "Fatura do mês paga")
  // → já entram no cálculo de quanto enviar para o cartão
  const agendadas = Array.isArray(g.parcelasAgendadas)
    ? g.parcelasAgendadas.filter(a => a.adiantadaMes === mesStr && a.num !== numAtual && !pagasNums.includes(a.num))
    : [];
  total += agendadas.reduce((s, a) => s + valorParcela(g, a.num), 0);

  return total;
}

// Valor das parcelas deste mês que JÁ foram pagas (para Extrato)
function valorParcelasNoMesPagas(g, mesStr) {
  const numAtual  = numParcelaNoMes(g, mesStr);
  const pagas     = parcelasPagasObj(g);
  const pagasNums = pagas.map(p => p.num);
  let total = 0;

  if (numAtual && pagasNums.includes(numAtual)) {
    total += valorParcela(g, numAtual);
  }
  total += parcelasAdiantadasNoMes(g, mesStr, numAtual)
    .filter(p => pagasNums.includes(p.num))
    .reduce((s, p) => s + valorParcela(g, p.num), 0);

  return total;
}

function gastosResumoMes(mesStr) {
  const _recInativos = new Set(recorrentes.filter(r => r.ativo === false).map(r => r.id));
  const diretos = gastos.filter(g =>
    g.data?.startsWith(mesStr) &&
    g.categoria !== 'Compras parceladas' &&
    !isSobrouMesAnterior(g) &&
    !(g.recorrenteId && recorrentePagoMes(g.recorrenteId, mesStr)) &&
    (g.categoria !== 'Compras futuras' || g.statusFutura === 'aprovado') &&
    !(g.recorrenteId && _recInativos.has(g.recorrenteId))
  );
  const parcelados = gastos
    .filter(g => g.categoria === 'Compras parceladas')
    .map(g => ({ ...g, valor: valorParcelasNoMes(g, mesStr), data: `${mesStr}-${String(diaVencimentoNoMes(g, mesStr)).padStart(2, '0')}` }))
    .filter(g => g.valor > 0);
  return [...diretos, ...parcelados];
}

// Apenas o que AINDA FALTA pagar este mês (parcelas pendentes) — usado na Divisão 15/30
function gastosResumoMesPendente(mesStr) {
  const _recInativosPend = new Set(recorrentes.filter(r => r.ativo === false).map(r => r.id));
  const diretos = gastos.filter(g =>
    g.data?.startsWith(mesStr) &&
    g.categoria !== 'Compras parceladas' &&
    !isSobrouMesAnterior(g) &&
    !(g.recorrenteId && recorrentePagoMes(g.recorrenteId, mesStr)) &&
    (g.categoria !== 'Compras futuras' || g.statusFutura === 'aprovado') &&
    !(g.recorrenteId && _recInativosPend.has(g.recorrenteId))
  );
  const parcelados = gastos
    .filter(g => g.categoria === 'Compras parceladas')
    .map(g => ({ ...g, valor: valorParcelasNoMesPendente(g, mesStr), data: `${mesStr}-${String(diaVencimentoNoMes(g, mesStr)).padStart(2, '0')}` }))
    .filter(g => g.valor > 0);
  return [...diretos, ...parcelados];
}

// Parcelas que JÁ foram pagas neste mês — usadas no Extrato
function parceladosPagosMes(mesStr) {
  return gastos
    .filter(g => g.categoria === 'Compras parceladas')
    .flatMap(g => {
      const numAtual   = numParcelaNoMes(g, mesStr);
      const pagas      = parcelasPagasObj(g);
      const pagasNums  = pagas.map(p => p.num);
      const resultados = [];

      // Parcela do mês paga
      if (numAtual && pagasNums.includes(numAtual)) {
        const pagaObj = pagas.find(p => p.num === numAtual);
        // Fallback: se não há data registrada, usa o vencimento do MÊS DA PARCELA (mesStr)
        // Isso é seguro porque só chegamos aqui quando numAtual pertence a mesStr
        const dataPagamento = pagaObj?.data || `${mesStr}-${String(diaVencimentoNoMes(g, mesStr)).padStart(2, '0')}`;
        resultados.push({
          ...g,
          _parcelaNum: numAtual,
          valor: valorParcela(g, numAtual),
          data: dataPagamento,
          _lojaParcela: `${g.loja} (${numAtual}/${g.parcelas})`,
          _pago: true
        });
      }

      // Adiantadas pagas neste mês
      parcelasAdiantadasNoMes(g, mesStr, numAtual)
        .filter(p => pagasNums.includes(p.num))
        .forEach(p => {
          const pagaObj = pagas.find(x => x.num === p.num);
          const dataPagamento = pagaObj?.data || `${mesStr}-${String(diaVencimentoNoMes(g, mesStr)).padStart(2, '0')}`;
          resultados.push({
            ...g,
            _parcelaNum: p.num,
            valor: valorParcela(g, p.num),
            data: dataPagamento,
            _lojaParcela: `${g.loja} (${p.num}/${g.parcelas} — adiantada)`,
            _pago: true
          });
        });

      return resultados;
    });
}

function isParceladoQuitado(g) {
  const total = parseInt(g?.parcelas) || 1;
  const pagas = Array.isArray(g?.parcelasPagas) ? g.parcelasPagas.length : (parseInt(g?.parcelaPaga) || 0);
  return g?.categoria === 'Compras parceladas' && pagas >= total;
}

function dataQuitacaoParcelado(g) {
  const pagas = parcelasPagasObj(g);
  if (!pagas.length) {
    if (!isParceladoQuitado(g) || !g?.data) return '';
    const dataFim = parseDateLocal(g.data);
    dataFim.setMonth(dataFim.getMonth() + (parseInt(g.parcelas) || 1) - 1);
    return formatDateInputLocal(dataFim);
  }
  return pagas
    .map(p => p.data)
    .filter(Boolean)
    .sort()
    .pop() || '';
}

function resumoTempoQuitacao(g) {
  const previsto = parseInt(g.parcelas) || 1;
  const quitadoEm = dataQuitacaoParcelado(g);
  const real = mesesEntreDatas(g.data, quitadoEm);
  const diff = previsto - real;
  const pct = previsto > 0 ? Math.round((Math.abs(diff) / previsto) * 100) : 0;
  if (diff > 0) return `Voce terminou de pagar as faturas desse item em ${diff} meses a menos, isso e ${pct}% mais rapido.`;
  if (diff < 0) return `Voce terminou de pagar as faturas desse item em ${Math.abs(diff)} meses a mais, isso e ${pct}% alem do previsto.`;
  return 'Voce terminou de pagar as faturas desse item exatamente no prazo previsto.';
}

function parcelasAtrasadasObj(g) {
  return Array.isArray(g?.parcelasAtrasadas) ? g.parcelasAtrasadas : [];
}

function atrasosPendentes(g) {
  return parcelasAtrasadasObj(g).filter(a => !a.resolvido);
}

function atrasoKey(a) {
  return `${a.num || 0}-${a.mesOrigem || ''}`;
}

function proximoMes(mesStr) {
  const [y, m] = mesStr.split('-').map(Number);
  const d = new Date(y, m, 1);
  return d.toISOString().slice(0, 7);
}

function dataUrgenteAtraso(g, atraso) {
  const mesUrgente = atraso.mesUrgente || proximoMes(atraso.mesOrigem);
  const dia = diaVencimentoNoMes(g, mesUrgente);
  return `${mesUrgente}-${String(dia).padStart(2, '0')}`;
}

function totalGastosMes(mesStr) {
  return gastosResumoMes(mesStr).reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
}

function isGastoComum(g) {
  return g.categoria !== 'Compras recorrentes'
    && g.categoria !== 'Compras parceladas'
    && g.categoria !== 'Compras futuras';
}

function isGastoFutura(g) {
  return g.categoria === 'Compras futuras';
}

function futurasAprovadas() {
  return gastos.filter(g => isGastoFutura(g) && g.statusFutura === 'aprovado');
}

function futurasReprovadas() {
  return gastos.filter(g => isGastoFutura(g) && g.statusFutura === 'reprovado');
}

function futurasPendentes() {
  return gastos.filter(g => isGastoFutura(g) && !g.statusFutura);
}

function gastosComunsMes(mesStr) {
  return gastos.filter(g => g.data?.startsWith(mesStr) && isGastoComum(g));
}

function cicloFinanceiroPorData(refDate = new Date()) {
  const ref = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  let inicio = makeDateClamped(ref.getFullYear(), ref.getMonth(), 30);
  if (ref < inicio) inicio = makeDateClamped(ref.getFullYear(), ref.getMonth() - 1, 30);

  const proximoInicio = makeDateClamped(inicio.getFullYear(), inicio.getMonth() + 1, 30);
  const fim = new Date(proximoInicio);
  fim.setDate(fim.getDate() - 1);

  return { inicio, fim };
}

function cicloFinanceiroAnterior(ciclo) {
  const ref = new Date(ciclo.inicio);
  ref.setDate(ref.getDate() - 1);
  return cicloFinanceiroPorData(ref);
}

function inPeriodo(dataStr, inicio, fim) {
  const data = parseDateLocal(dataStr);
  return data && data >= inicio && data <= fim;
}

function dataPagamento(p) {
  if (!p?.mes || !p?.dia) return null;
  const [y, m] = p.mes.split('-').map(Number);
  const ultimoDia = new Date(y, m, 0).getDate();
  return formatDateInputLocal(new Date(y, m - 1, Math.min(parseInt(p.dia), ultimoDia)));
}

function gastosComunsPeriodo(inicio, fim) {
  return gastos.filter(g => isGastoComum(g) && inPeriodo(g.data, inicio, fim));
}

function totalPagamentosMes(mesStr) {
  return pagamentos
    .filter(p => p.mes === mesStr)
    .reduce((s, p) => s + valorPagamentoSaldo(p), 0);
}

function totalPagamentosPeriodo(inicio, fim) {
  return pagamentos
    .filter(p => inPeriodo(dataPagamento(p), inicio, fim))
    .reduce((s, p) => s + valorPagamentoSaldo(p), 0);
}

function totalGastosDashboardMes(mesStr) {
  const totalGastosComuns = gastosComunsMes(mesStr)
    .reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
  return totalGastosComuns + totalPagamentosMes(mesStr);
}

function totalGastosDashboardPeriodo(inicio, fim) {
  const totalGastosComuns = gastosComunsPeriodo(inicio, fim)
    .reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);

  // Inclui parcelas pagas cujo mês de competência caiu dentro do período.
  // IMPORTANTE: filtramos pelo mês de competência da parcela (_parcelaNum / mesParcela),
  // NÃO pela data de pagamento salva — isso evita que parcelas de meses anteriores
  // marcadas manualmente (checkbox retroativo) afetem o saldo do mês atual.
  const inicioStr = formatDateInputLocal(inicio);
  const fimStr    = formatDateInputLocal(fim);
  const mesInicio = inicioStr.slice(0, 7);
  const mesFim    = fimStr.slice(0, 7);
  const mesAtual  = new Date().toISOString().slice(0, 7);

  const mesesRange = [];
  let cur = mesInicio;
  while (cur <= mesFim) {
    mesesRange.push(cur);
    const [y, m] = cur.split('-').map(Number);
    const next = new Date(y, m, 1);
    cur = next.toISOString().slice(0, 7);
  }

  const totalParcelasPagas = mesesRange.flatMap(mes => {
    // Nunca incluir parcelas de meses anteriores ao mês atual no saldo
    if (mes < mesAtual) return [];
    return parceladosPagosMes(mes);
  })
    .filter(p => p.data >= inicioStr && p.data <= fimStr)
    .reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);

  return totalGastosComuns + totalPagamentosPeriodo(inicio, fim) + totalParcelasPagas;
}

function totalCategoriaMes(cat, mesStr) {
  return gastosResumoMes(mesStr)
    .filter(g => g.categoria === cat)
    .reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
}

// ============ SALÁRIO ============
window.salvarSalario = async function () {
  const mes   = document.getElementById('sal-mes').value;
  const val15 = parseFloat(document.getElementById('sal-valor-15').value) || 0;
  const val30 = parseFloat(document.getElementById('sal-valor-30').value) || 0;

  if (!mes) { showToast('⚠️ Informe o mês'); return; }
  if (val15 <= 0 && val30 <= 0) { showToast('⚠️ Informe pelo menos um valor'); return; }

  const { collection, getDocs, doc, updateDoc, addDoc } = fns();
  const ref  = collection(db(), `users/${uid()}/salarios`);
  const snap = await getDocs(ref);

  let existente = null;
  snap.forEach(d => { if (d.data().mes === mes) existente = { id: d.id, ...d.data() }; });

  // Se está editando por ID específico e o mês mudou, usa o registro pelo ID
  if (editandoSalarioId && !editandoExtraId) {
    const salById = salarios.find(s => s.id === editandoSalarioId);
    if (salById && salById.mes !== mes) {
      // Mês foi alterado: verifica se novo mês já existe
      const novoMesExistente = salarios.find(s => s.mes === mes && s.id !== editandoSalarioId);
      if (novoMesExistente) { showToast('⚠️ Já existe um salário para esse mês'); return; }
    }
    // Atualiza o registro pelo ID de edição
    const extras = extrasSalario(salById || existente || {});
    const totalExt = extras.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0);
    await updateDoc(doc(db(), `users/${uid()}/salarios`, editandoSalarioId), {
      mes, val15, val30, extras, valor: val15 + val30 + totalExt
    });
    cancelarEdicaoSalario();
    await loadSalarios();
    showToast('✅ Salário atualizado!');
    renderSalarios(); renderDivisaoMeses(); renderDashboard();
    return;
  }

  if (existente) {
    const novo15 = val15 > 0 ? val15 : (existente.val15 || 0);
    const novo30 = val30 > 0 ? val30 : (existente.val30 || 0);
    const extras = extrasSalario(existente);
    await updateDoc(doc(db(), `users/${uid()}/salarios`, existente.id), {
      val15: novo15, val30: novo30, extras, valor: novo15 + novo30 + totalExtrasSalario(existente)
    });
  } else {
    await addDoc(ref, { mes, val15, val30, extras: [], valor: val15 + val30 });
  }

  await loadSalarios();
  showToast('✅ Salário atualizado!');
  renderSalarios();
  renderDivisaoMeses();
  renderDashboard();
};

window.salvarDinheiroExtra = async function () {
  const mes    = document.getElementById('sal-mes').value;
  const origem = document.getElementById('sal-extra-origem').value.trim();
  const valor  = parseFloat(document.getElementById('sal-extra-valor').value) || 0;
  const dataRecebimento = document.getElementById('sal-extra-data').value || '';

  if (!mes) { showToast('⚠️ Informe o mês'); return; }
  if (!origem) { showToast('⚠️ Informe de onde veio o dinheiro'); return; }
  if (valor <= 0) { showToast('⚠️ Informe um valor externo válido'); return; }

  const { collection, getDocs, doc, updateDoc, addDoc } = fns();
  const ref  = collection(db(), `users/${uid()}/salarios`);
  const snap = await getDocs(ref);

  let existente = null;
  snap.forEach(d => { if (d.data().mes === mes) existente = { id: d.id, ...d.data() }; });

  // Modo edição de extra existente
  if (editandoSalarioId && editandoExtraId) {
    const sal = salarios.find(s => s.id === editandoSalarioId);
    if (!sal) { showToast('⚠️ Registro não encontrado'); return; }
    const extras = extrasSalario(sal).map(e =>
      e.id === editandoExtraId
        ? { ...e, origem, valor, dataRecebimento }
        : e
    );
    const base = salarioBase(sal);
    await updateDoc(doc(db(), `users/${uid()}/salarios`, sal.id), {
      extras,
      valor: base + extras.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0)
    });
    cancelarEdicaoSalario();
    await loadSalarios();
    showToast('✅ Dinheiro externo atualizado!');
    renderSalarios(); renderDivisaoMeses(); renderDashboard();
    return;
  }

  const novoExtra = {
    id: String(Date.now()),
    origem,
    valor,
    dataRecebimento,
    criadoEm: new Date().toISOString()
  };

  if (existente) {
    const extras = [...extrasSalario(existente), novoExtra];
    const base   = salarioBase(existente);
    await updateDoc(doc(db(), `users/${uid()}/salarios`, existente.id), {
      extras,
      valor: base + extras.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0)
    });
  } else {
    await addDoc(ref, { mes, val15: 0, val30: 0, extras: [novoExtra], valor });
  }

  document.getElementById('sal-extra-origem').value = '';
  document.getElementById('sal-extra-valor').value  = '';
  document.getElementById('sal-extra-data').value   = '';

  await loadSalarios();
  showToast('✅ Dinheiro externo adicionado!');
  renderSalarios();
  renderDivisaoMeses();
  renderDashboard();
};

window.deletarDinheiroExtra = async function (salId, extraId) {
  const sal = salarios.find(s => s.id === salId);
  if (!sal) return;
  const extra = extrasSalario(sal).find(e => e.id === extraId);

  confirmarAcao({
    titulo: 'Remover dinheiro externo',
    mensagem: `Remover <b>${escHtml(extra?.origem || '')}</b> (${fmtR(extra?.valor || 0)})?`,
    icone: '💰',
    tipoBotao: 'danger',
    textoBotao: 'Remover',
    onConfirm: async () => {
      const { doc, updateDoc } = fns();
      const extras = extrasSalario(sal).filter(e => e.id !== extraId);
      const base   = salarioBase(sal);
      await updateDoc(doc(db(), `users/${uid()}/salarios`, salId), {
        extras,
        valor: base + extras.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0)
      });
      await loadSalarios();
      showToast('🗑️ Dinheiro externo removido');
      renderSalarios();
      renderDivisaoMeses();
      renderDashboard();
    }
  });
};

window.deletarSalario = async function (id) {
  const sal = salarios.find(s => s.id === id);
  if (!sal) return;
  confirmarAcao({
    titulo: 'Remover salário',
    mensagem: `Remover salário de <b>${formatMes(sal.mes)}</b>?`,
    icone: '💸',
    tipoBotao: 'danger',
    textoBotao: 'Remover',
    onConfirm: async () => {
      const { doc, deleteDoc } = fns();
      undoStack.push({ tipo: 'deleteSalario', dados: { ...sal }, timestamp: Date.now(), descricao: `Excluiu salário ${formatMes(sal.mes)}` });
      await deleteDoc(doc(db(), `users/${uid()}/salarios`, id));
      await loadSalarios();
      showToast('🗑️ Salário removido');
      renderSalarios(); renderDivisaoMeses(); renderDashboard();
    }
  });
};

function renderSalarios() {
  const hist   = document.getElementById('salarios-hist');
  const sorted = [...salarios].sort((a, b) => b.mes.localeCompare(a.mes));
  if (!sorted.length) {
    hist.innerHTML = '<p style="color:var(--text3);font-size:13px">Nenhum salário registrado ainda.</p>';
    return;
  }
  hist.innerHTML =
    '<h4 style="font-family:var(--font-head);font-size:14px;color:var(--text2);margin-bottom:8px">Histórico de rendas</h4>' +
    sorted.map(s => {
      const base = salarioBase(s);
      const extras = extrasSalario(s);
      const totalExtras = totalExtrasSalario(s);
      const val15 = s.val15 || 0;
      const val30 = s.val30 || 0;
      return `
      <div class="salario-hist-item">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="salario-hist-mes">${formatMes(s.mes)}</span>
            ${val15 > 0 ? `<span style="background:rgba(240,192,64,0.12);color:var(--accent);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">Dia 15: ${fmtR(val15)}</span>` : ''}
            ${val30 > 0 ? `<span style="background:rgba(77,157,224,0.12);color:var(--blue);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">Dia 30: ${fmtR(val30)}</span>` : ''}
          </div>
          ${extras.length ? `<div class="salario-extra-lista">
            ${extras.map(e => `
              <div class="salario-extra-item">
                <span>${escHtml(e.origem)}${e.dataRecebimento ? ` <span style="color:var(--text3);font-size:11px">· recebido em ${formatData(e.dataRecebimento)}</span>` : ''}</span>
                <b>${fmtR(e.valor)}</b>
                <button type="button" class="salario-extra-del" style="color:var(--blue);border-color:rgba(77,157,224,0.3);margin-right:2px" onclick="editarDinheiroExtra('${s.id}', '${e.id}')">✏️</button>
                <button type="button" class="salario-extra-del" onclick="deletarDinheiroExtra('${s.id}', '${e.id}')">✕</button>
              </div>
            `).join('')}
          </div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="salario-hist-val">${fmtR(rendaTotalMes(s, s.mes))}</div>
          <div style="font-size:11px;color:var(--text3)">Salário ${fmtR(base)} + Extras ${fmtR(totalExtras)}</div>
          <button type="button" class="salario-hist-del" style="color:var(--blue);border-color:rgba(77,157,224,0.3);margin-top:6px;margin-right:4px" onclick="editarSalario('${s.id}')">✏️ Editar</button>
        </div>
        <button type="button" class="salario-hist-del" onclick="deletarSalario('${s.id}')">✕</button>
      </div>
    `}).join('');
}

// ============ EDITAR SALÁRIO ============
let editandoSalarioId = null;
let editandoExtraId   = null;
let editandoEntradaFixaId = null;

window.editarSalario = function (id) {
  const s = salarios.find(x => x.id === id);
  if (!s) return;

  editandoSalarioId = id;
  editandoExtraId   = null;

  // Preenche o formulário de salário com os dados existentes
  document.getElementById('sal-mes').value       = s.mes || '';
  document.getElementById('sal-valor-15').value  = s.val15 || '';
  document.getElementById('sal-valor-30').value  = s.val30 || '';

  // Muda o botão para "Atualizar Salário" e rola para o topo
  const btnSalario = document.querySelector('[onclick="salvarSalario()"]');
  if (btnSalario) {
    btnSalario.textContent = '💾 Atualizar Salário';
    btnSalario.style.background = 'linear-gradient(135deg,var(--blue),var(--purple))';
  }

  // Adiciona banner de "modo edição"
  _mostrarBannerEdicaoSalario(s.mes);

  // Scroll suave para o formulário
  document.getElementById('sal-mes').scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast('✏️ Editando salário de ' + formatMes(s.mes) + ' — altere os valores e clique em Atualizar');
};

window.editarDinheiroExtra = function (salId, extraId) {
  const s = salarios.find(x => x.id === salId);
  if (!s) return;
  const e = extrasSalario(s).find(x => x.id === extraId);
  if (!e) return;

  editandoSalarioId = salId;
  editandoExtraId   = extraId;

  // Preenche o formulário de extra com os dados existentes
  document.getElementById('sal-mes').value          = s.mes || '';
  document.getElementById('sal-extra-origem').value = e.origem || '';
  document.getElementById('sal-extra-valor').value  = e.valor  || '';
  document.getElementById('sal-extra-data').value   = e.dataRecebimento || '';

  // Muda o botão de extra para "Atualizar"
  const btnExtra = document.querySelector('[onclick="salvarDinheiroExtra()"]');
  if (btnExtra) {
    btnExtra.textContent = '💾 Atualizar Dinheiro Externo';
    btnExtra.style.background = 'linear-gradient(135deg,var(--blue),var(--purple))';
  }

  // Banner
  _mostrarBannerEdicaoExtra(e.origem);

  // Scroll
  document.getElementById('sal-extra-origem').scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast('✏️ Editando "' + e.origem + '" — altere os valores e clique em Atualizar');
};

function _mostrarBannerEdicaoSalario(mes) {
  _removerBannerEdicao();
  const banner = document.createElement('div');
  banner.id = 'edicao-salario-banner';
  banner.style.cssText = 'background:rgba(77,157,224,0.12);border:1px solid rgba(77,157,224,0.3);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--blue);display:flex;align-items:center;justify-content:space-between;gap:10px';
  banner.innerHTML = `<span>✏️ Modo edição — Salário de <b>${formatMes(mes)}</b></span><button onclick="cancelarEdicaoSalario()" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:18px;line-height:1">✕</button>`;
  const btn = document.querySelector('[onclick="salvarSalario()"]');
  if (btn) btn.parentNode.insertBefore(banner, btn);
}

function _mostrarBannerEdicaoExtra(origem) {
  _removerBannerEdicao();
  const banner = document.createElement('div');
  banner.id = 'edicao-salario-banner';
  banner.style.cssText = 'background:rgba(77,157,224,0.12);border:1px solid rgba(77,157,224,0.3);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--blue);display:flex;align-items:center;justify-content:space-between;gap:10px';
  banner.innerHTML = `<span>✏️ Modo edição — Dinheiro externo "<b>${escHtml(origem)}</b>"</span><button onclick="cancelarEdicaoSalario()" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:18px;line-height:1">✕</button>`;
  const btn = document.querySelector('[onclick="salvarDinheiroExtra()"]');
  if (btn) btn.parentNode.insertBefore(banner, btn);
}

function _removerBannerEdicao() {
  document.getElementById('edicao-salario-banner')?.remove();
}

window.cancelarEdicaoSalario = function () {
  editandoSalarioId = null;
  editandoExtraId   = null;
  _removerBannerEdicao();
  // Restaura botões originais
  const btnSalario = document.querySelector('[onclick="salvarSalario()"]');
  if (btnSalario) { btnSalario.textContent = 'Salvar Salário'; btnSalario.style.background = ''; }
  const btnExtra = document.querySelector('[onclick="salvarDinheiroExtra()"]');
  if (btnExtra) { btnExtra.textContent = 'Adicionar dinheiro externo'; btnExtra.style.background = ''; }
  // Limpa campos
  document.getElementById('sal-extra-origem').value = '';
  document.getElementById('sal-extra-valor').value  = '';
  document.getElementById('sal-extra-data').value   = '';
};

function renderEntradasFixas() {
  const list = document.getElementById('sal-fixas-list');
  if (!list) return;
  const ativas = entradasFixasAtivas().sort((a, b) => (parseInt(a.diaRecebimento) || 1) - (parseInt(b.diaRecebimento) || 1));
  if (!ativas.length) {
    list.innerHTML = '<div class="salario-extra-item"><span style="color:var(--text3)">Nenhuma entrada fixa cadastrada.</span></div>';
    return;
  }
  list.innerHTML = ativas.map(e => `
    <div class="salario-extra-item">
      <span>${escHtml(e.nome || 'Entrada fixa')} <span style="color:var(--text3);font-size:11px">· todo dia ${parseInt(e.diaRecebimento) || 1}</span></span>
      <b>${fmtR(e.valor)}</b>
      <button type="button" class="salario-extra-del" style="color:var(--blue);border-color:rgba(77,157,224,0.3);margin-right:2px" onclick="editarEntradaFixa('${e.id}')">✏️</button>
      <button type="button" class="salario-extra-del" onclick="deletarEntradaFixa('${e.id}')">✕</button>
    </div>
  `).join('');
}

window.salvarEntradaFixa = async function () {
  const nome = document.getElementById('sal-fixa-nome')?.value.trim() || '';
  const valor = parseFloat(document.getElementById('sal-fixa-valor')?.value) || 0;
  const dia = Math.min(Math.max(parseInt(document.getElementById('sal-fixa-dia')?.value) || 1, 1), 31);
  const inicioMes = document.getElementById('sal-mes')?.value || new Date().toISOString().slice(0, 7);

  if (!nome) { showToast('⚠️ Informe a origem da entrada fixa'); return; }
  if (valor <= 0) { showToast('⚠️ Informe um valor mensal válido'); return; }

  const { collection, addDoc, doc, updateDoc } = fns();
  if (editandoEntradaFixaId) {
    await updateDoc(doc(db(), `users/${uid()}/entradasFixas`, editandoEntradaFixaId), { nome, valor, diaRecebimento: dia, inicioMes, ativo: true });
    editandoEntradaFixaId = null;
    showToast('✅ Entrada fixa atualizada!');
  } else {
    await addDoc(collection(db(), `users/${uid()}/entradasFixas`), { nome, valor, diaRecebimento: dia, inicioMes, ativo: true, criadoEm: new Date().toISOString() });
    showToast('✅ Entrada fixa salva!');
  }

  document.getElementById('sal-fixa-nome').value = '';
  document.getElementById('sal-fixa-valor').value = '';
  document.getElementById('sal-fixa-dia').value = '';
  const btn = document.querySelector('[onclick="salvarEntradaFixa()"]');
  if (btn) { btn.textContent = 'Salvar entrada fixa'; btn.style.background = ''; }

  await loadEntradasFixas();
  renderEntradasFixas();
  renderSalarios();
  renderDivisaoMeses();
  renderDashboard();
};

window.editarEntradaFixa = function (id) {
  const e = entradasFixas.find(x => x.id === id);
  if (!e) return;
  editandoEntradaFixaId = id;
  document.getElementById('sal-fixa-nome').value = e.nome || '';
  document.getElementById('sal-fixa-valor').value = e.valor || '';
  document.getElementById('sal-fixa-dia').value = e.diaRecebimento || '';
  const btn = document.querySelector('[onclick="salvarEntradaFixa()"]');
  if (btn) { btn.textContent = '💾 Atualizar entrada fixa'; btn.style.background = 'linear-gradient(135deg,var(--blue),var(--purple))'; }
  document.getElementById('sal-fixa-nome')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.deletarEntradaFixa = async function (id) {
  const entrada = entradasFixas.find(e => e.id === id);
  if (!entrada) return;
  confirmarAcao({
    titulo: 'Remover entrada fixa',
    mensagem: `Remover <b>${escHtml(entrada.nome || '')}</b> (${fmtR(entrada.valor || 0)}) das entradas mensais?`,
    icone: '💸',
    tipoBotao: 'danger',
    textoBotao: 'Remover',
    onConfirm: async () => {
      const { doc, updateDoc } = fns();
      await updateDoc(doc(db(), `users/${uid()}/entradasFixas`, id), { ativo: false });
      await loadEntradasFixas();
      showToast('🗑️ Entrada fixa removida');
      renderEntradasFixas();
      renderSalarios();
      renderDivisaoMeses();
      renderDashboard();
    }
  });
};
// ============ DASHBOARD ============
window.renderGastosList = function () {
  const filtCat  = document.getElementById('filter-cat').value;
  const filtMes  = document.getElementById('filter-month')?.value || '';
  const filtIni  = document.getElementById('filter-start')?.value || '';
  const filtFim  = document.getElementById('filter-end')?.value || '';
  const filtBusc = (document.getElementById('filter-search')?.value || '').toLowerCase();
  const list     = document.getElementById('gastos-list');

  let filtrado = gastos.filter(isGastoComum);
  if (filtCat)  filtrado = filtrado.filter(g => g.categoria === filtCat);
  if (filtIni)  filtrado = filtrado.filter(g => g.data >= filtIni);
  if (filtFim)  filtrado = filtrado.filter(g => g.data <= filtFim);
  if (!filtIni && !filtFim && filtMes) filtrado = filtrado.filter(g => g.data.startsWith(filtMes));
  if (filtBusc) filtrado = filtrado.filter(g =>
    g.loja.toLowerCase().includes(filtBusc) ||
    (g.descricao || '').toLowerCase().includes(filtBusc) ||
    g.categoria.toLowerCase().includes(filtBusc)
  );

  if (!filtrado.length) {
    list.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/></svg>
      <p>Nenhum gasto encontrado</p>
    </div>`;
    return;
  }

  // Se há busca por nome, mostra total acumulado no topo
  let totalBuscaHtml = '';
  if (filtBusc) {
    const totalBusca = filtrado.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
    totalBuscaHtml = `<div style="background:rgba(240,192,64,0.08);border:1px solid rgba(240,192,64,0.2);border-radius:10px;padding:12px 16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;color:var(--text2)">💰 Total gasto em "<b style="color:var(--accent)">${escHtml(filtBusc)}</b>" (${filtrado.length} lançamento${filtrado.length !== 1 ? 's' : ''})</span>
      <span style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--accent)">${fmtR(totalBusca)}</span>
    </div>`;
  }

  list.innerHTML = totalBuscaHtml + filtrado.map((g, i) => {
    const { icon, cls } = catStyle(g.categoria);
    const parcelaInfo   = g.parcelas > 1
      ? `<span style="background:rgba(240,192,64,0.15);color:#f0c040;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">${g.parcelas}x a partir de ${fmtR(valorParcela(g, 1))}</span>`
      : '';
    const recTag = g.recorrente
      ? `<span style="background:rgba(77,157,224,0.15);color:var(--blue);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">🔄 Recorrente</span>`
      : '';
    const recBtn = g.recorrente && g.recorrenteId
      ? `<button class="gasto-del" style="font-size:10px;padding:4px 8px;color:var(--blue);border-color:rgba(77,157,224,0.3)" onclick="event.stopPropagation();cancelarRecorrente('${g.recorrenteId}')">Cancelar</button>`
      : '';
    return `
      <div class="gasto-item" style="animation-delay:${i * 40}ms" onclick="abrirDetalheGasto('${g.id}')" data-id="${g.id}">
        <div class="gasto-cat-icon ${cls}">${icon}</div>
        <div class="gasto-info">
          <div class="gasto-loja">${escHtml(g.loja)} ${parcelaInfo} ${recTag}</div>
          <div class="gasto-desc">${escHtml(g.categoria)}${g.descricao ? ' • ' + escHtml(g.descricao) : ''}</div>
        </div>
        <div class="gasto-right">
          <div class="gasto-valor">${fmtR(g.valor)}</div>
          <div class="gasto-data">${formatData(g.data)}</div>
        </div>
        <button class="gasto-del gasto-edit-btn" onclick="event.stopPropagation();editarGastoComum('${g.id}')">Editar</button>
        ${recBtn}
        <button class="gasto-del" onclick="event.stopPropagation();deletarGasto('${g.id}')">✕</button>
      </div>
    `;
  }).join('');
};

// ============ SUB-TABS GASTOS ============
window.switchGastosSubtab = function (tab) {
  ['ativos','pendentes','reprovados'].forEach(t => {
    document.getElementById(`subtab-${t}`).style.display = t === tab ? 'block' : 'none';
    document.getElementById(`subtab-btn-${t}`)?.classList.toggle('active', t === tab);
  });
  if (tab === 'ativos')      renderGastosList();
  if (tab === 'pendentes')   renderFuturasList();
  if (tab === 'reprovados')  renderReprovadosList();
};

function atualizarBadgesFuturas() {
  const bp = document.getElementById('badge-pendentes');
  const br = document.getElementById('badge-reprovados');
  const pendQ = gastos.filter(g => g.categoria === 'Compras futuras' && !g.statusFutura).length;
  const repQ  = gastos.filter(g => g.categoria === 'Compras futuras' && g.statusFutura === 'reprovado').length;
  if (bp) bp.textContent = pendQ || '';
  if (br) br.textContent = repQ || '';
}

// ============ COMPRAS FUTURAS — PENDENTES ============
window.renderFuturasList = function () {
  const busca = (document.getElementById('filter-futuras')?.value || '').toLowerCase();
  const list  = document.getElementById('futuras-list');
  if (!list) return;

  let itens = gastos.filter(g => g.categoria === 'Compras futuras' && !g.statusFutura);
  if (busca) itens = itens.filter(g =>
    g.loja.toLowerCase().includes(busca) ||
    (g.descricao || '').toLowerCase().includes(busca) ||
    (g.cartaoNome || '').toLowerCase().includes(busca)
  );
  itens.sort((a, b) => (a.data || '').localeCompare(b.data || ''));

  if (!itens.length) {
    list.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
      <p>Nenhuma compra futura pendente</p>
    </div>`;
    return;
  }

  list.innerHTML = itens.map((g, i) => `
    <div class="futura-item" style="animation-delay:${i*40}ms" onclick="abrirModalFutura('${g.id}')">
      <div class="futura-icon">🔮</div>
      <div class="gasto-info">
        <div class="gasto-loja">${escHtml(g.loja)}
          ${g.cartaoNome ? `<span style="background:rgba(77,157,224,0.15);color:var(--blue);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">💳 ${escHtml(g.cartaoNome)}</span>` : ''}
          <span style="background:rgba(240,192,64,0.15);color:var(--accent);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">⏳ Aguardando</span>
        </div>
        <div class="gasto-desc">Vence em ${formatData(g.data)}${g.descricao ? ' • ' + escHtml(g.descricao) : ''}</div>
      </div>
      <div class="gasto-right">
        <div class="gasto-valor">${fmtR(g.valor)}</div>
        <div class="gasto-data">${formatData(g.data)}</div>
      </div>
      <button class="btn-futura-aprovar" onclick="event.stopPropagation();aprovarFutura('${g.id}')">✅ Aprovar</button>
      <button class="btn-futura-reprovar" onclick="event.stopPropagation();reprovarFutura('${g.id}')">❌ Reprovar</button>
    </div>
  `).join('');
};

window.abrirModalFutura = function (id) {
  const g = gastos.find(x => x.id === id);
  if (!g) return;
  document.getElementById('mf-titulo').textContent = `🔮 ${escHtml(g.loja)}`;
  document.getElementById('mf-body').innerHTML = `
    <div class="futura-modal-info">
      <div class="futura-modal-row">
        <span class="futura-modal-label">Valor</span>
        <span class="futura-modal-val" style="color:var(--accent);font-size:22px;font-weight:800">${fmtR(g.valor)}</span>
      </div>
      <div class="futura-modal-row">
        <span class="futura-modal-label">Data a pagar</span>
        <span class="futura-modal-val">${formatData(g.data)}</span>
      </div>
      ${g.cartaoNome ? `<div class="futura-modal-row">
        <span class="futura-modal-label">Cartão</span>
        <span class="futura-modal-val">💳 ${escHtml(g.cartaoNome)}</span>
      </div>` : ''}
      ${g.descricao ? `<div class="futura-modal-row">
        <span class="futura-modal-label">Descrição</span>
        <span class="futura-modal-val">${escHtml(g.descricao)}</span>
      </div>` : ''}
      <div class="futura-modal-row">
        <span class="futura-modal-label">Registrado em</span>
        <span class="futura-modal-val">${g.criadoEm ? new Date(g.criadoEm).toLocaleDateString('pt-BR') : '—'}</span>
      </div>
    </div>
    <div class="futura-modal-status">
      <span style="font-size:12px;color:var(--text2);display:block;margin-bottom:16px;text-align:center">O que deseja fazer com esta compra futura?</span>
      <div class="futura-modal-btns">
        <button class="futura-btn-aprovar-big" onclick="aprovarFutura('${g.id}')">
          <span style="font-size:28px;display:block;margin-bottom:6px">✅</span>
          <b>Aprovar</b>
          <span>Entra nos gastos e cálculos</span>
        </button>
        <button class="futura-btn-reprovar-big" onclick="reprovarFutura('${g.id}')">
          <span style="font-size:28px;display:block;margin-bottom:6px">❌</span>
          <b>Reprovar</b>
          <span>Vai para a lista de reprovados</span>
        </button>
      </div>
    </div>
  `;
  document.getElementById('modal-futura').classList.add('open');
};

window.fecharModalFutura = function () {
  document.getElementById('modal-futura').classList.remove('open');
};

window.aprovarFutura = async function (id) {
  const g = gastos.find(x => x.id === id);
  if (!g) return;
  const { doc, updateDoc } = fns();
  await updateDoc(doc(db(), `users/${uid()}/gastos`, id), {
    statusFutura: 'aprovado',
    aprovadoEm: new Date().toISOString()
  });
  g.statusFutura = 'aprovado';
  fecharModalFutura();
  await loadGastos();
  showToast('✅ Compra aprovada! Agora aparece nos gastos e cálculos.', true);
  atualizarBadgesFuturas();
  renderFuturasList();
  renderGastosList();
  renderDashboard();
  renderDivisao();
  if (currentTab === 'calendario') renderCalendario();
};

window.reprovarFutura = async function (id) {
  const g = gastos.find(x => x.id === id);
  if (!g) return;
  const { doc, updateDoc } = fns();
  await updateDoc(doc(db(), `users/${uid()}/gastos`, id), {
    statusFutura: 'reprovado',
    reprovadoEm: new Date().toISOString()
  });
  g.statusFutura = 'reprovado';
  fecharModalFutura();
  await loadGastos();
  showToast('❌ Compra reprovada. Movida para a lista de reprovados.', true);
  atualizarBadgesFuturas();
  renderFuturasList();
  renderReprovadosList();
};

// ============ COMPRAS FUTURAS — REPROVADAS ============
window.renderReprovadosList = function () {
  const busca = (document.getElementById('filter-reprovados')?.value || '').toLowerCase();
  const list  = document.getElementById('reprovados-list');
  if (!list) return;

  let itens = gastos.filter(g => g.categoria === 'Compras futuras' && g.statusFutura === 'reprovado');
  if (busca) itens = itens.filter(g =>
    g.loja.toLowerCase().includes(busca) ||
    (g.descricao || '').toLowerCase().includes(busca) ||
    (g.cartaoNome || '').toLowerCase().includes(busca)
  );
  itens.sort((a, b) => (b.reprovadoEm || '').localeCompare(a.reprovadoEm || ''));

  if (!itens.length) {
    list.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
      <p>Nenhuma compra reprovada</p>
    </div>`;
    return;
  }

  list.innerHTML = itens.map((g, i) => `
    <div class="futura-item futura-reprovada" style="animation-delay:${i*40}ms">
      <div class="futura-icon" style="background:rgba(224,84,84,0.15)">❌</div>
      <div class="gasto-info">
        <div class="gasto-loja">${escHtml(g.loja)}
          ${g.cartaoNome ? `<span style="background:rgba(77,157,224,0.15);color:var(--blue);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">💳 ${escHtml(g.cartaoNome)}</span>` : ''}
          <span style="background:rgba(224,84,84,0.15);color:var(--red);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">❌ Reprovado</span>
        </div>
        <div class="gasto-desc">Era para ${formatData(g.data)}${g.descricao ? ' • ' + escHtml(g.descricao) : ''}</div>
      </div>
      <div class="gasto-right">
        <div class="gasto-valor" style="color:var(--text3);text-decoration:line-through">${fmtR(g.valor)}</div>
      </div>
      <button class="btn-futura-aprovar" style="font-size:12px;padding:6px 10px" onclick="aprovarFutura('${g.id}')">↩️ Reativar</button>
      <button class="gasto-del" onclick="deletarGasto('${g.id}')">✕</button>
    </div>
  `).join('');
};

function datasEntreHojeEUltimoGasto(itens) {
  const hojeStr = formatDateInputLocal(new Date());
  const datas = itens.map(g => g.data).filter(Boolean).filter(d => d <= hojeStr).sort();
  const fimStr = datas[0] || hojeStr;
  const fim = parseDateLocal(fimStr);
  const cursor = parseDateLocal(hojeStr);
  const result = [];
  while (cursor >= fim) {
    result.push(formatDateInputLocal(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return result;
}

function categoriaMaisGastaDia(itens) {
  const porCat = {};
  itens.forEach(g => {
    porCat[g.categoria] = (porCat[g.categoria] || 0) + (parseFloat(g.valor) || 0);
  });
  return Object.entries(porCat).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function renderExtrato() {
  const list = document.getElementById('extrato-list');
  if (!list) return;

  const hoje    = formatDateInputLocal(new Date());
  const mesHoje = hoje.slice(0, 7);

  // Gastos comuns (já existia)
  const itensComuns = gastos.filter(g =>
    g.data && g.data <= hoje &&
    g.categoria !== 'Compras parceladas'
  );

  // Parcelas pagas nos últimos meses — aparece na data real do pagamento
  const mesesVerif = getLast6Months();
  const parcelasPagas = mesesVerif.flatMap(mes => parceladosPagosMes(mes))
    .filter(p => p.data && p.data <= hoje);

  const todosItens = [...itensComuns, ...parcelasPagas];

  if (!todosItens.length) {
    list.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/></svg>
      <p>Parabéns, sem gastos hoje.</p>
    </div>`;
    return;
  }

  const porData = todosItens.reduce((acc, g) => {
    if (!acc[g.data]) acc[g.data] = [];
    acc[g.data].push(g);
    return acc;
  }, {});

  list.innerHTML = datasEntreHojeEUltimoGasto(todosItens).map(data => {
    const itens = (porData[data] || []).sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    const titulo = data === hoje ? 'Hoje' : `Dia ${formatData(data).slice(0, 5)}`;
    if (!itens.length) {
      return `
        <section class="extrato-dia vazio">
          <div class="extrato-dia-head">
            <h3>${titulo}</h3>
            <span>${formatData(data)}</span>
          </div>
          <div class="extrato-dia-empty">${data === hoje ? 'Parabéns, sem gastos hoje.' : 'Sem gastos nesse dia.'}</div>
        </section>
      `;
    }

    const totalDia = itens.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
    const catAlerta = categoriaMaisGastaDia(itens);
    return `
      <section class="extrato-dia">
        <div class="extrato-dia-head">
          <h3>${titulo}</h3>
          <span>${formatData(data)}</span>
        </div>
        <div class="extrato-dia-itens">
          ${itens.map(g => {
            const { icon, cls } = catStyle(g.categoria);
            const nomeLoja = g._lojaParcela || g.loja;
            const descricao = g._pago
              ? `✅ Parcela paga • ${escHtml(g.cartaoNome || 'Parcelado')}`
              : escHtml(g.descricao || g.categoria);
            return `
              <div class="extrato-item${g._pago ? ' extrato-pago' : ''}">
                <div class="gasto-cat-icon ${cls}">${g._pago ? '✅' : icon}</div>
                <div class="gasto-info">
                  <div class="gasto-loja">${escHtml(nomeLoja)}</div>
                  <div class="gasto-desc">${descricao}</div>
                </div>
                <div class="gasto-valor" style="${g._pago ? 'color:var(--green)' : ''}">${fmtR(g.valor)}</div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="extrato-dia-total">
          <span>Total dia: <b>${fmtR(totalDia)}</b></span>
          ${catAlerta ? `<span>Cuidado com <b>${escHtml(catAlerta)}</b>!</span>` : ''}
        </div>
      </section>
    `;
  }).join('');
}

window.limparFiltroDatas = function () {
  const inicio = document.getElementById('filter-start');
  const fim    = document.getElementById('filter-end');
  if (inicio) inicio.value = '';
  if (fim)    fim.value = '';
  renderGastosList();
};

window.abrirDetalheGasto = function(id) {
  const g = gastos.find(x => x.id === id);
  if (!g || g.categoria !== 'Compras parceladas') return;
  abrirModalParcelas(g);
};

window.editarGastoComum = function (id) {
  const g = gastos.find(x => x.id === id);
  if (!g || !isGastoComum(g)) return;

  editandoGastoId = id;
  editandoRecorrenteId = null;
  populateCartaoSelect();

  document.getElementById('modal-overlay').classList.add('open');
  document.querySelector('#modal-overlay .modal-header h3').textContent = 'Editar Gasto';
  document.querySelector('#modal-overlay .modal-footer .btn-primary').textContent = 'Salvar alterações';

  document.getElementById('m-cat').value = g.categoria || 'Alimentação';
  document.getElementById('m-cat').disabled = true;
  document.getElementById('m-valor').value = g.valor || '';
  document.getElementById('m-parcelas').value = '';
  document.getElementById('m-cartao').value = '';
  document.getElementById('m-vencimento').value = '';
  document.getElementById('m-data').value = g.data || new Date().toISOString().split('T')[0];
  document.getElementById('m-loja').value = g.loja || '';
  document.getElementById('m-desc').value = g.descricao || '';
  document.getElementById('data-error').style.display = 'none';
  toggleParcelas();
};

window.editarParcelado = function (id) {
  const g = gastos.find(x => x.id === id);
  if (!g || g.categoria !== 'Compras parceladas') return;

  editandoGastoId = id;
  populateCartaoSelect();

  document.getElementById('modal-overlay').classList.add('open');
  document.querySelector('#modal-overlay .modal-header h3').textContent = 'Editar Parcelado';
  document.querySelector('#modal-overlay .modal-footer .btn-primary').textContent = 'Salvar alterações';

  document.getElementById('m-cat').value = 'Compras parceladas';
  document.getElementById('m-cat').disabled = true;
  document.getElementById('m-valor').value = g.valor || '';
  document.getElementById('m-parcelas').value = g.parcelas || 1;
  document.getElementById('m-cartao').value = g.cartaoId || '';
  document.getElementById('m-vencimento').value = g.vencimentoDia || '';
  document.getElementById('m-data').value = g.data || new Date().toISOString().split('T')[0];
  document.getElementById('m-loja').value = g.loja || '';
  document.getElementById('m-desc').value = g.descricao || '';
  document.getElementById('data-error').style.display = 'none';
  toggleParcelas();
};

window.editarRecorrente = function (id) {
  const r = recorrentes.find(x => x.id === id);
  if (!r) return;

  editandoGastoId = null;
  editandoRecorrenteId = id;
  populateCartaoSelect();

  document.getElementById('modal-overlay').classList.add('open');
  document.querySelector('#modal-overlay .modal-header h3').textContent = 'Editar Recorrente';
  document.querySelector('#modal-overlay .modal-footer .btn-primary').textContent = 'Salvar alterações';

  document.getElementById('m-cat').value = 'Compras recorrentes';
  document.getElementById('m-cat').disabled = true;
  document.getElementById('m-valor').value = r.valor || '';
  document.getElementById('m-parcelas').value = '';
  document.getElementById('m-cartao').value = r.cartaoId || '';
  document.getElementById('m-vencimento').value = r.vencimentoDia || '';
  document.getElementById('m-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('m-loja').value = r.loja || '';
  document.getElementById('m-desc').value = r.descricao || '';
  recDivisivel = r.divisivel === true ? true : (r.divisivel === false ? false : null);
  _renderDivisivelBtns();
  atualizarHintDivisivel();
  document.getElementById('data-error').style.display = 'none';
  toggleParcelas();
};

// ============ PARCELADOS ============
function renderParcelados() {
  const list = document.getElementById('parcelados-list');
  if (!list) return;

  const todosParcelados = gastos.filter(g => g.categoria === 'Compras parceladas');
  const parcelados = todosParcelados.filter(g => !isParceladoQuitado(g));
  const pagos = todosParcelados.filter(isParceladoQuitado);
  const ativosResumo = document.getElementById('parcelados-ativos-resumo');
  if (ativosResumo) ativosResumo.textContent = `${parcelados.length} item${parcelados.length !== 1 ? 's' : ''}`;

  if (!todosParcelados.length) {
    list.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
      <p>Nenhuma compra parcelada</p>
    </div>`;
    window._parceladosPagosCache = [];
    atualizarResumoParceladosPagos([]);
    renderAtrasosParcelados();
    return;
  }

  if (!parcelados.length) {
    list.innerHTML = `<div class="empty-state"><p>Todos os parcelados cadastrados ja foram pagos.</p></div>`;
  } else {
    list.innerHTML = parcelados.map(g => {
    const parcelasPagas = Array.isArray(g.parcelasPagas) ? g.parcelasPagas.length : (g.parcelaPaga || 0);
    const restantes     = g.parcelas - parcelasPagas;
    const pct           = Math.round((parcelasPagas / g.parcelas) * 100);
    const valPrimeira   = valorParcela(g, 1);
    const pagasNums     = numsParcelasPagas(g);
    const todasNums     = Array.from({ length: g.parcelas }, (_, i) => i + 1);
    const restantesNums = todasNums.filter(n => !pagasNums.includes(n));
    const totalPago     = totalParcelas(g, pagasNums);
    const totalRestante = totalParcelas(g, restantesNums);
    const dataInicio    = new Date(g.data + 'T12:00:00');
    const dataFim       = new Date(dataInicio);
    dataFim.setMonth(dataFim.getMonth() + g.parcelas - 1);
    const cartaoNome    = g.cartaoNome ? ` • ${escHtml(g.cartaoNome)}` : '';
    const vencInfo      = g.vencimentoDia ? ` • Vence dia ${g.vencimentoDia}` : '';

    return `
      <div class="parcelado-item" onclick="abrirModalParcelas('${g.id}')">
        <div class="parcelado-top">
          <div>
            <div class="parcelado-nome">${escHtml(g.loja)}</div>
            <div class="parcelado-loja">${g.descricao ? escHtml(g.descricao) + ' • ' : ''}Comprado em ${formatData(g.data)} • Termina em ${formatData(dataFim.toISOString().split('T')[0])}${cartaoNome}${vencInfo}</div>
          </div>
          <div class="parcelado-valor-parcela">${fmtR(valPrimeira)}<span>1ª parcela</span></div>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:0%" data-target="${pct}"></div>
        </div>
        <div class="parcelado-info-row">
          <span>${parcelasPagas} de ${g.parcelas} parcelas pagas (${pct}%)</span>
          <span><b>${restantes} parcela${restantes !== 1 ? 's' : ''} restante${restantes !== 1 ? 's' : ''}</b></span>
        </div>
        <div style="margin-top:10px;font-size:12px;color:var(--text3)">
          Total: ${fmtR(g.valor)} • Pago: ${fmtR(totalPago)} • Restante: ${fmtR(totalRestante)}
        </div>
        <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="parcelado-del-btn" onclick="event.stopPropagation();abrirModalParcelas('${g.id}')">
            📋 Gerenciar parcelas
          </button>
          <button class="parcelado-del-btn" style="border-color:rgba(61,214,140,0.4);color:var(--green)" onclick="event.stopPropagation();pagarFaturaAtualParcelado('${g.id}')">
            ✅ Fatura do mês paga
          </button>
          <button class="parcelado-del-btn" onclick="event.stopPropagation();editarParcelado('${g.id}')">
            Editar
          </button>
          <button class="parcelado-del-btn" style="border-color:rgba(224,84,84,0.4);color:var(--red)" onclick="event.stopPropagation();deletarGasto('${g.id}')">Remover</button>
        </div>
      </div>
    `;
    }).join('');
  }

  setTimeout(() => {
    document.querySelectorAll('.progress-bar-fill[data-target]').forEach(el => {
      el.style.width = el.dataset.target + '%';
    });
  }, 50);

  window._parceladosPagosCache = pagos;
  atualizarResumoParceladosPagos(pagos);
  // Se o modal estiver aberto, mantém a lista dele sincronizada também
  if (document.getElementById('modal-parcelados-pagos')?.classList.contains('open')) {
    renderParceladosPagosModal();
  }
  renderAtrasosParcelados();
}

function atualizarResumoParceladosPagos(pagos) {
  const el = document.getElementById('parcelados-pagos-resumo-txt');
  if (!el) return;
  if (!pagos.length) {
    el.textContent = 'Nenhum parcelado quitado ainda';
    return;
  }
  const total = pagos.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
  el.textContent = `${pagos.length} item${pagos.length !== 1 ? 's' : ''} quitado${pagos.length !== 1 ? 's' : ''} • ${fmtR(total)}`;
}

window.aoFiltrarPagos = function () {
  window._pagosPaginaAtual = 1;
  renderParceladosPagosModal();
};

window.abrirModalParceladosPagos = function () {
  document.getElementById('modal-parcelados-pagos')?.classList.add('open');
  window._pagosPaginaAtual = 1;
  renderParceladosPagosModal();
};

window.fecharModalParceladosPagos = function () {
  document.getElementById('modal-parcelados-pagos')?.classList.remove('open');
};

const PAGOS_POR_PAGINA = 10;

window.renderParceladosPagosModal = function () {
  window._pagosPaginaAtual = window._pagosPaginaAtual || 1;
  const pagos = window._parceladosPagosCache || [];
  const list  = document.getElementById('parcelados-pagos-list');
  if (!list) return;

  const inicio = document.getElementById('pagos-start')?.value || '';
  const fim    = document.getElementById('pagos-end')?.value || '';
  const busca  = (document.getElementById('pagos-busca')?.value || '').toLowerCase().trim();

  let filtrados = pagos
    .map(g => ({ ...g, quitadoEm: dataQuitacaoParcelado(g) }))
    .filter(g => (!inicio || g.quitadoEm >= inicio) && (!fim || g.quitadoEm <= fim))
    .filter(g => !busca || (g.loja || '').toLowerCase().includes(busca) || (g.cartaoNome || '').toLowerCase().includes(busca))
    .sort((a, b) => (b.quitadoEm || '').localeCompare(a.quitadoEm || ''));

  const total = filtrados.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
  const totalEl = document.getElementById('parcelados-pagos-total');
  if (totalEl) totalEl.textContent = fmtR(total);

  if (!filtrados.length) {
    list.innerHTML = `<div class="parcelado-pago-empty">Nenhum parcelado pago dentro desse filtro.</div>`;
    const pagEl = document.getElementById('parcelados-pagos-paginacao');
    if (pagEl) pagEl.innerHTML = '';
    return;
  }

  // Paginação
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGOS_POR_PAGINA));
  if (window._pagosPaginaAtual > totalPaginas) window._pagosPaginaAtual = totalPaginas;
  const paginaAtual = window._pagosPaginaAtual;
  const inicioSlice = (paginaAtual - 1) * PAGOS_POR_PAGINA;
  const pagina = filtrados.slice(inicioSlice, inicioSlice + PAGOS_POR_PAGINA);

  list.innerHTML = pagina.map(g => {
    const valores = Array.from({ length: parseInt(g.parcelas) || 1 }, (_, i) => i + 1)
      .map(n => `${n}/${g.parcelas}: ${fmtR(valorParcela(g, n))}`)
      .join(' • ');
    return `
      <div class="parcelado-pago-item">
        <div class="parcelado-pago-top">
          <div>
            <div class="parcelado-nome">${escHtml(g.loja)}</div>
            <div class="parcelado-loja">Comprado em ${formatData(g.data)} • Quitado em ${formatData(g.quitadoEm)}${g.cartaoNome ? ' • ' + escHtml(g.cartaoNome) : ''}</div>
          </div>
          <div class="parcelado-pago-total">${fmtR(g.valor)}</div>
        </div>
        <div class="parcelado-pago-valores">${valores}</div>
        <div class="parcelado-pago-tempo">${resumoTempoQuitacao(g)}</div>
        <div style="margin-top:8px;display:flex;justify-content:flex-end;gap:8px">
          <button class="parcelado-del-btn" style="border-color:rgba(240,192,64,0.4);color:var(--accent)" onclick="desfazerPagamentoParcelado('${g.id}')">↩️ Voltar para andamento</button>
          <button class="parcelado-del-btn" style="border-color:rgba(224,84,84,0.4);color:var(--red)" onclick="deletarGasto('${g.id}')">Remover</button>
        </div>
      </div>
    `;
  }).join('');

  const pagEl = document.getElementById('parcelados-pagos-paginacao');
  if (pagEl) {
    if (totalPaginas <= 1) {
      pagEl.innerHTML = '';
    } else {
      pagEl.innerHTML = `
        <button type="button" class="filter-clear-btn" ${paginaAtual <= 1 ? 'disabled' : ''} onclick="mudarPaginaPagos(-1)">‹ Anterior</button>
        <span>Página ${paginaAtual} de ${totalPaginas}</span>
        <button type="button" class="filter-clear-btn" ${paginaAtual >= totalPaginas ? 'disabled' : ''} onclick="mudarPaginaPagos(1)">Próxima ›</button>
      `;
    }
  }
};

window.mudarPaginaPagos = function (delta) {
  window._pagosPaginaAtual = (window._pagosPaginaAtual || 1) + delta;
  renderParceladosPagosModal();
};

window.limparFiltroPagos = function () {
  const inicio = document.getElementById('pagos-start');
  const fim = document.getElementById('pagos-end');
  const busca = document.getElementById('pagos-busca');
  if (inicio) inicio.value = '';
  if (fim) fim.value = '';
  if (busca) busca.value = '';
  window._pagosPaginaAtual = 1;
  renderParceladosPagosModal();
};

function renderAtrasosParcelados() {
  const list = document.getElementById('parcelados-atrasos-list');
  if (!list) return;

  const atrasos = gastos
    .filter(g => g.categoria === 'Compras parceladas')
    .flatMap(g => atrasosPendentes(g).map(a => ({ g, a })))
    .sort((x, y) => (x.a.mesOrigem || '').localeCompare(y.a.mesOrigem || ''));

  if (!atrasos.length) {
    list.innerHTML = `<div class="atraso-ok">Muito bem, seus parcelados estao sem atrasos!</div>`;
    return;
  }

  list.innerHTML = atrasos.map(({ g, a }) => `
    <div class="atraso-item">
      <div class="atraso-nome">${escHtml(g.loja)}</div>
      <div class="atraso-sub">Parcela ${a.num}/${g.parcelas} • vencida em ${formatData(a.dataVenc)} • urgente em ${formatData(dataUrgenteAtraso(g, a))}</div>
      <div class="atraso-valor">${fmtR(valorParcela(g, a.num))}</div>
      <button type="button" class="parcelado-del-btn" onclick="pagarAtrasoParcelado('${g.id}', '${atrasoKey(a)}')">Marcar pago</button>
    </div>
  `).join('');
}

function parcelasPendentesDoMes(mesStr, diaVencimento) {
  return gastos
    .filter(g => g.categoria === 'Compras parceladas' && !isParceladoQuitado(g))
    .map(g => {
      const num = numParcelaNoMes(g, mesStr);
      const pagas = numsParcelasPagas(g);
      if (!num || pagas.includes(num)) return null;
      return { g, num };
    })
    .filter(item => !item || !diaVencimento || diaPagamentoParcelasNoMes(item.g, mesStr) === diaVencimento)
    .filter(Boolean);
}

function parcelaPendenteKey(item) {
  return `${item.g.id}__${item.num}`;
}

function parcelasSelecionadasParaAtraso(mesStr) {
  const checks = [...document.querySelectorAll(`.cal-atraso-check[data-mes="${mesStr}"]:checked`)];
  const keys = checks.map(c => c.value);
  return parcelasPendentesDoMes(mesStr).filter(item => keys.includes(parcelaPendenteKey(item)));
}

async function atualizarGastoParcelado(g, campos) {
  const { doc, updateDoc } = fns();
  await updateDoc(doc(db(), `users/${uid()}/gastos`, g.id), campos);
  Object.assign(g, campos);
}

window.quitarFaturaMes = async function (mesStr, diaPreferido) {
  const pendentes = parcelasPendentesDoMes(mesStr, diaPreferido);
  if (!pendentes.length) {
    showToast('✅ Essa fatura ja esta sem parcelas pendentes');
    return;
  }

  for (const { g, num } of pendentes) {
    const pagas = parcelasPagasObj(g).filter(p => p.num !== num);
    const dia = diaPreferido || diaVencimentoNoMes(g, mesStr);
    const [ano, mes] = mesStr.split('-').map(Number);
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const data = `${mesStr}-${String(Math.min(dia, ultimoDia)).padStart(2, '0')}`;
    pagas.push({ num, data });
    const atrasos = parcelasAtrasadasObj(g).map(a =>
      a.num === num && a.mesOrigem === mesStr ? { ...a, resolvido: true, pagoEm: data } : a
    );
    await atualizarGastoParcelado(g, {
      parcelasPagas: pagas.sort((a, b) => a.num - b.num),
      parcelaPaga: pagas.length,
      parcelasAtrasadas: atrasos
    });
  }

  await loadGastos();
  showToast('✅ Fatura marcada como paga');
  renderParcelados();
  renderDashboard();
  renderDivisao();
  if (currentTab === 'calendario') renderCalendario();
};


window.pagarFaturaAtualParcelado = async function (gastoId) {
  const g = gastos.find(x => x.id === gastoId);
  if (!g) return;

  const hoje = new Date().toISOString().split('T')[0];
  const mesAtual = new Date().toISOString().slice(0, 7);
  const numAtual = numParcelaNoMes(g, mesAtual);
  const pagasNums = numsParcelasPagas(g);

  // Parcelas agendadas para adiantamento neste mês
  const agendadas = Array.isArray(g.parcelasAgendadas)
    ? g.parcelasAgendadas.filter(a => a.adiantadaMes === mesAtual)
    : [];

  const temFaturaAtual = numAtual && !pagasNums.includes(numAtual);
  const temAgendadas   = agendadas.length > 0;

  if (!temFaturaAtual && !temAgendadas) {
    showToast("✅ Nenhuma parcela pendente este mês");
    return;
  }

  const todasNums = [
    ...(temFaturaAtual ? [numAtual] : []),
    ...agendadas.map(a => a.num).filter(n => !pagasNums.includes(n))
  ];
  const totalVal = totalParcelas(g, todasNums);
  const agendadasTxt = agendadas.length
    ? ` + ${agendadas.length} adiantada${agendadas.length > 1 ? 's' : ''}`
    : '';

  // Detecta se está pagando antes do vencimento
  const diaVenc = diaVencimentoNoMes(g, mesAtual);
  const diaHoje = parseInt(hoje.split('-')[2]);
  const adiantado = diaHoje < diaVenc;
  const mensagemAdiantamento = adiantado
    ? `<br><small style="color:var(--accent)">⚡ Você está pagando <b>${diaVenc - diaHoje} dias antes</b> do vencimento (dia ${diaVenc}). O pagamento será registrado hoje.</small>`
    : '';

  confirmarAcao({
    titulo: adiantado ? "Confirmar pagamento antecipado" : "Fatura do mês paga",
    mensagem: `Confirmar pagamento da parcela <b>${numAtual || ''}/${g.parcelas}</b>${agendadasTxt} de <b>${escHtml(g.loja)}</b>?<br><small style="color:var(--text3)">Total: ${fmtR(totalVal)}</small>${mensagemAdiantamento}`,
    icone: adiantado ? "⚡" : "✅",
    tipoBotao: "info",
    textoBotao: "Confirmar pagamento",
    onConfirm: async () => {
      // Usa a data de HOJE como data de pagamento (não o dia de vencimento)
      // Isso garante que o saldo do dashboard seja atualizado imediatamente
      const dataFatura = hoje;

      let pagas = parcelasPagasObj(g).filter(p => !todasNums.includes(p.num));

      // Adiciona parcela atual
      if (temFaturaAtual) {
        pagas.push({ num: numAtual, data: dataFatura });
      }

      // Adiciona agendadas — usando a data agendada (dia 15 ou 30)
      agendadas.filter(a => !pagasNums.includes(a.num)).forEach(a => {
        pagas.push({
          num: a.num,
          data: a.data || dataFatura,
          adiantadaMes: a.adiantadaMes,
          adiantadaDia: a.adiantadaDia,
          faturaAtual: false
        });
      });

      pagas.sort((a, b) => a.num - b.num);

      // Resolve atrasos
      const atrasos = parcelasAtrasadasObj(g).map(a =>
        todasNums.includes(a.num) && a.mesOrigem === mesAtual
          ? { ...a, resolvido: true, pagoEm: dataFatura }
          : a
      );

      // Remove agendamentos que foram pagos
      const agendamentosRestantes = (g.parcelasAgendadas || []).filter(
        a => a.adiantadaMes !== mesAtual
      );

      await atualizarGastoParcelado(g, {
        parcelasPagas: pagas,
        parcelaPaga: pagas.length,
        parcelasAtrasadas: atrasos,
        parcelasAgendadas: agendamentosRestantes
      });

      await loadGastos();
      const desc = temAgendadas
        ? `Parcela ${numAtual || ''}/${g.parcelas} + ${agendadas.length} adiantada(s)`
        : `Parcela ${numAtual}/${g.parcelas}`;
      showToast(`✅ ${desc} de ${g.loja} paga! Saldo atualizado.`);
      renderParcelados();
      renderDashboard();
      renderDivisao();
      if (currentTab === "calendario") renderCalendario();
    }
  });
};
window.registrarAtrasoFaturaMes = async function (mesStr, somenteSelecionadas) {
  const pendentes = somenteSelecionadas ? parcelasSelecionadasParaAtraso(mesStr) : parcelasPendentesDoMes(mesStr);
  if (!pendentes.length) {
    showToast(somenteSelecionadas ? '⚠️ Selecione pelo menos uma despesa' : '✅ Nenhuma parcela pendente para atrasar nesse mes');
    return;
  }

  for (const { g, num } of pendentes) {
    const existentes = parcelasAtrasadasObj(g);
    const jaExiste = existentes.some(a => a.num === num && a.mesOrigem === mesStr && !a.resolvido);
    if (jaExiste) continue;
    const dataVenc = `${mesStr}-${String(diaVencimentoNoMes(g, mesStr)).padStart(2, '0')}`;
    const novoAtraso = {
      num,
      mesOrigem: mesStr,
      mesUrgente: proximoMes(mesStr),
      dataVenc,
      criadoEm: new Date().toISOString(),
      resolvido: false
    };
    await atualizarGastoParcelado(g, { parcelasAtrasadas: [...existentes, novoAtraso] });
  }

  await loadGastos();
  showToast('⚠️ Atraso registrado. Ele aparece como urgente no mes seguinte.');
  renderParcelados();
  if (currentTab === 'calendario') renderCalendario();
};

window.marcarFaturaMesComoAtrasada = async function () {
  const mes = document.getElementById('atraso-mes')?.value || new Date().toISOString().slice(0, 7);
  confirmarAcao({
    titulo: 'Marcar atraso',
    mensagem: `Marcar as parcelas pendentes de <b>${formatMes(mes)}</b> como atraso para o proximo mes?`,
    icone: '⚠️',
    tipoBotao: 'warning',
    textoBotao: 'Marcar atraso',
    onConfirm: () => registrarAtrasoFaturaMes(mes)
  });
};

window.pagarAtrasoParcelado = async function (gastoId, key) {
  const g = gastos.find(x => x.id === gastoId);
  if (!g) return;
  const atraso = atrasosPendentes(g).find(a => atrasoKey(a) === key);
  if (!atraso) return;

  const hoje = new Date().toISOString().split('T')[0];
  const pagas = parcelasPagasObj(g).filter(p => p.num !== atraso.num);
  pagas.push({ num: atraso.num, data: hoje, pagoAtrasado: true, mesOrigem: atraso.mesOrigem });
  const atrasos = parcelasAtrasadasObj(g).map(a =>
    atrasoKey(a) === key ? { ...a, resolvido: true, pagoEm: hoje } : a
  );

  await atualizarGastoParcelado(g, {
    parcelasPagas: pagas.sort((a, b) => a.num - b.num),
    parcelaPaga: pagas.length,
    parcelasAtrasadas: atrasos
  });

  await loadGastos();
  showToast('✅ Atraso marcado como pago');
  renderParcelados();
  renderDashboard();
  renderDivisao();
  if (currentTab === 'calendario') renderCalendario();
};

// ============ DESFAZER PAGAMENTO PARCELADO ============
window.desfazerPagamentoParcelado = async function (gastoId) {
  const g = gastos.find(x => x.id === gastoId);
  if (!g) return;

  confirmarAcao({
    titulo: 'Voltar para "Em andamento"',
    mensagem: `Deseja remover <b>todas as marcações de pago</b> de <b>${escHtml(g.loja)}</b> e voltar para a lista de parcelados em andamento?`,
    icone: '↩️',
    tipoBotao: 'warning',
    textoBotao: 'Sim, desfazer pagamentos',
    onConfirm: async () => {
      await atualizarGastoParcelado(g, {
        parcelasPagas: [],
        parcelaPaga: 0,
        parcelasAtrasadas: []
      });
      await loadGastos();
      showToast(`↩️ ${g.loja} voltou para "Parcelados em andamento"`);
      renderParcelados();
      renderDashboard();
      renderDivisao();
      if (currentTab === 'calendario') renderCalendario();
    }
  });
};


window.abrirModalParcelas = function (idOrObj) {
  const g = typeof idOrObj === 'string' ? gastos.find(x => x.id === idOrObj) : idOrObj;
  if (!g) return;

  const parcelasPagas = Array.isArray(g.parcelasPagas) ? g.parcelasPagas : [];
  const modal         = document.getElementById('modal-parcelas');
  const mesAtual      = new Date().toISOString().slice(0, 7);
  const numAtual      = numParcelaNoMes(g, mesAtual);
  const pagasNums     = numsParcelasPagas(g);
  const atualPendente = numAtual && !pagasNums.includes(numAtual);

  document.getElementById('mp-titulo').textContent = `Parcelas — ${g.loja}`;

  // --- calcula disponíveis para adiantamento ---
  const _todasNums = Array.from({ length: g.parcelas }, (_, i) => i + 1);
  const _pagasNums = numsParcelasPagas(g);
  const _futuras   = _todasNums.filter(n => !_pagasNums.includes(n) && (!numAtual || n > numAtual));
  const _maxAdiant = _futuras.length;

  let rows = `
    <div class="mp-adiantar-box">
      <div class="mp-adiantar-header">
        <div class="mp-adiantar-title">💳 Adiantar Parcelas</div>
        <div class="mp-adiantar-sub">
          ${atualPendente ? `Parcela do mês atual: <b>${numAtual}/${g.parcelas}</b>. ` : ''}
          ${_maxAdiant > 0
            ? `<b>${_maxAdiant}</b> futura${_maxAdiant !== 1 ? 's' : ''} disponível${_maxAdiant !== 1 ? 'is' : ''} para adiantar.`
            : '<b>Nenhuma parcela futura em aberto.</b>'}
        </div>
      </div>
      ${_maxAdiant > 0 ? `
      <div class="mp-adiantar-form">
        <div class="mp-adiantar-row">
          <div class="mp-adiantar-field">
            <label>Quantas parcelas adiantar</label>
            <input type="number" id="mp-adiantar-qtd" min="1" max="${_maxAdiant}" value="1" oninput="previewAdiantamento('${g.id}')" />
          </div>
          <div class="mp-adiantar-field">
            <label>Pagar no dia</label>
            <select id="mp-adiantar-dia" onchange="previewAdiantamento('${g.id}')">
              <option value="15">📅 Dia 15</option>
              <option value="30">📅 Dia 30</option>
            </select>
          </div>
        </div>
        <div class="mp-adiantar-preview" id="mp-adiantar-preview"></div>
        <button type="button" class="mp-adiantar-btn" onclick="adiantarParcelas('${g.id}')">
          ✅ Confirmar adiantamento
        </button>
      </div>
      ` : ''}
    </div>
  `;
  // preview inicial
  setTimeout(() => previewAdiantamento(g.id), 0);
  for (let i = 1; i <= g.parcelas; i++) {
    const pagaObj  = parcelasPagas.find(p => p.num === i);
    const paga     = !!pagaObj;
    const agendada = Array.isArray(g.parcelasAgendadas)
      ? g.parcelasAgendadas.find(a => a.num === i && a.adiantadaMes === (new Date().toISOString().slice(0, 7)))
      : null;
    const vencimento = formatVencimentoParcela(g, i);
    const statusClass = paga ? 'mp-paga' : agendada ? 'mp-pendente' : '';
    const statusLabel = paga ? 'Paga' : agendada ? `⏳ Ag. dia ${agendada.adiantadaDia}` : 'Marcar';
    rows += `
      <div class="mp-row ${statusClass}">
        <div class="mp-num">${i}/${g.parcelas}</div>
        <input type="number" class="mp-val-input" value="${valorParcela(g, i).toFixed(2)}" min="0" step="0.01" onchange="editarValorParcela('${g.id}', ${i}, this.value)">
        <div class="mp-venc">${vencimento ? `Dia ${vencimento}` : '—'}</div>
        <div class="mp-data-paga">${paga ? formatData(pagaObj.data) : agendada ? `Agendada ${formatData(agendada.data)}` : '—'}</div>
        <label class="mp-check-label">
          <input type="checkbox" class="mp-check" data-num="${i}" ${paga ? 'checked' : ''} onchange="toggleParcelaPaga('${g.id}', ${i}, this.checked)">
          <span class="mp-check-custom"></span>
          ${statusLabel}
        </label>
      </div>
    `;
  }

  document.getElementById('mp-lista').innerHTML = rows;
  modal.classList.add('open');
};

function formatVencimentoParcela(g, numParcela) {
  if (!g?.vencimentoDia || !g?.data) return '';
  const inicio = new Date(g.data + 'T12:00:00');
  const ano = inicio.getFullYear();
  const mes = inicio.getMonth() + numParcela - 1;
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const dia = Math.min(parseInt(g.vencimentoDia), ultimoDia);
  const dataVenc = new Date(ano, mes, dia);
  return formatData(dataVenc.toISOString().split('T')[0]);
}

window.fecharModalParcelas = function () {
  document.getElementById('modal-parcelas').classList.remove('open');
};

window.toggleParcelaPaga = async function (gastoId, num, checked) {
  const { doc, updateDoc } = fns();
  const g = gastos.find(x => x.id === gastoId);
  if (!g) return;

  let pagas = Array.isArray(g.parcelasPagas) ? [...g.parcelasPagas] : [];

  if (checked) {
    if (!pagas.find(p => p.num === num)) {
      // Usa a data de vencimento do mês que pertence a essa parcela,
      // não a data de hoje — evita que parcelas antigas entrem no ciclo atual do dashboard
      const mesDaParcela = mesParcela(g, num);
      const diaVenc = diaVencimentoNoMes(g, mesDaParcela);
      const dataParcela = `${mesDaParcela}-${String(diaVenc).padStart(2, '0')}`;
      pagas.push({ num, data: dataParcela });
    }
  } else {
    pagas = pagas.filter(p => p.num !== num);
  }
  const atrasos = parcelasAtrasadasObj(g).map(a =>
    a.num === num && checked ? { ...a, resolvido: true, pagoEm: new Date().toISOString().split('T')[0] } : a
  );

  await updateDoc(doc(db(), `users/${uid()}/gastos`, gastoId), {
    parcelasPagas: pagas,
    parcelaPaga:   pagas.length,
    parcelasAtrasadas: atrasos
  });

  g.parcelasPagas = pagas;
  g.parcelaPaga   = pagas.length;
  g.parcelasAtrasadas = atrasos;

  abrirModalParcelas(gastoId);
  renderParcelados();
  renderDashboard();
  renderDivisao();
  if (currentTab === 'calendario') renderCalendario();
};

// ============ PREVIEW ADIANTAMENTO ============
window.previewAdiantamento = function (gastoId) {
  const g = gastos.find(x => x.id === gastoId);
  if (!g) return;

  const el = document.getElementById('mp-adiantar-preview');
  if (!el) return;

  const qtdEl = document.getElementById('mp-adiantar-qtd');
  const diaEl = document.getElementById('mp-adiantar-dia');
  if (!qtdEl || !diaEl) return;

  const qtd    = Math.max(1, parseInt(qtdEl.value) || 1);
  const dia    = parseInt(diaEl.value) || 15;
  const mesAtual = new Date().toISOString().slice(0, 7);
  const numAtual = numParcelaNoMes(g, mesAtual);
  const pagas    = parcelasPagasObj(g);
  const pagasNums = pagas.map(p => p.num);

  // Já agendadas para este mês
  const jaAgendadas = Array.isArray(g.parcelasAgendadas)
    ? g.parcelasAgendadas.filter(a => a.adiantadaMes === mesAtual).map(a => a.num)
    : [];

  const pendentes = Array.from({ length: g.parcelas }, (_, i) => i + 1)
    .filter(n => !pagasNums.includes(n) && !jaAgendadas.includes(n));
  const futuras   = pendentes.filter(n => !numAtual || n > numAtual);
  const selecionadas = futuras.slice(0, qtd);

  if (!selecionadas.length) {
    el.innerHTML = '<p style="color:var(--text3);font-size:12px">Nenhuma parcela futura disponível para adiantar.</p>';
    return;
  }

  const totalVal  = totalParcelas(g, selecionadas);
  const [anoStr, mesStr] = mesAtual.split('-');
  const ano = parseInt(anoStr);
  const mes = parseInt(mesStr) - 1;
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const diaReal   = Math.min(dia, ultimoDia);
  const dataFmt   = `${String(diaReal).padStart(2,'0')}/${String(mes+1).padStart(2,'0')}/${ano}`;

  const agendadasTxt = jaAgendadas.length
    ? `<div class="mp-preview-row" style="color:var(--accent)"><span>⏳ Já agendadas (aguardando fatura)</span><b>${jaAgendadas.map(n => `${n}ª`).join(', ')}</b></div>`
    : '';

  // Monta texto de preview — se dia 30 e mais de 1 parcela, mostra a divisão
  let dataPagamentoTxt = `Dia ${dia} — ${dataFmt}`;
  let splitHtml = '';
  if (dia === 30 && selecionadas.length > 1) {
    const metade = Math.ceil(selecionadas.length / 2);
    const p15 = selecionadas.slice(0, metade);
    const p30 = selecionadas.slice(metade);
    const v15 = totalParcelas(g, p15);
    const v30 = totalParcelas(g, p30);
    dataPagamentoTxt = 'Dividido entre dia 15 e dia 30';
    splitHtml = `
      <div class="mp-preview-row" style="color:var(--accent)">
        <span>📅 Dia 15 — Parcelas ${p15.map(n => n+'ª').join(', ')}</span>
        <b>${fmtR(v15)}</b>
      </div>
      <div class="mp-preview-row" style="color:var(--blue)">
        <span>📅 Dia 30 — Parcelas ${p30.map(n => n+'ª').join(', ')}</span>
        <b>${fmtR(v30)}</b>
      </div>`;
  }

  el.innerHTML = `
    <div class="mp-adiantar-preview-content">
      ${agendadasTxt}
      <div class="mp-preview-row">
        <span>Parcelas a adiantar</span>
        <b>${selecionadas.map(n => `${n}ª`).join(', ')}</b>
      </div>
      <div class="mp-preview-row">
        <span>Data de pagamento</span>
        <b>${dataPagamentoTxt}</b>
      </div>
      ${splitHtml}
      <div class="mp-preview-row mp-preview-total">
        <span>💰 Total a pagar na fatura</span>
        <b style="color:var(--accent);font-size:16px">${fmtR(totalVal)}</b>
      </div>
      <div class="mp-preview-hint">
        ⚠️ O valor só será descontado do saldo quando você clicar <b>"Fatura do mês paga"</b>.
      </div>
    </div>
  `;
};

window.adiantarParcelas = async function (gastoId) {
  const g = gastos.find(x => x.id === gastoId);
  if (!g) return;

  const qtdEl = document.getElementById('mp-adiantar-qtd');
  const diaEl = document.getElementById('mp-adiantar-dia');
  if (!qtdEl || !diaEl) return;

  const qtd    = Math.max(1, parseInt(qtdEl.value) || 1);
  const dia    = parseInt(diaEl.value) || 15;

  const mesAtual  = new Date().toISOString().slice(0, 7);
  const numAtual  = numParcelaNoMes(g, mesAtual);
  const pagas     = parcelasPagasObj(g);
  const pagasNums = pagas.map(p => p.num);

  // Parcelas já agendadas para adiantamento neste mês (mas ainda não pagas)
  const jaAgendadas = Array.isArray(g.parcelasAgendadas)
    ? g.parcelasAgendadas.filter(a => a.adiantadaMes === mesAtual).map(a => a.num)
    : [];

  const pendentes = Array.from({ length: g.parcelas }, (_, i) => i + 1)
    .filter(n => !pagasNums.includes(n) && !jaAgendadas.includes(n));
  const futuras   = pendentes.filter(n => !numAtual || n > numAtual);
  const selecionadas = futuras.slice(0, qtd);

  if (!selecionadas.length) {
    showToast('⚠️ Nenhuma parcela futura disponível para adiantar');
    return;
  }

  // Monta data de pagamento (dia 15 ou 30 do mês atual)
  const [anoStr, mesStrNum] = mesAtual.split('-');
  const ano = parseInt(anoStr);
  const mes = parseInt(mesStrNum) - 1;
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const diaReal   = Math.min(dia, ultimoDia);

  // Quando dia 30 selecionado e há mais de 1 parcela: divide entre dia 15 e dia 30
  const agendamentosExistentes = Array.isArray(g.parcelasAgendadas) ? g.parcelasAgendadas : [];
  let novosAgendamentosBrutos;
  if (dia === 30 && selecionadas.length > 1) {
    const metade = Math.ceil(selecionadas.length / 2);
    const diaReal15 = Math.min(15, ultimoDia);
    const diaReal30 = Math.min(30, ultimoDia);
    const dataPag15 = `${anoStr}-${mesStrNum}-${String(diaReal15).padStart(2, '0')}`;
    const dataPag30 = `${anoStr}-${mesStrNum}-${String(diaReal30).padStart(2, '0')}`;
    novosAgendamentosBrutos = [
      ...selecionadas.slice(0, metade).map(num => ({
        num, data: dataPag15, adiantadaMes: mesAtual, adiantadaDia: 15
      })),
      ...selecionadas.slice(metade).map(num => ({
        num, data: dataPag30, adiantadaMes: mesAtual, adiantadaDia: diaReal30
      }))
    ];
  } else {
    const dataPag = `${anoStr}-${mesStrNum}-${String(diaReal).padStart(2, '0')}`;
    novosAgendamentosBrutos = selecionadas.map(num => ({
      num, data: dataPag, adiantadaMes: mesAtual, adiantadaDia: diaReal
    }));
  }

  // Salva como AGENDAMENTO (não como pago) — ficará pendente até "Fatura do mês paga"
  const novosAgendamentos = [
    ...agendamentosExistentes,
    ...novosAgendamentosBrutos
  ].sort((a, b) => a.num - b.num);

  const { doc, updateDoc } = fns();
  await updateDoc(doc(db(), `users/${uid()}/gastos`, gastoId), {
    parcelasAgendadas: novosAgendamentos
  });

  g.parcelasAgendadas = novosAgendamentos;

  const totalPago = totalParcelas(g, selecionadas);
  const splitMsg = (dia === 30 && selecionadas.length > 1)
    ? 'divididas entre dia 15 e dia 30'
    : `para o dia ${diaReal}`;
  showToast(`📋 ${selecionadas.length} parcela${selecionadas.length !== 1 ? 's' : ''} agendada${selecionadas.length !== 1 ? 's' : ''} ${splitMsg}. Confirme com "Fatura do mês paga" para descontar do saldo.`, true);
  abrirModalParcelas(gastoId);
  renderParcelados();
  renderDashboard();
  renderDivisao();
  if (currentTab === 'calendario') renderCalendario();
};

window.editarValorParcela = async function (gastoId, num, valorRaw) {
  const valor = parseFloat(valorRaw);
  if (!valor || valor <= 0) { showToast('⚠️ Informe um valor válido para a parcela'); return; }

  const g = gastos.find(x => x.id === gastoId);
  if (!g) return;

  const { doc, updateDoc } = fns();
  const parcelasValores = Array.from({ length: g.parcelas }, (_, i) => {
    const parcelaNum = i + 1;
    return {
      num: parcelaNum,
      valor: parcelaNum === num ? valor : valorParcela(g, parcelaNum)
    };
  });
  const novoTotal = parcelasValores.reduce((s, p) => s + p.valor, 0);

  await updateDoc(doc(db(), `users/${uid()}/gastos`, gastoId), {
    parcelasValores,
    valor: novoTotal
  });

  g.parcelasValores = parcelasValores;
  g.valor = novoTotal;
  showToast('✅ Valor da parcela atualizado');
  abrirModalParcelas(gastoId);
  renderParcelados();
  renderDashboard();
  if (currentTab === 'calendario') renderCalendario();
};

// ============ DIVISÃO 15/30 ============
function faixaFaturaPorDia(dia) {
  return (parseInt(dia) || 0) <= 15 ? 'dia15' : 'dia30';
}

function chaveCartaoGasto(g) {
  return g?.cartaoId || g?.cartaoNome || '';
}

function nomeCartaoPorChave(chave, fallback = '') {
  return cartoes.find(c => c.id === chave)?.nome || fallback || chave || 'Cartão';
}

function faturaPagamentoKey(mes, cartaoKey, dia) {
  return `${mes}|${cartaoKey}|${parseInt(dia) === 30 ? 30 : 15}`;
}

function pagamentoFaturaCartao(mes, cartaoKey, dia) {
  const key = faturaPagamentoKey(mes, cartaoKey, dia);
  return pagamentos.find(p => p.tipo === 'fatura-cartao' && p.faturaKey === key);
}

function faturaCartaoPaga(mes, cartaoKey, dia) {
  return !!pagamentoFaturaCartao(mes, cartaoKey, dia);
}

function diaFaturaGasto(g, mes) {
  if (g?.categoria === 'Compras parceladas') return diaPagamentoParcelasNoMes(g, mes);
  if (g?.vencimentoDia) return parseInt(g.vencimentoDia) || 1;
  return parseInt(String(g?.data || '').split('-')[2]) || 1;
}

function gastoEstaEmFaturaPaga(g, mes) {
  const cartaoKey = chaveCartaoGasto(g);
  if (!cartaoKey) return false;
  const dia = faixaFaturaPorDia(diaFaturaGasto(g, mes)) === 'dia15' ? 15 : 30;
  return faturaCartaoPaga(mes, cartaoKey, dia);
}

function filtrarFaturasPendentes(gastosMes, mes) {
  return gastosMes.filter(g => !gastoEstaEmFaturaPaga(g, mes));
}

function renderDivisaoMeses() {
  const select  = document.getElementById('div-mes-select');
  const meses   = getLast6Months().reverse();
  select.innerHTML = meses.map(m => `<option value="${m}">${formatMes(m)}</option>`).join('');
  const mesAtual = new Date().toISOString().slice(0, 7);
  if (meses.includes(mesAtual)) select.value = mesAtual;
  renderDivisao();
}

window.renderDivisao = function () {
  const mes         = document.getElementById('div-mes-select').value;
  document.getElementById('div-mes-label').textContent = formatMes(mes);

  // Gastos PENDENTES — exclui recorrentes inativos E recorrentes divisivel=false
  const recExcluirDivisaoIds = new Set(
    recorrentes.filter(r => r.ativo === false || r.divisivel === false).map(r => r.id)
  );
  const gastosDoMesPendente = filtrarFaturasPendentes(gastosResumoMesPendente(mes), mes).filter(g =>
    !(g.recorrenteId && recExcluirDivisaoIds.has(g.recorrenteId))
  );
  const totalGastosPendente = gastosDoMesPendente.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);

  // Gastos TOTAIS do mês (pagos + pendentes) — para mostrar no detalhe
  const gastosDoMesTodos    = gastosResumoMes(mes).filter(g =>
    !(g.recorrenteId && recExcluirDivisaoIds.has(g.recorrenteId))
  );
  const totalGastosTodos    = gastosDoMesTodos.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);

  const salObj  = salarios.find(s => s.mes === mes);
  const salario = salarioTotal(salObj);
  const extras  = totalExtrasSalario(salObj);
  const renda   = rendaTotalMes(salObj, mes);
  // Quanto já foi confirmado manualmente neste mês
  const totalJaPago = parceladosPagosMes(mes).reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
  const totalPagamentosConfirmados = totalPagamentosMes(mes);

  // Saldo líquido só desconta faturas/pagamentos confirmados, não pendências futuras.
  const saldo  = renda - totalJaPago - totalPagamentosConfirmados;
  const metade = saldo > 0 ? saldo / 2 : 0;

  document.getElementById('div-15').textContent = fmtR(metade);
  document.getElementById('div-30').textContent = fmtR(metade);

  const cats      = ['Alimentação', 'Compras parceladas', 'Compras recorrentes', 'Compras futuras', 'Roupas e calçados', 'Lazer', 'Auto-cuidado', 'Transporte'];
  const catTotais = cats.map(c => ({
    cat: c,
    val: gastosDoMesPendente.filter(g => g.categoria === c).reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)
  })).filter(x => x.val > 0);

  const jaPagoHtml = totalJaPago > 0 ? `
    <div class="div-row" style="background:rgba(61,214,140,0.06);border-radius:8px;padding:10px 12px;margin-bottom:4px">
      <span class="div-row-label" style="color:var(--green)">✅ Parcelas já pagas este mês</span>
      <span class="div-row-val" style="color:var(--green)">− ${fmtR(totalJaPago)}</span>
    </div>` : '';

  // Aviso sobre recorrentes excluídas (divisivel=false) — transparência ao usuário
  const recExcluidas = recorrentes.filter(r => r.ativo !== false && r.divisivel === false);
  const recExcluidasHtml = recExcluidas.length > 0 ? `
    <div class="div-row" style="background:rgba(77,157,224,0.05);border-radius:8px;padding:8px 12px;border:1px solid rgba(77,157,224,0.15);margin-top:2px">
      <span class="div-row-label" style="color:var(--blue);font-size:12px">📅 Fora desta divisão (só no calendário)</span>
      <span class="div-row-val" style="color:var(--text3);font-size:12px">${recExcluidas.map(r => escHtml(r.loja)).join(', ')}</span>
    </div>` : '';

  document.getElementById('div-detail').innerHTML = `
    <div class="div-row"><span class="div-row-label">Salário</span><span class="div-row-val pos">${fmtR(salario - extras)}</span></div>
    ${extras > 0 ? `<div class="div-row"><span class="div-row-label">Dinheiro externo</span><span class="div-row-val pos">${fmtR(extras)}</span></div>` : ''}
    <div class="div-row"><span class="div-row-label">Renda total</span><span class="div-row-val">${fmtR(renda)}</span></div>
    ${jaPagoHtml}
    ${totalPagamentosConfirmados > 0 ? `<div class="div-row" style="background:rgba(61,214,140,0.06);border-radius:8px;padding:10px 12px;margin-bottom:4px"><span class="div-row-label" style="color:var(--green)">✅ Pagamentos confirmados</span><span class="div-row-val" style="color:var(--green)">− ${fmtR(totalPagamentosConfirmados)}</span></div>` : ''}
    ${catTotais.map(x => `<div class="div-row"><span class="div-row-label">↳ ${x.cat} (pendente)</span><span class="div-row-val neg">− ${fmtR(x.val)}</span></div>`).join('')}
    <div class="div-row"><span class="div-row-label"><b>Total pendente</b></span><span class="div-row-val neg">− ${fmtR(totalGastosPendente)}</span></div>
    <div class="div-row"><span class="div-row-label"><b>Saldo líquido confirmado</b></span><span class="div-row-val ${saldo >= 0 ? 'pos' : 'neg'}">${fmtR(saldo)}</span></div>
    <div class="div-row" style="background:rgba(240,192,64,0.06);border-radius:8px;padding:12px;margin-top:4px">
      <span class="div-row-label"><b>Guardar dia 15</b></span>
      <span class="div-row-val" style="color:var(--accent)">${fmtR(metade)}</span>
    </div>
    <div class="div-row" style="background:rgba(240,192,64,0.06);border-radius:8px;padding:12px">
      <span class="div-row-label"><b>Guardar dia 30</b></span>
      <span class="div-row-val" style="color:var(--accent)">${fmtR(metade)}</span>
    </div>
    ${recExcluidasHtml}
  `;

  // Por cartão (todos) — usando apenas pendentes
  renderDivisaoPorCartao(mes);
};

window.pagarFaturaCartaoDivisao = async function (cartaoKeyEncoded, dia) {
  const cartaoKey = decodeURIComponent(cartaoKeyEncoded || '');
  const diaFatura = parseInt(dia) === 30 ? 30 : 15;
  const mes = document.getElementById('div-mes-select')?.value || new Date().toISOString().slice(0, 7);
  const faturaKey = faturaPagamentoKey(mes, cartaoKey, diaFatura);

  if (pagamentos.some(p => p.tipo === 'fatura-cartao' && p.faturaKey === faturaKey)) {
    showToast('✅ Essa fatura já foi paga.');
    return;
  }

  const recExcluirDivisaoIds = new Set(
    recorrentes.filter(r => r.ativo === false || r.divisivel === false).map(r => r.id)
  );
  const itens = filtrarFaturasPendentes(gastosResumoMesPendente(mes), mes).filter(g =>
    chaveCartaoGasto(g) === cartaoKey &&
    faixaFaturaPorDia(diaFaturaGasto(g, mes)) === faixaFaturaPorDia(diaFatura) &&
    !(g.recorrenteId && recExcluirDivisaoIds.has(g.recorrenteId))
  );

  if (!itens.length) {
    showToast('✅ Nenhuma fatura pendente para esse cartão e dia.');
    return;
  }

  const totalFatura = itens.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
  const totalNaoParcelado = itens
    .filter(g => g.categoria !== 'Compras parceladas')
    .reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
  const cartaoNome = nomeCartaoPorChave(cartaoKey, itens[0]?.cartaoNome || 'Cartão');

  confirmarAcao({
    titulo: 'Confirmar pagamento da fatura',
    mensagem: `Dar baixa em <b>${escHtml(cartaoNome)}</b> no <b>dia ${diaFatura}</b>?<br><small style="color:var(--text3)">Total: ${fmtR(totalFatura)}. Essa fatura não poderá ser descontada novamente.</small>`,
    icone: '✅',
    tipoBotao: 'info',
    textoBotao: 'Confirmar pagamento',
    onConfirm: async () => {
      const { collection, addDoc } = fns();
      const dataPag = `${mes}-${String(Math.min(diaFatura, new Date(Number(mes.slice(0,4)), Number(mes.slice(5,7)), 0).getDate())).padStart(2, '0')}`;

      for (const g of itens.filter(x => x.categoria === 'Compras parceladas')) {
        const numAtual = numParcelaNoMes(g, mes);
        const pagasNums = numsParcelasPagas(g);
        const agendadas = Array.isArray(g.parcelasAgendadas)
          ? g.parcelasAgendadas.filter(a => a.adiantadaMes === mes && faixaFaturaPorDia(a.adiantadaDia) === faixaFaturaPorDia(diaFatura))
          : [];
        const nums = [
          ...(numAtual && !pagasNums.includes(numAtual) ? [numAtual] : []),
          ...agendadas.map(a => a.num).filter(n => !pagasNums.includes(n))
        ];
        if (!nums.length) continue;

        const pagas = parcelasPagasObj(g).filter(p => !nums.includes(p.num));
        nums.forEach(num => {
          const ag = agendadas.find(a => a.num === num);
          pagas.push({
            num,
            data: ag?.data || dataPag,
            adiantadaMes: ag?.adiantadaMes,
            adiantadaDia: ag?.adiantadaDia,
            faturaCartaoKey: faturaKey
          });
        });

        const atrasos = parcelasAtrasadasObj(g).map(a =>
          nums.includes(a.num) && a.mesOrigem === mes ? { ...a, resolvido: true, pagoEm: dataPag } : a
        );
        const agendamentosRestantes = (g.parcelasAgendadas || []).filter(a => !nums.includes(a.num));

        await atualizarGastoParcelado(g, {
          parcelasPagas: pagas.sort((a, b) => a.num - b.num),
          parcelaPaga: pagas.length,
          parcelasAtrasadas: atrasos,
          parcelasAgendadas: agendamentosRestantes
        });
      }

      const docRef = await addDoc(collection(db(), `users/${uid()}/pagamentos`), {
        mes,
        dia: diaFatura,
        valor: totalFatura,
        valorSaldo: totalNaoParcelado,
        tipo: 'fatura-cartao',
        descricao: `Fatura ${cartaoNome} (dia ${diaFatura})`,
        cartaoId: cartoes.find(c => c.id === cartaoKey)?.id || null,
        cartaoNome,
        faturaKey,
        criadoEm: new Date().toISOString()
      });
      pagamentos.push({ id: docRef.id, mes, dia: diaFatura, valor: totalFatura, valorSaldo: totalNaoParcelado, tipo: 'fatura-cartao', descricao: `Fatura ${cartaoNome} (dia ${diaFatura})`, cartaoNome, faturaKey });

      await loadGastos();
      await loadPagamentos();
      showToast('✅ Fatura paga e saldo atualizado!', true);
      renderDivisao();
      renderParcelados();
      renderRecorrentes();
      renderDashboard();
      if (currentTab === 'pagamentos') renderPagamentos();
      if (currentTab === 'calendario') renderCalendario();
    }
  });
};
// ============ DIVISÃO POR CARTÃO ============
function renderDivisaoPorCartao(mes) {
  const el = document.getElementById('div-por-cartao');
  if (!el) return;

  // Usa APENAS gastos pendentes — exclui recorrentes inativos e divisivel=false
  const _recExcCartaoIds = new Set(
    recorrentes.filter(r => r.ativo === false || r.divisivel === false).map(r => r.id)
  );
  const gastosDoMes = filtrarFaturasPendentes(gastosResumoMesPendente(mes), mes).filter(g =>
    !(g.recorrenteId && _recExcCartaoIds.has(g.recorrenteId))
  );
  const comCartao = gastosDoMes.filter(g => g.cartaoId || g.cartaoNome);

  if (!comCartao.length && !cartoes.length) { el.innerHTML = ''; return; }

  // Agrupa por cartão
  const porCartao = {};
  comCartao.forEach(g => {
    const key = g.cartaoId || g.cartaoNome || 'Sem cartão';
    if (!porCartao[key]) porCartao[key] = { nome: g.cartaoNome || key, total: 0, itens: [] };
    porCartao[key].total += parseFloat(g.valor) || 0;
    porCartao[key].itens.push(g);
  });

  const cartaoCards = Object.entries(porCartao).map(([key, { nome, total, itens }]) => {
    const cartaoObj = cartoes.find(c => c.id === key);
    const cor = cartaoObj?.cor || '#8b92a8';

    const totalLiquido = total;
    const fatura15Bruta = itens
      .filter(g => faixaFaturaPorDia(diaFaturaGasto(g, mes)) === 'dia15')
      .reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
    const fatura30Bruta = itens
      .filter(g => faixaFaturaPorDia(diaFaturaGasto(g, mes)) === 'dia30')
      .reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
    const fatura15 = fatura15Bruta;
    const fatura30 = fatura30Bruta;
    const btn15Disabled = fatura15 <= 0 || faturaCartaoPaga(mes, key, 15);
    const btn30Disabled = fatura30 <= 0 || faturaCartaoPaga(mes, key, 30);

    return `
      <div class="div-cartao-card" style="border-left:4px solid ${cor}">
        <div class="div-cartao-header">
          <div>
            <div class="div-cartao-nome">💳 ${escHtml(nome)}</div>
            <div class="div-cartao-sub">${itens.length} lançamento${itens.length !== 1 ? 's' : ''}</div>
          </div>
          <div class="div-cartao-total">${fmtR(totalLiquido)}</div>
        </div>
        <div class="div-cartao-divisao">
          <div class="div-cartao-meta">
            <div class="div-cartao-meta-dia">Dia 15</div>
            <div class="div-cartao-meta-val">${fmtR(fatura15)}</div>
          </div>
          <div class="div-cartao-sep">+</div>
          <div class="div-cartao-meta">
            <div class="div-cartao-meta-dia">Dia 30</div>
            <div class="div-cartao-meta-val">${fmtR(fatura30)}</div>
          </div>
        </div>
        <div class="div-cartao-actions">
          <button type="button" class="btn-fatura-divisao" ${btn15Disabled ? 'disabled' : ''} onclick="pagarFaturaCartaoDivisao('${encodeURIComponent(key)}', 15)">
            ${faturaCartaoPaga(mes, key, 15) ? 'Pago' : 'Pagar'} ${escHtml(nome)} (dia 15)
          </button>
          <button type="button" class="btn-fatura-divisao" ${btn30Disabled ? 'disabled' : ''} onclick="pagarFaturaCartaoDivisao('${encodeURIComponent(key)}', 30)">
            ${faturaCartaoPaga(mes, key, 30) ? 'Pago' : 'Pagar'} ${escHtml(nome)} (dia 30)
          </button>
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = cartaoCards ? `
    <div style="margin-bottom:20px">
      <div style="font-family:var(--font-head);font-size:13px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">
        💳 Por Cartão
      </div>
      <div class="div-cartao-grid">${cartaoCards}</div>
    </div>
  ` : '';
}

// ============ CALENDÁRIO ============
window.calNavMes = function (dir) {
  calMesAtual += dir;
  if (calMesAtual > 11) { calMesAtual = 0;  calAnoAtual++; }
  if (calMesAtual < 0)  { calMesAtual = 11; calAnoAtual--; }
  calDiaSelecionado = null;
  document.getElementById('cal-detalhe').style.display = 'none';
  renderCalendario();
};

window.fecharDetalhe = function () {
  calDiaSelecionado = null;
  document.getElementById('cal-detalhe').style.display = 'none';
  document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selecionado'));
};

function renderCalendario() {
  const mes = calMesAtual;
  const ano = calAnoAtual;
  const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('cal-mes-titulo').textContent = `${nomesMes[mes]} ${ano}`;

  const mesStr       = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const _recInativosCal = new Set(recorrentes.filter(r => r.ativo === false).map(r => r.id));
  const gastosDoMes  = gastos.filter(g =>
    g.data.startsWith(mesStr) &&
    g.categoria !== 'Compras parceladas' &&
    !(g.recorrenteId && _recInativosCal.has(g.recorrenteId))
  );
  const parceladosAt = gastos.filter(g =>
    g.categoria === 'Compras parceladas' && valorParcelasNoMes(g, mesStr) > 0
  );
  const atrasosDoMes = gastos
    .filter(g => g.categoria === 'Compras parceladas')
    .flatMap(g => atrasosPendentes(g)
      .filter(a => (a.mesUrgente || proximoMes(a.mesOrigem)) === mesStr)
      .map(a => ({ g, a }))
    );

  const pagsDoMes = pagamentos.filter(p => p.mes === mesStr);

  const totalGastosMes = gastosDoMes.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)
    + parceladosAt.reduce((s, g) => s + valorParcelasNoMes(g, mesStr), 0)
    + atrasosDoMes.reduce((s, item) => s + valorParcela(item.g, item.a.num), 0);
  const diasComGasto = new Set([
    ...gastosDoMes.map(g => g.data),
    ...parceladosAt.map(g => `${mesStr}-${String(diaPagamentoParcelasNoMes(g, mesStr)).padStart(2, '0')}`),
    ...atrasosDoMes.map(item => dataUrgenteAtraso(item.g, item.a))
  ]).size;

  document.getElementById('cal-total-mes').textContent       = fmtR(totalGastosMes);
  document.getElementById('cal-dias-gastos').textContent     = diasComGasto;
  document.getElementById('cal-parcelas-ativas').textContent = parceladosAt.length;

  const diasMap = {};

  gastosDoMes.forEach(g => {
    const dia = parseInt(g.data.split('-')[2]);
    if (!diasMap[dia]) diasMap[dia] = [];
    diasMap[dia].push({ tipo: 'gasto', g });
  });

  parceladosAt.forEach(g => {
    const dia = diaPagamentoParcelasNoMes(g, mesStr);
    if (!diasMap[dia]) diasMap[dia] = [];
    const numParcela = numParcelaNoMes(g, mesStr);
    const adiantadas = parcelasAdiantadasNoMes(g, mesStr, numParcela);
    diasMap[dia].push({
      tipo: 'parcela',
      g,
      numParcela: numParcela || adiantadas[0]?.num || null,
      adiantadas,
      valorTotalMes: valorParcelasNoMes(g, mesStr),
      diaVence: dia
    });
  });

  atrasosDoMes.forEach(({ g, a }) => {
    const dataUrg = dataUrgenteAtraso(g, a);
    const dia = parseInt(dataUrg.split('-')[2]);
    if (!diasMap[dia]) diasMap[dia] = [];
    diasMap[dia].push({ tipo: 'atraso', g, atraso: a, valor: valorParcela(g, a.num) });
  });

  pagsDoMes.forEach(p => {
    const dia = parseInt(p.dia);
    if (!diasMap[dia]) diasMap[dia] = [];
    diasMap[dia].push({ tipo: 'pagamento', p });
  });

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias   = new Date(ano, mes + 1, 0).getDate();
  const hoje        = new Date();
  const hojeStr     = hoje.toISOString().split('T')[0];

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  for (let i = 0; i < primeiroDia; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell vazio';
    grid.appendChild(cell);
  }

  for (let d = 1; d <= totalDias; d++) {
    const diaStr   = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const itens    = diasMap[d] || [];
    const isHoje   = diaStr === hojeStr;
    const temItem  = itens.length > 0;
    const temVence = itens.some(i => i.tipo === 'parcela' && i.diaVence === d);
    const temPagto = itens.some(i => i.tipo === 'pagamento');
    const temAtraso = itens.some(i => i.tipo === 'atraso');

    const cell = document.createElement('div');
    cell.className = ['cal-cell', isHoje ? 'hoje' : '', temItem ? 'tem-gasto' : '', temPagto ? 'tem-pagamento' : '', temAtraso ? 'tem-atraso' : ''].filter(Boolean).join(' ');
    cell.style.animationDelay = `${(d + primeiroDia) * 20}ms`;

    let totalDia = 0;
    itens.forEach(item => {
      if (item.tipo === 'gasto')   totalDia += item.g.valor;
      if (item.tipo === 'parcela') totalDia += item.valorTotalMes;
      if (item.tipo === 'atraso')  totalDia += item.valor;
    });

    const maxDots  = 2;
    const dotsHtml = itens.slice(0, maxDots).map(item => {
      if (item.tipo === 'gasto')     return `<div class="cal-dot gasto-dot">💸 ${escHtml(item.g.loja)}</div>`;
      if (item.tipo === 'parcela')   return `<div class="cal-dot parcela-dot">💳 ${escHtml(item.g.loja)} (${item.numParcela ? `${item.numParcela}/${item.g.parcelas}` : 'adiantadas'})</div>`;
      if (item.tipo === 'pagamento') return `<div class="cal-dot pag-dot">✅ Pagamento</div>`;
      if (item.tipo === 'atraso')    return `<div class="cal-dot atraso-dot">Urgente: ${escHtml(item.g.loja)}</div>`;
      return '';
    }).join('');

    const maisDots = itens.length > maxDots ? `<div class="cal-dot mais">+${itens.length - maxDots} mais</div>` : '';

    cell.innerHTML = `
      <span class="cal-cell-num">${d}</span>
      ${totalDia > 0 ? `<div class="cal-cell-total">−${fmtR(totalDia)}</div>` : ''}
      <div class="cal-cell-items">${dotsHtml}${maisDots}</div>
      ${temVence ? '<span class="cal-cell-vence">FATURA</span>' : ''}
      ${temAtraso ? '<span class="cal-cell-atraso">URGENTE</span>' : ''}
      ${temPagto ? '<span class="cal-cell-pago">✓</span>' : ''}
    `;

    cell.addEventListener('click', () => abrirDetalhe(d, diaStr, itens, temVence));
    grid.appendChild(cell);
  }

  if (calDiaSelecionado) {
    const cell = [...grid.querySelectorAll('.cal-cell:not(.vazio)')][calDiaSelecionado - 1];
    if (cell) cell.classList.add('selecionado');
  }
}

function abrirDetalhe(dia, diaStr, itens, temVencimento) {
  calDiaSelecionado = dia;
  document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selecionado'));
  const cells = document.querySelectorAll('.cal-cell:not(.vazio)');
  if (cells[dia - 1]) cells[dia - 1].classList.add('selecionado');

  document.getElementById('cal-detalhe-titulo').textContent =
    `${String(dia).padStart(2,'0')}/${String(calMesAtual+1).padStart(2,'0')}/${calAnoAtual}`;

  const body = document.getElementById('cal-detalhe-body');

  if (!itens.length && !temVencimento) {
    body.innerHTML = `<p style="color:var(--text3);font-size:14px;padding:8px 0">Nenhum gasto neste dia.</p>`;
    document.getElementById('cal-detalhe').style.display = 'block';
    return;
  }

  body.innerHTML = itens.map(item => {
    if (item.tipo === 'gasto') {
      const { icon } = catStyle(item.g.categoria);
      return `
        <div class="cal-detalhe-item">
          <div class="cal-detalhe-icon">${icon}</div>
          <div class="cal-detalhe-info">
            <div class="cal-detalhe-nome">${escHtml(item.g.loja)}</div>
            <div class="cal-detalhe-sub">${escHtml(item.g.categoria)}${item.g.descricao ? ' • ' + escHtml(item.g.descricao) : ''}</div>
            <span class="cal-detalhe-badge badge-compra">Compra</span>
          </div>
          <div class="cal-detalhe-valor">${fmtR(item.g.valor)}</div>
        </div>`;
    }
    if (item.tipo === 'parcela') {
      const valParcela = item.valorTotalMes || valorParcela(item.g, item.numParcela);
      const dataFimObj = new Date(item.g.data + 'T12:00:00');
      dataFimObj.setMonth(dataFimObj.getMonth() + item.g.parcelas - 1);
      const cartaoInfo = item.g.cartaoNome ? ` • ${escHtml(item.g.cartaoNome)}` : '';
      const vencInfo   = item.g.vencimentoDia ? ` • Vence dia ${item.g.vencimentoDia}` : '';
      const parcelasTxt = [
        item.numParcela ? `${item.numParcela}/${item.g.parcelas}` : null,
        ...(item.adiantadas || []).map(p => `${p.num}/${item.g.parcelas}`)
      ].filter(Boolean).join(' + ');
      const adiantadasTxt = item.adiantadas?.length
        ? ` • Adiantadas: ${(item.adiantadas || []).map(p => p.num).join(', ')}`
        : '';
      return `
        <div class="cal-detalhe-item">
          <div class="cal-detalhe-icon">💳</div>
          <div class="cal-detalhe-info">
            <div class="cal-detalhe-nome">${escHtml(item.g.loja)}</div>
            <div class="cal-detalhe-sub">
              Parcela <b>${parcelasTxt || 'adiantadas'}</b>${adiantadasTxt} • 
              Término em ${formatData(dataFimObj.toISOString().split('T')[0])}${cartaoInfo}${vencInfo}
            </div>
            <span class="cal-detalhe-badge badge-parcela">Parcelado</span>
          </div>
          <div class="cal-detalhe-valor parcela">${fmtR(valParcela)}</div>
        </div>`;
    }
    if (item.tipo === 'pagamento') {
      return `
        <div class="cal-detalhe-item" style="border-color:rgba(61,214,140,0.3);background:rgba(61,214,140,0.05)">
          <div class="cal-detalhe-icon">✅</div>
          <div class="cal-detalhe-info">
            <div class="cal-detalhe-nome" style="color:var(--green)">Pagamento Registrado</div>
            <div class="cal-detalhe-sub">${escHtml(item.p.descricao || '')} • ${item.p.tipo || ''}</div>
            <span class="cal-detalhe-badge badge-compra">Pago</span>
          </div>
          <div class="cal-detalhe-valor" style="color:var(--green)">${fmtR(item.p.valor)}</div>
        </div>`;
    }
    if (item.tipo === 'atraso') {
      return `
        <div class="cal-detalhe-item cal-detalhe-atraso">
          <div class="cal-detalhe-icon">⚠️</div>
          <div class="cal-detalhe-info">
            <div class="cal-detalhe-nome" style="color:var(--red)">Pagamento urgente atrasado</div>
            <div class="cal-detalhe-sub">${escHtml(item.g.loja)} • Parcela ${item.atraso.num}/${item.g.parcelas} • venceu em ${formatData(item.atraso.dataVenc)}</div>
            <span class="cal-detalhe-badge badge-vence">Atrasado</span>
          </div>
          <div class="cal-detalhe-valor">${fmtR(item.valor)}</div>
          <button type="button" class="parcelado-del-btn" onclick="pagarAtrasoParcelado('${item.g.id}', '${atrasoKey(item.atraso)}')">Pago</button>
        </div>`;
    }
    return '';
  }).join('');

  if (temVencimento) {
    const mesStr = `${calAnoAtual}-${String(calMesAtual + 1).padStart(2, '0')}`;
    const pendentes = parcelasPendentesDoMes(mesStr, dia);
    const totalParcelas = pendentes.reduce((s, item) => s + valorParcela(item.g, item.num), 0);
    const pendentesHtml = pendentes.length ? `
          <div class="cal-atraso-select-list">
            ${pendentes.map(item => `
              <label class="cal-atraso-select-item">
                <input type="checkbox" class="cal-atraso-check" data-mes="${mesStr}" value="${parcelaPendenteKey(item)}">
                <span>
                  <b>${escHtml(item.g.loja)}</b>
                  <small>Parcela ${item.num}/${item.g.parcelas}${item.g.cartaoNome ? ` • ${escHtml(item.g.cartaoNome)}` : ''} • ${fmtR(valorParcela(item.g, item.num))}</small>
                </span>
              </label>
            `).join('')}
          </div>` : '<div class="cal-atraso-empty">Nenhuma parcela pendente nessa fatura.</div>';
    const faturaActions = `
          ${pendentesHtml}
          <div class="cal-fatura-actions">
            <button type="button" class="btn-fatura-paga" onclick="quitarFaturaMes('${mesStr}', ${dia})">Tudo foi pago</button>
            <button type="button" class="btn-fatura-atraso" onclick="registrarAtrasoFaturaMes('${mesStr}', true)">Deixar selecionadas para o proximo mes</button>
          </div>`;
    body.innerHTML += `
      <div class="cal-detalhe-item" style="border-color:rgba(224,84,84,0.3);background:rgba(224,84,84,0.06)">
        <div class="cal-detalhe-icon">🔔</div>
        <div class="cal-detalhe-info">
          <div class="cal-detalhe-nome" style="color:var(--red)">Vencimento de fatura!</div>
          <div class="cal-detalhe-sub">Total de parcelas ativas: <b>${fmtR(totalParcelas)}</b>. Tudo foi pago ou algo ficou para o proximo mes?</div>
          <span class="cal-detalhe-badge badge-vence">Vencimento</span>
          ${faturaActions}
        </div>
      </div>`;
  }

  document.getElementById('cal-detalhe').style.display = 'block';
  document.getElementById('cal-detalhe').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function parceladosAtivosDoMes() {
  const mesStr = `${calAnoAtual}-${String(calMesAtual + 1).padStart(2, '0')}`;
  return gastos.filter(g => {
    return g.categoria === 'Compras parceladas' && valorParcelasNoMes(g, mesStr) > 0;
  });
}

// ============ CARTÕES ============
function renderCartoes() {
  const list = document.getElementById('cartoes-list');
  if (!cartoes.length) {
    list.innerHTML = '<p style="color:var(--text3);font-size:14px">Nenhum cartão cadastrado.</p>';
    return;
  }
  list.innerHTML = cartoes.map(c => `
    <div class="cartao-item">
      <div class="cartao-cor" style="background:${c.cor || '#f0c040'}"></div>
      <div class="cartao-info">
        <div class="cartao-nome">${escHtml(c.nome)}</div>
        <div class="cartao-meta">${c.bandeira ? escHtml(c.bandeira) + ' • ' : ''}${c.vencimentoDia ? 'Vence dia ' + c.vencimentoDia : 'Sem vencimento definido'}${c.limite ? ' • Limite ' + fmtR(c.limite) : ''}</div>
      </div>
      <button class="gasto-del" style="margin-right:6px;background:none;color:var(--text2)" onclick="editarCartao('${c.id}')" title="Editar">✎</button>
      <button class="gasto-del" onclick="deletarCartao('${c.id}')" title="Remover">✕</button>
    </div>
  `).join('');
}

let editandoCartaoId = null;

window.salvarCartao = async function () {
  const nome        = document.getElementById('cartao-nome').value.trim();
  const cor         = document.getElementById('cartao-cor').value;
  const bandeira    = document.getElementById('cartao-bandeira')?.value || '';
  const limite      = parseFloat(document.getElementById('cartao-limite')?.value) || 0;
  const vencimentoDia = parseInt(document.getElementById('cartao-vencimento')?.value) || null;
  if (!nome) { showToast('⚠️ Informe o nome do cartão'); return; }
  if (vencimentoDia && (vencimentoDia < 1 || vencimentoDia > 31)) { showToast('⚠️ Dia de vencimento inválido'); return; }

  const { collection, addDoc, doc, updateDoc } = fns();

  if (editandoCartaoId) {
    await updateDoc(doc(db(), `users/${uid()}/cartoes`, editandoCartaoId), { nome, cor, bandeira, limite, vencimentoDia });
    const idx = cartoes.findIndex(c => c.id === editandoCartaoId);
    if (idx >= 0) cartoes[idx] = { ...cartoes[idx], nome, cor, bandeira, limite, vencimentoDia };
    showToast('✅ Cartão atualizado!');
    cancelarEdicaoCartao();
  } else {
    const ref    = collection(db(), `users/${uid()}/cartoes`);
    const docRef = await addDoc(ref, { nome, cor, bandeira, limite, vencimentoDia });
    cartoes.push({ id: docRef.id, nome, cor, bandeira, limite, vencimentoDia });
    document.getElementById('cartao-nome').value = '';
    document.getElementById('cartao-limite').value = '';
    document.getElementById('cartao-vencimento').value = '';
    if (document.getElementById('cartao-bandeira')) document.getElementById('cartao-bandeira').value = '';
    showToast('✅ Cartão adicionado!');
  }
  renderCartoes();
  window.AppBus?.emit?.('cartoes_changed');
};

window.editarCartao = function (id) {
  const c = cartoes.find(x => x.id === id);
  if (!c) return;
  editandoCartaoId = id;
  document.getElementById('cartao-nome').value = c.nome || '';
  document.getElementById('cartao-cor').value = c.cor || '#f0c040';
  if (document.getElementById('cartao-bandeira')) document.getElementById('cartao-bandeira').value = c.bandeira || '';
  document.getElementById('cartao-limite').value = c.limite || '';
  document.getElementById('cartao-vencimento').value = c.vencimentoDia || '';
  document.getElementById('cartao-form-titulo').textContent = 'Editar Cartão';
  document.getElementById('cartao-salvar-btn').textContent = 'Salvar alterações';
  document.getElementById('cartao-cancelar-btn').style.display = 'inline-block';
  document.getElementById('cartao-nome').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.cancelarEdicaoCartao = function () {
  editandoCartaoId = null;
  document.getElementById('cartao-nome').value = '';
  document.getElementById('cartao-cor').value = '#f0c040';
  if (document.getElementById('cartao-bandeira')) document.getElementById('cartao-bandeira').value = '';
  document.getElementById('cartao-limite').value = '';
  document.getElementById('cartao-vencimento').value = '';
  document.getElementById('cartao-form-titulo').textContent = 'Adicionar Cartão';
  document.getElementById('cartao-salvar-btn').textContent = 'Adicionar Cartão';
  document.getElementById('cartao-cancelar-btn').style.display = 'none';
};

window.deletarCartao = async function (id) {
  const c = cartoes.find(x => x.id === id);
  confirmarAcao({
    titulo: 'Remover cartão',
    mensagem: `Deseja remover o cartão <b>${escHtml(c?.nome || '')}</b>?`,
    icone: '💳',
    tipoBotao: 'danger',
    textoBotao: 'Remover',
    onConfirm: async () => {
      const { doc, deleteDoc } = fns();
      await deleteDoc(doc(db(), `users/${uid()}/cartoes`, id));
      cartoes = cartoes.filter(c => c.id !== id);
      showToast('🗑️ Cartão removido');
      renderCartoes();
    }
  });
};

// ============ METAS ============
function renderMetas() {
  const list = document.getElementById('metas-list');
  if (!metas.length) {
    list.innerHTML = '<p style="color:var(--text3);font-size:14px;padding:20px 0">Nenhuma meta cadastrada ainda.</p>';
    return;
  }

  list.innerHTML = metas.map(m => {
    const pct     = Math.min((m.atual / m.objetivo) * 100, 100).toFixed(1);
    const falta   = Math.max(m.objetivo - m.atual, 0);
    const corMeta = m.corGrafico || m.cor || '#f0c040';
    const corBarra = pct >= 100 ? 'var(--green)' : corMeta;
    return `
      <div class="meta-item">
        <div class="meta-header">
          <div>
            <div class="meta-nome">${escHtml(m.nome)}</div>
            <div class="meta-onde">${escHtml(m.onde || '')}</div>
          </div>
          <div class="meta-vals">
            <span class="meta-atual">${fmtR(m.atual)}</span>
            <span class="meta-sep">de</span>
            <span class="meta-obj">${fmtR(m.objetivo)}</span>
          </div>
        </div>
        <div class="progress-bar-bg" style="margin:12px 0">
          <div class="progress-bar-fill" style="width:0%;background:${corBarra}" data-target="${pct}"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:12px">
          <span>${pct}% concluído</span>
          <span>Falta: <b style="color:var(--accent)">${fmtR(falta)}</b></span>
        </div>
        <div class="meta-acoes">
          <input type="number" class="meta-input" placeholder="Valor (R$)" id="meta-add-val-${m.id}" min="0" step="0.01"/>
          <button class="btn-meta-add" onclick="adicionarAMeta('${m.id}', 1)">+ Adicionar</button>
          <button class="btn-meta-rem" onclick="adicionarAMeta('${m.id}', -1)">− Remover</button>
          <label class="meta-color-edit" title="Cor do gráfico"><input type="color" value="${corMeta}" onchange="atualizarCorMeta('${m.id}', this.value)"></label>
          <button class="parcelado-del-btn" onclick="deletarMeta('${m.id}')">Excluir</button>
        </div>
      </div>
    `;
  }).join('');

  renderGraficosMetasChart();

  setTimeout(() => {
    document.querySelectorAll('.progress-bar-fill[data-target]').forEach(el => {
      el.style.width = el.dataset.target + '%';
    });
  }, 50);
}

function renderGraficosMetasChart() {
  const container = document.getElementById('metas-charts');
  if (!container || !metas.length) return;

  if (window._metaCharts) window._metaCharts.forEach(c => c.destroy());
  window._metaCharts = [];

  container.innerHTML = metas.map((m, i) => `
    <div class="meta-chart-box">
      <div class="meta-chart-titulo">${escHtml(m.nome)}</div>
      <canvas id="meta-chart-${i}" height="200"></canvas>
    </div>
  `).join('');

  metas.forEach((m, i) => {
    const canvas = document.getElementById(`meta-chart-${i}`);
    if (!canvas) return;
    const pct   = Math.min((m.atual / m.objetivo) * 100, 100);
    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Guardado', 'Restante'],
        datasets: [{
          data: [m.atual, Math.max(m.objetivo - m.atual, 0)],
          backgroundColor: [pct >= 100 ? '#3dd68c' : (m.corGrafico || m.cor || '#f0c040'), '#1a1e27'],
          borderColor: '#13161d',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${fmtR(ctx.raw)}` } }
        },
        animation: { animateRotate: true, duration: 1200 }
      }
    });
    window._metaCharts.push(chart);
  });
}

window.adicionarAMeta = async function (id, sinal) {
  const inputEl = document.getElementById(`meta-add-val-${id}`);
  const val     = parseFloat(inputEl?.value) || 0;
  if (val <= 0) { showToast('⚠️ Informe um valor'); return; }
  const meta = metas.find(m => m.id === id);
  if (!meta) return;
  const novoAtual = Math.max(0, meta.atual + sinal * val);
  const { doc, updateDoc } = fns();
  await updateDoc(doc(db(), `users/${uid()}/metas`, id), { atual: novoAtual });
  meta.atual = novoAtual;
  showToast(sinal > 0 ? '✅ Valor adicionado!' : '✅ Valor removido!');
  renderMetas();
};

let metaJaGuardado = false;
window.setMetaJaGuardado = function (val) {
  metaJaGuardado = val;
  const grupo = document.getElementById('meta-guardado-valor-group');
  const btnSim = document.getElementById('meta-guardado-btn-sim');
  const btnNao = document.getElementById('meta-guardado-btn-nao');
  if (grupo) grupo.style.display = val ? 'flex' : 'none';
  if (btnSim) btnSim.classList.toggle('active', val === true);
  if (btnNao) btnNao.classList.toggle('active', val === false);
  if (!val) {
    const campo = document.getElementById('meta-valor-guardado');
    if (campo) campo.value = '';
  }
};

window.salvarMeta = async function () {
  const nome = document.getElementById('meta-nome').value.trim();
  const obj  = parseFloat(document.getElementById('meta-objetivo').value) || 0;
  const onde = document.getElementById('meta-onde').value.trim();
  const corGrafico = document.getElementById('meta-cor')?.value || '#f0c040';
  const valorInicial = metaJaGuardado
    ? Math.max(0, parseFloat(document.getElementById('meta-valor-guardado')?.value) || 0)
    : 0;
  if (!nome || obj <= 0) { showToast('⚠️ Informe nome e objetivo'); return; }
  const { collection, addDoc } = fns();
  const ref  = collection(db(), `users/${uid()}/metas`);
  const docRef = await addDoc(ref, { nome, objetivo: obj, atual: valorInicial, onde, corGrafico, criadoEm: new Date().toISOString() });
  metas.push({ id: docRef.id, nome, objetivo: obj, atual: valorInicial, onde, corGrafico });
  document.getElementById('meta-nome').value     = '';
  document.getElementById('meta-objetivo').value = '';
  document.getElementById('meta-onde').value     = '';
  const metaCor = document.getElementById('meta-cor');
  if (metaCor) metaCor.value = '#f0c040';
  window.setMetaJaGuardado(false);
  showToast(valorInicial > 0 ? `✅ Meta criada com ${fmtR(valorInicial)} já guardados!` : '✅ Meta criada!');
  renderMetas();
};

window.atualizarCorMeta = async function (id, cor) {
  const meta = metas.find(m => m.id === id);
  if (!meta) return;
  const { doc, updateDoc } = fns();
  await updateDoc(doc(db(), `users/${uid()}/metas`, id), { corGrafico: cor });
  meta.corGrafico = cor;
  showToast('✅ Cor da meta salva!');
  renderMetas();
};
window.deletarMeta = async function (id) {
  const meta = metas.find(m => m.id === id);
  confirmarAcao({
    titulo: 'Excluir meta',
    mensagem: `Deseja excluir a meta <b>${escHtml(meta?.nome || '')}</b>?`,
    icone: '🎯',
    tipoBotao: 'danger',
    textoBotao: 'Excluir',
    onConfirm: async () => {
      const { doc, deleteDoc } = fns();
      await deleteDoc(doc(db(), `users/${uid()}/metas`, id));
      metas = metas.filter(m => m.id !== id);
      showToast('🗑️ Meta removida');
      // Destrói gráficos antes de renderizar (corrige bug da última meta)
      if (window._metaCharts) {
        window._metaCharts.forEach(c => c.destroy());
        window._metaCharts = [];
      }
      const container = document.getElementById('metas-charts');
      if (container) container.innerHTML = '';
      renderMetas();
    }
  });
};

// ============ CONTAGEM REGRESSIVA DE PAGAMENTO ============
function renderPagamentos() {
  renderCountdownPagamentos();
  const mes       = document.getElementById('pag-mes-select')?.value || new Date().toISOString().slice(0, 7);
  const pagsDoMes = pagamentos.filter(p => p.mes === mes);
  const list      = document.getElementById('pagamentos-list');

  if (!pagsDoMes.length) {
    list.innerHTML = '<p style="color:var(--text3);font-size:14px;padding:20px 0">Nenhum pagamento registrado neste mês.</p>';
    return;
  }

  list.innerHTML = pagsDoMes.map(p => `
    <div class="pag-item">
      <div class="pag-icon">${p.tipo === 'soma' ? '💰' : p.tipo === 'dividido' ? '✂️' : '📦'}</div>
      <div class="pag-info">
        <div class="pag-nome">${escHtml(p.descricao || 'Pagamento')}</div>
        <div class="pag-sub">Dia ${p.dia} • ${tipoPagLabel(p.tipo)}</div>
      </div>
      <div class="pag-valor" style="color:var(--green)">${fmtR(p.valor)}</div>
      <button class="gasto-del" onclick="deletarPagamento('${p.id}')">✕</button>
    </div>
  `).join('');
}

function tipoPagLabel(tipo) {
  const map = { individual: 'Um por um', soma: 'Soma total', dividido: 'Dividido 15/30' };
  return map[tipo] || tipo;
}

window.salvarPagamento = async function () {
  const mes   = document.getElementById('pag-mes-select')?.value || new Date().toISOString().slice(0, 7);
  const dia   = document.getElementById('pag-dia').value;
  const valor = parseFloat(document.getElementById('pag-valor').value) || 0;
  const tipo  = document.getElementById('pag-tipo').value;
  const desc  = document.getElementById('pag-desc').value.trim();

  if (!dia || valor <= 0) { showToast('⚠️ Informe dia e valor'); return; }

  const { collection, addDoc } = fns();
  const ref    = collection(db(), `users/${uid()}/pagamentos`);
  const docRef = await addDoc(ref, { mes, dia: parseInt(dia), valor, tipo, descricao: desc, criadoEm: new Date().toISOString() });
  pagamentos.push({ id: docRef.id, mes, dia: parseInt(dia), valor, tipo, descricao: desc });
  document.getElementById('pag-valor').value = '';
  document.getElementById('pag-desc').value  = '';
  showToast('✅ Pagamento registrado!');
  renderPagamentos();
  renderDashboard();
  if (currentTab === 'calendario') renderCalendario();
};

window.deletarPagamento = async function (id) {
  const p = pagamentos.find(x => x.id === id);
  confirmarAcao({
    titulo: 'Remover pagamento',
    mensagem: `Remover pagamento de <b>${fmtR(p?.valor || 0)}</b>?`,
    icone: '💸',
    tipoBotao: 'danger',
    textoBotao: 'Remover',
    onConfirm: async () => {
      const { doc, deleteDoc } = fns();
      await deleteDoc(doc(db(), `users/${uid()}/pagamentos`, id));
      pagamentos = pagamentos.filter(p => p.id !== id);
      showToast('🗑️ Pagamento removido');
      renderPagamentos();
      renderDashboard();
      if (currentTab === 'calendario') renderCalendario();
    }
  });
};

window.onPagMesChange = function () { renderPagamentos(); };

// ============ BOTÃO RESUMO MÊS (manual) ============

/* ===== [de app_patches.js] ===== */
(function patchSobrouMesAnterior() {

  // Injeta campos extras no modal quando categoria = "Sobrou do último mês"
  function garantirCamposSobrou() {
    if (document.getElementById('sobrou-extra-group')) return;
    const descGroup = document.getElementById('desc-group');
    if (!descGroup) return;

    const div = document.createElement('div');
    div.id = 'sobrou-extra-group';
    div.style.display = 'none';
    div.innerHTML = `
      <div class="input-group" style="margin-top:0">
        <label style="font-size:13px;font-weight:600;color:var(--text2)">Dividir entre fatura 15/30?</label>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button type="button" id="sobrou-div-sim"
            style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);cursor:pointer;font-size:13px;font-family:var(--font-body);transition:all 0.18s"
            onclick="setSobrouDivisivel(true)">✂️ Sim, dividir 15/30</button>
          <button type="button" id="sobrou-div-nao"
            style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);cursor:pointer;font-size:13px;font-family:var(--font-body);transition:all 0.18s"
            onclick="setSobrouDivisivel(false)">📅 Não, deixar inteiro</button>
        </div>
      </div>
      <div class="input-group" style="margin-top:0">
        <label style="font-size:13px;font-weight:600;color:var(--text2)">Já foi pago?</label>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button type="button" id="sobrou-pago-sim"
            style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);cursor:pointer;font-size:13px;font-family:var(--font-body);transition:all 0.18s"
            onclick="setSobrouJaPago(true)">✅ Já foi pago</button>
          <button type="button" id="sobrou-pago-nao"
            style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);cursor:pointer;font-size:13px;font-family:var(--font-body);transition:all 0.18s"
            onclick="setSobrouJaPago(false)">⏳ Ainda pendente</button>
        </div>
      </div>
    `;
    descGroup.parentNode.insertBefore(div, descGroup.nextSibling);
  }

  // Estado dos botões de sobrou
  window._sobrouDivisivel = null;
  window._sobrouJaPago    = null;

  window.setSobrouDivisivel = function(val) {
    window._sobrouDivisivel = val;
    const sim = document.getElementById('sobrou-div-sim');
    const nao = document.getElementById('sobrou-div-nao');
    if (!sim || !nao) return;
    [sim, nao].forEach(b => { b.style.borderColor = 'var(--border)'; b.style.background = 'var(--bg3)'; b.style.color = 'var(--text2)'; });
    const ativo = val ? sim : nao;
    ativo.style.borderColor = 'var(--accent)';
    ativo.style.background  = 'rgba(240,192,64,0.12)';
    ativo.style.color       = 'var(--accent)';
  };

  window.setSobrouJaPago = function(val) {
    window._sobrouJaPago = val;
    const sim = document.getElementById('sobrou-pago-sim');
    const nao = document.getElementById('sobrou-pago-nao');
    if (!sim || !nao) return;
    [sim, nao].forEach(b => { b.style.borderColor = 'var(--border)'; b.style.background = 'var(--bg3)'; b.style.color = 'var(--text2)'; });
    const ativo = val ? sim : nao;
    ativo.style.borderColor = val ? 'var(--green)' : 'var(--blue)';
    ativo.style.background  = val ? 'rgba(61,214,140,0.12)' : 'rgba(77,157,224,0.10)';
    ativo.style.color       = val ? 'var(--green)' : 'var(--blue)';
  };

  // Patcha toggleParcelas para mostrar/esconder campos extras
  function patchToggleParcelas() {
    if (typeof window.toggleParcelas !== 'function') { setTimeout(patchToggleParcelas, 300); return; }
    const orig = window.toggleParcelas;
    window.toggleParcelas = function() {
      orig.apply(this, arguments);
      garantirCamposSobrou();
      const cat = document.getElementById('m-cat')?.value || '';
      const grupo = document.getElementById('sobrou-extra-group');
      if (grupo) grupo.style.display = cat === 'Sobrou do último mês' ? 'block' : 'none';
      if (cat !== 'Sobrou do último mês') {
        window._sobrouDivisivel = null;
        window._sobrouJaPago    = null;
      }
    };
  }
  patchToggleParcelas();

  // Patcha openModal para resetar estado
  function patchOpenModal() {
    if (typeof window.openModal !== 'function') { setTimeout(patchOpenModal, 300); return; }
    const orig = window.openModal;
    window.openModal = function() {
      window._sobrouDivisivel = null;
      window._sobrouJaPago    = null;
      orig.apply(this, arguments);
    };
  }
  patchOpenModal();

  // Patcha salvarGasto para tratar "Sobrou do último mês" com as opções extras
  function patchSalvarGasto() {
    if (typeof window.salvarGasto !== 'function') { setTimeout(patchSalvarGasto, 300); return; }
    const orig = window.salvarGasto;
    window.salvarGasto = async function() {
      const cat = document.getElementById('m-cat')?.value || '';
      if (cat !== 'Sobrou do último mês') { return orig.apply(this, arguments); }

      // Validações extras
      if (window._sobrouDivisivel === null) { window.showToast?.('⚠️ Informe se deseja dividir entre 15/30'); return; }
      if (window._sobrouJaPago    === null) { window.showToast?.('⚠️ Informe se já foi pago'); return; }

      // Salva dados extras no objeto antes de chamar o original
      window._sobrouDivisiveTemp = window._sobrouDivisivel;
      window._sobrouJaPagoTemp   = window._sobrouJaPago;

      await orig.apply(this, arguments);
    };
  }
  patchSalvarGasto();

  // Hook pós-save: após salvar gasto "Sobrou do último mês", aplicar lógica de pago/pendente
  // Intercepta loadGastos para detectar o gasto recém-salvo e aplicar a lógica
  const _origSalvarGastoHook = true; // flag para não duplicar
  window._aplicarLogicaSobrou = async function(gastoId) {
    if (window._sobrouJaPagoTemp === null) return;
    const jaPago    = window._sobrouJaPagoTemp;
    const divisivel = window._sobrouDivisiveTemp;

    // Atualiza o gasto com os campos extras
    try {
      const { doc, updateDoc } = window.firebaseFns;
      const db = window.firebaseDb;
      const uid = window.currentUser.uid;
      await updateDoc(doc(db, `users/${uid}/gastos`, gastoId), {
        sobrouDivisivel: divisivel,
        sobrouJaPago: jaPago,
        sobrouPagoEm: jaPago ? new Date().toISOString().slice(0, 10) : null
      });
    } catch(e) { /* silencioso */ }

    window._sobrouDivisiveTemp = null;
    window._sobrouJaPagoTemp   = null;
  };

})();


/* ──────────────────────────────────────────────────────────────
   PATCH 4 — Entrada fixa mensal: modo saldo líquido vs abatimento
             de recorrentes; nas recorrentes, opção de participar
   ────────────────────────────────────────────────────────────── */

/* ===== [de app_patches.js] ===== */
(function patchEntradaFixaModo() {

  // Injeta campo de "modo" no formulário de entrada fixa
  function injetarCampoModo() {
    if (document.getElementById('sal-fixa-modo-group')) return;
    const btnSalvar = document.querySelector('[onclick="salvarEntradaFixa()"]');
    if (!btnSalvar) return;

    const div = document.createElement('div');
    div.id = 'sal-fixa-modo-group';
    div.className = 'input-group';
    div.style.marginBottom = '8px';
    div.innerHTML = `
      <label style="font-size:13px;font-weight:600;color:var(--text2)">Como esta entrada conta?</label>
      <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">
        <button type="button" id="ef-modo-saldo"
          style="flex:1;min-width:140px;padding:10px 8px;border-radius:10px;border:2px solid var(--accent);background:rgba(240,192,64,0.12);color:var(--accent);cursor:pointer;font-size:12px;font-family:var(--font-body);transition:all 0.18s;font-weight:700"
          onclick="setEntradaFixaModo('saldo')">💰 Entra no saldo líquido</button>
        <button type="button" id="ef-modo-abate"
          style="flex:1;min-width:140px;padding:10px 8px;border-radius:10px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);cursor:pointer;font-size:12px;font-family:var(--font-body);transition:all 0.18s"
          onclick="setEntradaFixaModo('abate')">✂️ Abate parcelados/recorrentes</button>
      </div>
      <p id="ef-modo-hint" style="font-size:11px;color:var(--text3);margin:4px 0 0;padding:0 2px;line-height:1.5">
        Modo atual: entra no saldo líquido (padrão).
      </p>
    `;
    btnSalvar.parentNode.insertBefore(div, btnSalvar);
    window._entradaFixaModo = window._entradaFixaModo || 'saldo';
  }

  window._entradaFixaModo = 'saldo';

  window.setEntradaFixaModo = function(modo) {
    window._entradaFixaModo = modo;
    const btnS = document.getElementById('ef-modo-saldo');
    const btnA = document.getElementById('ef-modo-abate');
    const hint = document.getElementById('ef-modo-hint');
    if (!btnS || !btnA) return;

    if (modo === 'saldo') {
      btnS.style.borderColor = 'var(--accent)'; btnS.style.background = 'rgba(240,192,64,0.12)'; btnS.style.color = 'var(--accent)'; btnS.style.fontWeight = '700';
      btnA.style.borderColor = 'var(--border)';  btnA.style.background = 'var(--bg3)';             btnA.style.color = 'var(--text2)'; btnA.style.fontWeight = '400';
      if (hint) hint.textContent = 'Esta entrada vai somar ao saldo líquido do mês.';
    } else {
      btnA.style.borderColor = 'var(--blue)'; btnA.style.background = 'rgba(77,157,224,0.10)'; btnA.style.color = 'var(--blue)'; btnA.style.fontWeight = '700';
      btnS.style.borderColor = 'var(--border)'; btnS.style.background = 'var(--bg3)';           btnS.style.color = 'var(--text2)'; btnS.style.fontWeight = '400';
      if (hint) hint.textContent = 'Esta entrada só abate parcelados/recorrentes, não entra no saldo livre.';
    }
  };

  // Patcha renderSalarios para injetar o campo
  function patchRenderSalarios() {
    if (typeof window.renderSalarios !== 'function') { setTimeout(patchRenderSalarios, 400); return; }
    const orig = window.renderSalarios;
    window.renderSalarios = function() {
      orig.apply(this, arguments);
      setTimeout(injetarCampoModo, 80);
    };
  }
  patchRenderSalarios();

  // Patcha salvarEntradaFixa para salvar o modo
  function patchSalvarEntradaFixa() {
    if (typeof window.salvarEntradaFixa !== 'function') { setTimeout(patchSalvarEntradaFixa, 400); return; }
    const orig = window.salvarEntradaFixa;
    window.salvarEntradaFixa = async function() {
      window._entradaFixaModoParaSalvar = window._entradaFixaModo || 'saldo';
      await orig.apply(this, arguments);
      // Após salvar, marca o último item criado com o modo
      // (O hook real está abaixo via loadEntradasFixas)
    };
  }
  patchSalvarEntradaFixa();

  // Campo "participa do abatimento" nas recorrentes
  function injetarCampoAbatimentoRecorrente() {
    if (document.getElementById('rec-abate-group')) return;
    const divGroup = document.getElementById('divisivel-group');
    if (!divGroup) return;

    const div = document.createElement('div');
    div.id = 'rec-abate-group';
    div.style.cssText = 'display:none;flex-direction:column;gap:8px;margin-bottom:4px';
    div.innerHTML = `
      <label style="font-size:13px;font-weight:600;color:var(--text2)">Participa do abatimento de entradas fixas?</label>
      <div style="display:flex;gap:8px">
        <button type="button" id="rec-abate-sim"
          style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);cursor:pointer;font-size:13px;font-family:var(--font-body);transition:all 0.18s"
          onclick="setRecAbate(true)">✅ Sim, participa</button>
        <button type="button" id="rec-abate-nao"
          style="flex:1;padding:10px;border-radius:10px;border:2px solid var(--blue);background:rgba(77,157,224,0.10);color:var(--blue);cursor:pointer;font-size:13px;font-family:var(--font-body);transition:all 0.18s;font-weight:700"
          onclick="setRecAbate(false)">❌ Não participa</button>
      </div>
      <p style="font-size:11px;color:var(--text3);margin:0;padding:0 2px;line-height:1.5">
        Define se esta recorrente é incluída quando entradas fixas de modo "abate" são calculadas.
      </p>
    `;
    divGroup.parentNode.insertBefore(div, divGroup.nextSibling);
    window._recAbate = false; // padrão: não participa
  }

  window._recAbate = false;
  window.setRecAbate = function(val) {
    window._recAbate = val;
    const sim = document.getElementById('rec-abate-sim');
    const nao = document.getElementById('rec-abate-nao');
    if (!sim || !nao) return;
    if (val) {
      sim.style.borderColor = 'var(--green)'; sim.style.background = 'rgba(61,214,140,0.10)'; sim.style.color = 'var(--green)'; sim.style.fontWeight = '700';
      nao.style.borderColor = 'var(--border)'; nao.style.background = 'var(--bg3)';            nao.style.color = 'var(--text2)'; nao.style.fontWeight = '400';
    } else {
      nao.style.borderColor = 'var(--blue)'; nao.style.background = 'rgba(77,157,224,0.10)'; nao.style.color = 'var(--blue)'; nao.style.fontWeight = '700';
      sim.style.borderColor = 'var(--border)'; sim.style.background = 'var(--bg3)';           sim.style.color = 'var(--text2)'; sim.style.fontWeight = '400';
    }
  };

  // Patcha toggleParcelas para mostrar campo de abatimento em recorrentes
  function patchToggleParcelasAbate() {
    if (typeof window.toggleParcelas !== 'function') { setTimeout(patchToggleParcelasAbate, 500); return; }
    const orig2 = window.toggleParcelas;
    window.toggleParcelas = function() {
      orig2.apply(this, arguments);
      injetarCampoAbatimentoRecorrente();
      const cat = document.getElementById('m-cat')?.value || '';
      const grupo = document.getElementById('rec-abate-group');
      if (grupo) grupo.style.display = cat === 'Compras recorrentes' ? 'flex' : 'none';
    };
  }
  // Só aplica se ainda não foi patchado pelo patch 3 (eles serão compostos)
  setTimeout(patchToggleParcelasAbate, 600);

})();


/* ──────────────────────────────────────────────────────────────
   PATCH 5 — "Limpar todos os dados" apaga absolutamente tudo,
              incluindo backups e histórico do localStorage
   ────────────────────────────────────────────────────────────── */

/* ===== [de app_patches.js] ===== */
(function patchDeletarGastoSemRetorno() {
  // O saldo líquido é calculado como renda - gastos.
  // Ao deletar um gasto, ele some do array e o saldo "volta".
  // Para evitar isso: ao deletar, marcamos o gasto como "deletadoSemRetorno"
  // e excluímos da soma — OU simplesmente registramos um "pagamento fantasma"
  // que compensa o valor. A abordagem mais simples e compatível:
  // Guardamos no localStorage a lista de IDs deletados com seus valores,
  // e subtraímos esses valores da renda ao calcular o saldo.

  const DELETED_KEY = 'fapp_gastos_deletados_compensacao';

  function getCompensacoes() {
    try { return JSON.parse(localStorage.getItem(DELETED_KEY) || '[]'); } catch(e) { return []; }
  }

  function salvarCompensacao(id, valor, mes) {
    const lista = getCompensacoes();
    // Evita duplicata
    if (!lista.find(c => c.id === id)) {
      lista.push({ id, valor, mes, ts: Date.now() });
      // Mantém apenas os últimos 200 para não encher storage
      if (lista.length > 200) lista.splice(0, lista.length - 200);
      localStorage.setItem(DELETED_KEY, JSON.stringify(lista));
    }
  }

  // Patcha deletarGasto
  function tentar() {
    if (typeof window.deletarGasto !== 'function') { setTimeout(tentar, 400); return; }
    const orig = window.deletarGasto;
    window.deletarGasto = async function(id, skipConfirm) {
      // Encontra o gasto antes de deletar
      const gastosList = window.gastos || [];
      const g = gastosList.find(x => x.id === id);

      if (!g) return orig.apply(this, arguments);

      // Só aplica compensação em gastos comuns (não parcelados, não recorrentes vinculados)
      const isComum = g.categoria !== 'Compras parceladas'
        && g.categoria !== 'Compras recorrentes'
        && g.categoria !== 'Compras futuras'
        && g.categoria !== 'Sobrou do último mês';

      if (isComum && g.valor && g.data) {
        // Se skipConfirm (confirmado), registra compensação ANTES de deletar
        const interceptId = id;
        const interceptValor = parseFloat(g.valor) || 0;
        const interceptMes = g.data ? g.data.slice(0, 7) : '';

        if (skipConfirm) {
          salvarCompensacao(interceptId, interceptValor, interceptMes);
        }
      }

      return orig.apply(this, arguments);
    };
  }
  tentar();

  // Patcha rendaTotalMes para incluir compensações
  // (Subtrai do total de gastos efetivos: o gasto sumiu mas a compensação diz que ele foi gasto)
  // Alternativa mais limpa: não mexer no saldo, pois o gasto já não existe.
  // O enunciado diz "valor não deve retornar ao saldo líquido" —
  // isso significa que ao deletar, o saldo deve PERMANECER o mesmo.
  // Então devemos adicionar o valor deletado como "gasto fantasma" na renda (-).
  // Implementamos isso interceptando totalGastosDashboard.

  // Para manter compatibilidade, vamos usar o conceito de "pagamentos fantasma":
  // registramos um pagamento no Firebase com tipo 'gasto-deletado' que mantém o valor saído.
  // Isso é a abordagem mais robusta.
  // NOTA: esta abordagem já existe parcialmente via pagamentos — mas não queremos poluir.
  // Solução adotada: armazenamos localmente e ajustamos o cálculo de renda via patch:

  window._getCompensacoesDeletion = getCompensacoes;

  // Patcha renderDashboard para descontar compensações do saldo
  function patchRenderDashboard() {
    if (typeof window.renderDashboard !== 'function') { setTimeout(patchRenderDashboard, 500); return; }
    const orig = window.renderDashboard;
    window.renderDashboard = function() {
      orig.apply(this, arguments);
      _ajustarSaldoComCompensacoes();
    };
  }

  function _ajustarSaldoComCompensacoes() {
    const mes = new Date().toISOString().slice(0, 7);
    const compensacoes = getCompensacoes().filter(c => c.mes === mes);
    if (!compensacoes.length) return;

    const totalComp = compensacoes.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0);
    if (totalComp <= 0) return;

    // Subtrai do card de saldo
    const cardSaldo  = document.getElementById('card-saldo');
    const cardGastos = document.getElementById('card-gastos');
    if (!cardSaldo) return;

    // Pega valor atual do card saldo (já animado)
    const saldoAtualText = cardSaldo.textContent.replace('R$','').replace(/\./g,'').replace(',','.').trim();
    const saldoAtual = parseFloat(saldoAtualText) || 0;
    const saldoAjustado = saldoAtual - totalComp;

    cardSaldo.textContent = 'R$ ' + saldoAjustado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  patchRenderDashboard();
})();


/* ──────────────────────────────────────────────────────────────
   PATCH 7 — Na aba "Parcelados", atraso marca o gasto específico
              (não a fatura do mês), com seleção por item
   ────────────────────────────────────────────────────────────── */

/* ===== [de app_patches.js] ===== */
(function patchAtrasosParcelados() {
  // Patcha renderAtrasosParcelados para mostrar qual gasto exato atrasou
  function patchRender() {
    if (typeof window.renderAtrasosParcelados !== 'undefined') {
      // A função é interna (não window), então patchamos via override na renderização
    }

    // Patcha o botão "Deixar selecionadas para o próximo mês" no calendário
    // para usar seleção por item em vez de fatura do mês
    // Isso é feito via patch em registrarAtrasoFaturaMes

    if (typeof window.registrarAtrasoFaturaMes !== 'function') { setTimeout(patchRender, 500); return; }
    const origAtraso = window.registrarAtrasoFaturaMes;
    window.registrarAtrasoFaturaMes = async function(mesStr, usarSelecionadas) {
      if (!usarSelecionadas) { return origAtraso.apply(this, arguments); }

      // Pega checkboxes selecionadas do calendário
      const checks = [...document.querySelectorAll('.cal-atraso-check:checked')];
      if (!checks.length) {
        window.showToast?.('⚠️ Selecione ao menos uma parcela para marcar como atrasada.');
        return;
      }

      const { doc, updateDoc } = window.firebaseFns;
      const db  = window.firebaseDb;
      const uid = window.currentUser.uid;
      const gastosList = window.gastos || [];

      for (const chk of checks) {
        const key = chk.value; // formato: "gastoId|num"
        const [gastoId, numStr] = key.split('|');
        const num = parseInt(numStr);
        if (!gastoId || !num) continue;

        const g = gastosList.find(x => x.id === gastoId);
        if (!g) continue;

        const atrasosExist = Array.isArray(g.parcelasAtrasadas) ? [...g.parcelasAtrasadas] : [];
        const jaExiste = atrasosExist.some(a => a.num === num && a.mesOrigem === mesStr && !a.resolvido);
        if (jaExiste) continue;

        const diaVenc = g.vencimentoDia || 1;
        const dataVenc = `${mesStr}-${String(Math.min(diaVenc, new Date(parseInt(mesStr.slice(0,4)), parseInt(mesStr.slice(5,7)), 0).getDate())).padStart(2,'0')}`;

        atrasosExist.push({
          num,
          mesOrigem: mesStr,
          dataVenc,
          mesUrgente: window.proximoMes ? window.proximoMes(mesStr) : mesStr,
          resolvido: false
        });

        await updateDoc(doc(db, `users/${uid}/gastos`, gastoId), {
          parcelasAtrasadas: atrasosExist
        });

        g.parcelasAtrasadas = atrasosExist;
      }

      window.showToast?.(`⚠️ ${checks.length} parcela(s) marcada(s) como atrasada(s)!`);
      if (typeof window.renderParcelados === 'function') window.renderParcelados();
      if (typeof window.renderCalendario === 'function') window.renderCalendario();
    };
  }

  setTimeout(patchRender, 800);

  // Patcha o HTML do calendário para usar chave gastoId|num nos checkboxes
  // Isso é feito via CSS override do estilo do botão de atraso
  const styleAtraso = document.createElement('style');
  styleAtraso.textContent = `
    .cal-atraso-check { accent-color: var(--accent); width: 16px; height: 16px; cursor: pointer; }
    .cal-atraso-select-item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; cursor: pointer; font-size: 13px; color: var(--text2); }
    .cal-atraso-select-item:hover { color: var(--text); }
    .cal-atraso-select-item b { color: var(--text); display: block; }
    .cal-atraso-select-item small { color: var(--text3); font-size: 11px; display: block; margin-top: 2px; }
    .btn-fatura-atraso { background: rgba(224,84,84,0.10); border: 1px solid rgba(224,84,84,0.3); color: var(--red); border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 12px; font-family: var(--font-body); transition: background 0.18s; }
    .btn-fatura-atraso:hover { background: rgba(224,84,84,0.20); }
  `;
  document.head.appendChild(styleAtraso);

  // Override parcelaPendenteKey para retornar gastoId|num
  window.parcelaPendenteKey = function(item) {
    return `${item.g.id}|${item.num}`;
  };

})();


/* ──────────────────────────────────────────────────────────────
   PATCH 8 — Exigir PIN para: backup automático, backups,
              alterar PIN e limpar dados
   ────────────────────────────────────────────────────────────── */

/* ===== [de app_patches.js] ===== */
(function patchBotaoMarcarSobrouPago() {
  // Injeta estilo para o botão
  const style = document.createElement('style');
  style.textContent = `
    .sobrou-marcar-pago-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(61,214,140,0.10);
      border: 1px solid rgba(61,214,140,0.35);
      color: var(--green);
      border-radius: 8px;
      padding: 4px 10px;
      font-size: 11px;
      font-family: var(--font-body);
      cursor: pointer;
      transition: background 0.18s;
      margin-top: 4px;
    }
    .sobrou-marcar-pago-btn:hover { background: rgba(61,214,140,0.20); }
    .sobrou-pago-badge {
      background: rgba(61,214,140,0.12);
      color: var(--green);
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
    }
  `;
  document.head.appendChild(style);

  // Patcha renderGastosList para adicionar botão nos gastos sobrou
  function patchRenderGastos() {
    if (typeof window.renderGastosList !== 'function') { setTimeout(patchRenderGastos, 500); return; }
    const orig = window.renderGastosList;
    window.renderGastosList = function() {
      orig.apply(this, arguments);
      // Após renderizar, adiciona botões nos itens "Sobrou do último mês"
      _injetarBotoesSobrou();
    };
  }
  patchRenderGastos();

  function _injetarBotoesSobrou() {
    const lista = window.gastos || [];
    lista.forEach(g => {
      if (g.categoria !== 'Sobrou do último mês') return;
      const el = document.querySelector(`.gasto-item[data-id="${g.id}"]`);
      if (!el) return;
      if (el.querySelector('.sobrou-marcar-pago-btn') || el.querySelector('.sobrou-pago-badge')) return;

      const info = el.querySelector('.gasto-info');
      if (!info) return;

      if (g.sobrouJaPago) {
        const badge = document.createElement('span');
        badge.className = 'sobrou-pago-badge';
        badge.textContent = '✅ Pago';
        info.appendChild(badge);
      } else {
        const btn = document.createElement('button');
        btn.className = 'sobrou-marcar-pago-btn';
        btn.textContent = '✅ Marcar como pago';
        btn.onclick = async function(e) {
          e.stopPropagation();
          await marcarSobrouComoPago(g.id);
        };
        info.appendChild(btn);
      }
    });
  }

  window.marcarSobrouComoPago = async function(gastoId) {
    const { doc, updateDoc } = window.firebaseFns;
    const db  = window.firebaseDb;
    const uid = window.currentUser.uid;
    const gastosList = window.gastos || [];
    const g = gastosList.find(x => x.id === gastoId);
    if (!g) return;

    // Remove da lista de pendentes/fatura e marca como pago
    await updateDoc(doc(db, `users/${uid}/gastos`, gastoId), {
      sobrouJaPago: true,
      sobrouPagoEm: new Date().toISOString().slice(0, 10)
    });
    g.sobrouJaPago = true;

    window.showToast?.('✅ Marcado como pago!');
    if (typeof window.renderGastosList === 'function') window.renderGastosList();
    if (typeof window.renderDashboard  === 'function') window.renderDashboard();
  };
})();


/* ──────────────────────────────────────────────────────────────
   CSS: Saudação no Dashboard e ajustes visuais
   ────────────────────────────────────────────────────────────── */

/* ===== [de /home/claude/work/app_patch_fase4_salarios_dinamicos.js] ===== */
/* ============================================================
   FINANCESAPP — FASE 4: SALÁRIOS DINÂMICOS
   Remove os campos fixos "Dia 15" / "Dia 30" do formulário de
   Salário e passa a gerar um bloco de valor para CADA dia de
   recebimento cadastrado pelo usuário no Wizard (users/{uid}.
   diasRecebimento). Se o usuário recebe em um único dia, mostra
   apenas um campo; se recebe em vários, mostra um por dia.

   Carregue depois de app.js, app_wizard_cadastro.js e do patch
   da Fase 2 (divisão dinâmica), se presente.
   ============================================================ */

(function () {
  'use strict';

  /* ────────────────────────────────────────────────
     DIAS DE RECEBIMENTO ATIVOS (compartilhado)
     Se outro patch (Fase 2) já definiu essa função, reaproveita;
     senão define aqui mesmo, com o mesmo contrato.
     ──────────────────────────────────────────────── */
  function diasAtivosFallback() {
    const dias = (window.userProfile?.diasRecebimento || [])
      .map(d => parseInt(d))
      .filter(d => d >= 1 && d <= 31);
    const unicos = [...new Set(dias)].sort((a, b) => a - b);
    return unicos.length ? unicos : [15, 30]; // fallback p/ contas ainda sem quiz preenchido
  }
  if (typeof window.diasRecebimentoAtivos !== 'function') {
    window.diasRecebimentoAtivos = diasAtivosFallback;
  }
  function diasAtivos() { return window.diasRecebimentoAtivos(); }

  /* ────────────────────────────────────────────────
     COMPATIBILIDADE COM REGISTROS ANTIGOS (val15/val30)
     ──────────────────────────────────────────────── */
  function valoresPorDiaSalario(sal) {
    if (sal && sal.valoresPorDia && Object.keys(sal.valoresPorDia).length) {
      return sal.valoresPorDia;
    }
    const legado = {};
    if (sal?.val15) legado['15'] = sal.val15;
    if (sal?.val30) legado['30'] = sal.val30;
    return legado;
  }
  window.valoresPorDiaSalario = valoresPorDiaSalario;

  /* ────────────────────────────────────────────────
     MONTA O FORMULÁRIO DINÂMICO (substitui o .sal-duplo fixo)
     ──────────────────────────────────────────────── */
  function idCampoDia(dia) { return `sal-valor-dia-${dia}`; }

  function renderFormSalarioDinamico() {
    const original = document.querySelector('.salario-box .sal-duplo');
    if (!original) return;

    let container = document.getElementById('sal-duplo-dinamico');
    if (!container) {
      container = document.createElement('div');
      container.id = 'sal-duplo-dinamico';
      original.parentNode.insertBefore(container, original);
      original.style.display = 'none';
      original.setAttribute('aria-hidden', 'true');
    }

    const dias = diasAtivos();
    container.className = 'sal-duplo' + (dias.length === 1 ? ' sal-duplo-1' : '');

    container.innerHTML = dias.map((d, i) => `
      <div class="sal-bloco">
        <div class="sal-bloco-titulo">
          <span class="sal-dia-badge${i % 2 === 1 ? ' sal-dia-30' : ''}">Dia ${String(d).padStart(2, '0')}</span>
          ${dias.length > 1 ? `Recebimento ${i + 1}` : 'Recebimento do mês'}
        </div>
        <div class="input-group">
          <label>Valor (R$)</label>
          <input type="number" class="sal-valor-dinamico" data-dia="${d}" id="${idCampoDia(d)}" placeholder="0,00" min="0" step="0.01"/>
        </div>
      </div>
    `).join('');

    atualizarTextosDescritivos(dias);
  }

  function atualizarTextosDescritivos(dias) {
    const desc = document.querySelector('.salario-box .salario-desc');
    if (desc) {
      desc.textContent = dias.length > 1
        ? `Informe o valor recebido em cada dia (${dias.join(', ')}). Você também pode registrar dinheiro externo para entrar no cálculo total da renda.`
        : `Informe o valor recebido no dia ${dias[0]}. Você também pode registrar dinheiro externo para entrar no cálculo total da renda.`;
    }

    const infoBox = document.querySelector('.salario-box .info-box');
    if (infoBox) {
      const svg = infoBox.querySelector('svg');
      const partesSalario = dias.map(d => `Sal. dia ${d}`).join(' + ');
      infoBox.innerHTML = (svg ? svg.outerHTML : '') +
        ` Renda = ${partesSalario} + dinheiro externo + entradas mensais fixas cadastradas.`;
    }
  }

  /* ────────────────────────────────────────────────
     LEITURA DOS VALORES DIGITADOS
     ──────────────────────────────────────────────── */
  function lerValoresDoForm() {
    const dias = diasAtivos();
    const valores = {};
    let algumPreenchido = false;
    dias.forEach(d => {
      const input = document.getElementById(idCampoDia(d));
      const v = parseFloat(input?.value) || 0;
      if (v > 0) { valores[String(d)] = v; algumPreenchido = true; }
    });
    return { valores, algumPreenchido };
  }

  function limparValoresDoForm() {
    diasAtivos().forEach(d => {
      const input = document.getElementById(idCampoDia(d));
      if (input) input.value = '';
    });
  }

  function preencherValoresNoForm(sal) {
    const vpd = valoresPorDiaSalario(sal);
    diasAtivos().forEach(d => {
      const input = document.getElementById(idCampoDia(d));
      if (input) input.value = vpd[String(d)] || '';
    });
  }

  /* ────────────────────────────────────────────────
     SUBSTITUI window.salvarSalario — mesma lógica de
     antes (novo registro / merge no mês / edição por ID),
     porém somando um número dinâmico de dias.
     ──────────────────────────────────────────────── */
  function instalarSalvarSalarioDinamico() {
    window.salvarSalario = async function () {
      const mes = document.getElementById('sal-mes').value;
      const { valores, algumPreenchido } = lerValoresDoForm();

      if (!mes) { showToast('⚠️ Informe o mês'); return; }
      if (!algumPreenchido) { showToast('⚠️ Informe pelo menos um valor'); return; }

      const totalNovo = Object.values(valores).reduce((s, v) => s + v, 0);

      const { collection, getDocs, doc, updateDoc, addDoc } = fns();
      const ref  = collection(db(), `users/${uid()}/salarios`);
      const snap = await getDocs(ref);

      let existente = null;
      snap.forEach(d => { if (d.data().mes === mes) existente = { id: d.id, ...d.data() }; });

      // Edição por ID específico (pode ter trocado o mês)
      if (window._editandoSalarioIdFase4Getter ? window._editandoSalarioIdFase4Getter() : window.editandoSalarioId) {
        const editId = typeof window._editandoSalarioIdFase4Getter === 'function'
          ? window._editandoSalarioIdFase4Getter()
          : window.editandoSalarioId;
        const isExtraEdit = typeof window._editandoExtraIdFase4Getter === 'function'
          ? window._editandoExtraIdFase4Getter()
          : window.editandoExtraId;

        if (editId && !isExtraEdit) {
          const salById = salarios.find(s => s.id === editId);
          if (salById && salById.mes !== mes) {
            const novoMesExistente = salarios.find(s => s.mes === mes && s.id !== editId);
            if (novoMesExistente) { showToast('⚠️ Já existe um salário para esse mês'); return; }
          }
          const extras   = extrasSalario(salById || existente || {});
          const totalExt = extras.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0);
          await updateDoc(doc(db(), `users/${uid()}/salarios`, editId), {
            mes, valoresPorDia: valores, val15: null, val30: null, extras,
            valor: totalNovo + totalExt
          });
          window.cancelarEdicaoSalario?.();
          await loadSalarios();
          showToast('✅ Salário atualizado!');
          renderSalarios(); renderDivisaoMeses(); renderDashboard();
          return;
        }
      }

      if (existente) {
        const vpdExistente = valoresPorDiaSalario(existente);
        // Mescla: valores novos sobrescrevem os dias informados; dias não
        // preenchidos neste envio mantêm o que já existia.
        const merged = { ...vpdExistente, ...valores };
        const totalBase = Object.values(merged).reduce((s, v) => s + (parseFloat(v) || 0), 0);
        await updateDoc(doc(db(), `users/${uid()}/salarios`, existente.id), {
          valoresPorDia: merged, val15: null, val30: null,
          extras: extrasSalario(existente),
          valor: totalBase + totalExtrasSalario(existente)
        });
      } else {
        await addDoc(ref, { mes, valoresPorDia: valores, extras: [], valor: totalNovo });
      }

      await loadSalarios();
      showToast('✅ Salário atualizado!');
      renderSalarios();
      renderDivisaoMeses();
      renderDashboard();
    };
  }

  /* ────────────────────────────────────────────────
     salvarDinheiroExtra — mesma lógica original, só troca
     o registro "vazio" de val15/val30 por valoresPorDia:{}
     ──────────────────────────────────────────────── */
  function instalarSalvarDinheiroExtraDinamico() {
    window.salvarDinheiroExtra = async function () {
      const mes    = document.getElementById('sal-mes').value;
      const origem = document.getElementById('sal-extra-origem').value.trim();
      const valor  = parseFloat(document.getElementById('sal-extra-valor').value) || 0;
      const dataRecebimento = document.getElementById('sal-extra-data').value || '';

      if (!mes) { showToast('⚠️ Informe o mês'); return; }
      if (!origem) { showToast('⚠️ Informe de onde veio o dinheiro'); return; }
      if (valor <= 0) { showToast('⚠️ Informe um valor externo válido'); return; }

      const { collection, getDocs, doc, updateDoc, addDoc } = fns();
      const ref  = collection(db(), `users/${uid()}/salarios`);
      const snap = await getDocs(ref);

      let existente = null;
      snap.forEach(d => { if (d.data().mes === mes) existente = { id: d.id, ...d.data() }; });

      if (window.editandoSalarioId && window.editandoExtraId) {
        const sal = salarios.find(s => s.id === window.editandoSalarioId);
        if (!sal) { showToast('⚠️ Registro não encontrado'); return; }
        const extras = extrasSalario(sal).map(e =>
          e.id === window.editandoExtraId ? { ...e, origem, valor, dataRecebimento } : e
        );
        const base = salarioBase(sal);
        await updateDoc(doc(db(), `users/${uid()}/salarios`, sal.id), {
          extras, valor: base + extras.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0)
        });
        window.cancelarEdicaoSalario?.();
        await loadSalarios();
        showToast('✅ Dinheiro externo atualizado!');
        renderSalarios(); renderDivisaoMeses(); renderDashboard();
        return;
      }

      const novoExtra = { id: String(Date.now()), origem, valor, dataRecebimento, criadoEm: new Date().toISOString() };

      if (existente) {
        const extras = [...extrasSalario(existente), novoExtra];
        const base   = salarioBase(existente);
        await updateDoc(doc(db(), `users/${uid()}/salarios`, existente.id), {
          extras, valor: base + extras.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0)
        });
      } else {
        await addDoc(ref, { mes, valoresPorDia: {}, extras: [novoExtra], valor });
      }

      document.getElementById('sal-extra-origem').value = '';
      document.getElementById('sal-extra-valor').value  = '';
      document.getElementById('sal-extra-data').value   = '';

      await loadSalarios();
      showToast('✅ Dinheiro externo adicionado!');
      renderSalarios();
      renderDivisaoMeses();
      renderDashboard();
    };
  }

  /* ────────────────────────────────────────────────
     renderSalarios — badges dinâmicos no histórico
     ──────────────────────────────────────────────── */
  function instalarRenderSalariosDinamico() {
    window.renderSalarios = function () {
      const hist   = document.getElementById('salarios-hist');
      const sorted = [...salarios].sort((a, b) => b.mes.localeCompare(a.mes));
      if (!sorted.length) {
        hist.innerHTML = '<p style="color:var(--text3);font-size:13px">Nenhum salário registrado ainda.</p>';
        return;
      }
      hist.innerHTML =
        '<h4 style="font-family:var(--font-head);font-size:14px;color:var(--text2);margin-bottom:8px">Histórico de rendas</h4>' +
        sorted.map(s => {
          const base = salarioBase(s);
          const extras = extrasSalario(s);
          const totalExtras = totalExtrasSalario(s);
          const vpd = valoresPorDiaSalario(s);
          const diasComValor = Object.keys(vpd).map(Number).sort((a, b) => a - b);
          const badges = diasComValor.map((d, i) => `
            <span style="background:${i % 2 === 1 ? 'rgba(77,157,224,0.12)' : 'rgba(240,192,64,0.12)'};color:${i % 2 === 1 ? 'var(--blue)' : 'var(--accent)'};border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">
              Dia ${d}: ${fmtR(vpd[d])}
            </span>`).join('');

          return `
          <div class="salario-hist-item">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span class="salario-hist-mes">${formatMes(s.mes)}</span>
                ${badges}
              </div>
              ${extras.length ? `<div class="salario-extra-lista">
                ${extras.map(e => `
                  <div class="salario-extra-item">
                    <span>${escHtml(e.origem)}${e.dataRecebimento ? ` <span style="color:var(--text3);font-size:11px">· recebido em ${formatData(e.dataRecebimento)}</span>` : ''}</span>
                    <b>${fmtR(e.valor)}</b>
                    <button type="button" class="salario-extra-del" style="color:var(--blue);border-color:rgba(77,157,224,0.3);margin-right:2px" onclick="editarDinheiroExtra('${s.id}', '${e.id}')">✏️</button>
                    <button type="button" class="salario-extra-del" onclick="deletarDinheiroExtra('${s.id}', '${e.id}')">✕</button>
                  </div>
                `).join('')}
              </div>` : ''}
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div class="salario-hist-val">${fmtR(rendaTotalMes(s, s.mes))}</div>
              <div style="font-size:11px;color:var(--text3)">Salário ${fmtR(base)} + Extras ${fmtR(totalExtras)}</div>
              <button type="button" class="salario-hist-del" style="color:var(--blue);border-color:rgba(77,157,224,0.3);margin-top:6px;margin-right:4px" onclick="editarSalario('${s.id}')">✏️ Editar</button>
            </div>
            <button type="button" class="salario-hist-del" onclick="deletarSalario('${s.id}')">✕</button>
          </div>
        `}).join('');
    };
  }

  /* ────────────────────────────────────────────────
     editarSalario — preenche os campos dinâmicos
     ──────────────────────────────────────────────── */
  function instalarEditarSalarioDinamico() {
    window.editarSalario = function (id) {
      const s = salarios.find(x => x.id === id);
      if (!s) return;

      window.editandoSalarioId = id;
      window.editandoExtraId   = null;

      document.getElementById('sal-mes').value = s.mes || '';
      renderFormSalarioDinamico();
      preencherValoresNoForm(s);

      const btnSalario = document.querySelector('[onclick="salvarSalario()"]');
      if (btnSalario) {
        btnSalario.textContent = '💾 Atualizar Salário';
        btnSalario.style.background = 'linear-gradient(135deg,var(--blue),var(--purple))';
      }

      window._mostrarBannerEdicaoSalario?.(s.mes);
      document.getElementById('sal-mes').scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('✏️ Editando salário de ' + formatMes(s.mes) + ' — altere os valores e clique em Atualizar');
    };
  }

  /* ────────────────────────────────────────────────
     cancelarEdicaoSalario — também limpa os campos dinâmicos
     ──────────────────────────────────────────────── */
  function instalarCancelarEdicaoDinamico() {
    const orig = window.cancelarEdicaoSalario;
    if (typeof orig !== 'function' || orig._comFase4) return;
    const nova = function () {
      orig.apply(this, arguments);
      limparValoresDoForm();
    };
    nova._comFase4 = true;
    window.cancelarEdicaoSalario = nova;
  }

  /* ────────────────────────────────────────────────
     INICIALIZAÇÃO
     ──────────────────────────────────────────────── */
  function tudoPronto() {
    return typeof window.fmtR === 'function' &&
           typeof window.formatMes === 'function' &&
           typeof window.escHtml === 'function' &&
           typeof window.extrasSalario === 'function' &&
           typeof window.salarioBase === 'function' &&
           typeof window.rendaTotalMes === 'function' &&
           typeof window.totalExtrasSalario === 'function' &&
           typeof window.loadSalarios === 'function' &&
           document.getElementById('sal-mes');
  }

  function iniciar() {
    if (!tudoPronto()) { setTimeout(iniciar, 250); return; }

    renderFormSalarioDinamico();
    instalarSalvarSalarioDinamico();
    instalarSalvarDinheiroExtraDinamico();
    instalarRenderSalariosDinamico();
    instalarEditarSalarioDinamico();
    instalarCancelarEdicaoDinamico();

    // Re-renderiza o formulário sempre que o perfil (dias de recebimento)
    // terminar de carregar ou a aba de Salário for aberta.
    let ultimaAssinatura = JSON.stringify(diasAtivos());
    setInterval(() => {
      const atual = JSON.stringify(diasAtivos());
      if (atual !== ultimaAssinatura) {
        ultimaAssinatura = atual;
        renderFormSalarioDinamico();
      }
    }, 1000);

    if (window.AppBus?.on) {
      window.AppBus.on('tab_changed', ({ tab }) => { if (tab === 'salario') renderFormSalarioDinamico(); });
    }

    // Re-renderiza a lista já carregada (caso já existam salários na tela)
    if (typeof window.renderSalarios === 'function' && window.currentTab === 'salario') {
      window.renderSalarios();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  console.log('[Fase4] Salários dinâmicos (por dia de recebimento) ativos ✓');
})();

/* ===== [de /home/claude/work/app_patch_fase3_cartoes_parcelamento.js] ===== */
/* ============================================================
   FINANCESAPP — FASE 3: FLUXO DE COMPRAS PARCELADAS + CARTÕES
   1) Remove o campo manual "Dia de vencimento da fatura" para
      Compras parceladas — o vencimento passa a vir SEMPRE do
      cartão selecionado.
   2) O cartão passa a ser escolhido logo no início do formulário
      (antes do valor) para compras parceladas.
   3) Se o usuário ainda não tem cartão cadastrado, permite criar
      um sem sair da tela (modal inline com Nome, Bandeira, Cor,
      Limite e Data de vencimento). Ao salvar, o novo cartão é
      selecionado automaticamente.
   4) Edição de cartões continua disponível normalmente na aba
      Cartões (nenhuma mudança ali).
   5) O botão superior "Adicionar" só aparece nas abas Gastos,
      Parcelados e Recorrentes — nas demais fica oculto.

   Carregue depois de app.js e app_patches.js.
   ============================================================ */

(function () {
  'use strict';

  /* ────────────────────────────────────────────────
     1) ESCONDE O CAMPO DE VENCIMENTO MANUAL P/ PARCELADAS
        (mantém visível para "Compras recorrentes", que não
        depende de um cartão — pode ser vencimento de boleto etc.)
     ──────────────────────────────────────────────── */
  function instalarToggleParcelasSemFatura() {
    if (typeof window.toggleParcelas !== 'function') { setTimeout(instalarToggleParcelasSemFatura, 250); return; }
    if (window.toggleParcelas._comFase3) return;

    const orig = window.toggleParcelas;
    const nova = function () {
      orig.apply(this, arguments);
      try {
        const cat = document.getElementById('m-cat')?.value;
        const isParc = cat === 'Compras parceladas';
        const vg = document.getElementById('vencimento-group');

        if (isParc) {
          // O vencimento passa a ser 100% automático (vem do cartão)
          if (vg) vg.style.display = 'none';
          // Mensagem de apoio no lugar do campo, mostrando o vencimento herdado
          garantirDicaVencimentoCartao();
          atualizarDicaVencimentoCartao();
          // Cartão vira o primeiro campo depois da categoria/valor — reordena
          reordenarCartaoPrimeiro();
          const cartaoLabel = document.getElementById('cartao-label');
          if (cartaoLabel) cartaoLabel.textContent = 'Cartão utilizado *';
        } else {
          removerDicaVencimentoCartao();
        }
      } catch (e) {
        console.warn('[Fase3] erro ao ajustar formulário de parcelados', e);
      }
    };
    nova._comFase3 = true;
    window.toggleParcelas = nova;
  }

  // Move o grupo do cartão para logo depois do valor (bem no início do
  // formulário) quando a categoria é "Compras parceladas", sem remover
  // nenhum outro campo — só reordena visualmente.
  function reordenarCartaoPrimeiro() {
    const cg = document.getElementById('cartao-group');
    const valorGroup = document.getElementById('m-valor')?.closest('.input-group');
    if (!cg || !valorGroup) return;
    if (cg.previousElementSibling === valorGroup) return; // já está na posição certa
    valorGroup.parentNode.insertBefore(cg, valorGroup.nextSibling);
  }

  function garantirDicaVencimentoCartao() {
    if (document.getElementById('cartao-vencimento-dica')) return;
    const cg = document.getElementById('cartao-group');
    if (!cg) return;
    const p = document.createElement('p');
    p.id = 'cartao-vencimento-dica';
    p.style.cssText = 'font-size:12px;color:var(--text3);margin:6px 0 0;line-height:1.5';
    cg.appendChild(p);
  }

  function atualizarDicaVencimentoCartao() {
    const dica = document.getElementById('cartao-vencimento-dica');
    const sel  = document.getElementById('m-cartao');
    if (!dica) return;
    const c = (window.cartoes || []).find(x => x.id === sel?.value);
    dica.textContent = c
      ? (c.vencimentoDia ? `📅 O vencimento desta compra será dia ${c.vencimentoDia} (vencimento do cartão ${c.nome}).` : `⚠️ Este cartão não tem um dia de vencimento cadastrado — edite-o na aba Cartões.`)
      : '📅 O dia de vencimento é herdado automaticamente do cartão escolhido.';
  }

  function removerDicaVencimentoCartao() {
    document.getElementById('cartao-vencimento-dica')?.remove();
  }

  /* ────────────────────────────────────────────────
     2) AO ESCOLHER O CARTÃO — preenche m-vencimento (agora
        oculto) automaticamente e abre o cadastro inline se
        "+ Cadastrar novo cartão" for escolhido.
     ──────────────────────────────────────────────── */
  function instalarAoEscolherCartaoInline() {
    window.aoEscolherCartaoGasto = function () {
      const sel = document.getElementById('m-cartao');
      if (!sel) return;

      if (sel.value === '__novo__') {
        sel.value = '';
        abrirModalCartaoInline();
        return;
      }

      const cat = document.getElementById('m-cat')?.value;
      const c = (window.cartoes || []).find(x => x.id === sel.value);
      const vencInput = document.getElementById('m-vencimento');

      if ((cat === 'Compras parceladas' || cat === 'Compras recorrentes') && c && c.vencimentoDia && vencInput) {
        vencInput.value = c.vencimentoDia;
        window.atualizarHintDivisivel?.();
      }
      atualizarDicaVencimentoCartao();
    };
  }

  /* ────────────────────────────────────────────────
     3) MODAL INLINE DE NOVO CARTÃO — não sai da tela de compra
     ──────────────────────────────────────────────── */
  function garantirModalCartaoInline() {
    if (document.getElementById('modal-cartao-inline')) return;

    const overlay = document.createElement('div');
    overlay.id = 'modal-cartao-inline';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:420px">
        <div class="modal-header">
          <h3>Novo Cartão</h3>
          <button type="button" class="modal-close" onclick="fecharModalCartaoInline()">✕</button>
        </div>
        <div class="modal-body">
          <div class="input-group">
            <label>Nome do cartão</label>
            <input type="text" id="ci-nome" placeholder="ex: Nubank, Inter, Bradesco..."/>
          </div>
          <div class="input-group" style="margin-top:12px">
            <label>Bandeira</label>
            <select id="ci-bandeira">
              <option value="">Selecione...</option>
              <option value="Visa">Visa</option>
              <option value="Mastercard">Mastercard</option>
              <option value="Elo">Elo</option>
              <option value="American Express">American Express</option>
              <option value="Hipercard">Hipercard</option>
              <option value="Outra">Outra</option>
            </select>
          </div>
          <div class="input-group" style="margin-top:12px">
            <label>Limite (R$)</label>
            <input type="number" id="ci-limite" placeholder="0,00" min="0" step="0.01"/>
          </div>
          <div class="input-group" style="margin-top:12px">
            <label>Data de vencimento (dia do mês)</label>
            <input type="number" id="ci-vencimento" placeholder="ex: 10" min="1" max="31"/>
          </div>
          <div class="input-group" style="margin-top:12px">
            <label>Cor de identificação</label>
            <div style="display:flex;align-items:center;gap:12px">
              <input type="color" id="ci-cor" value="#f0c040" style="width:44px;height:44px;border:none;background:none;cursor:pointer;border-radius:8px;padding:0"/>
              <span style="color:var(--text2);font-size:13px">Escolha uma cor</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary" onclick="fecharModalCartaoInline()">Cancelar</button>
          <button type="button" class="btn-primary" onclick="salvarCartaoInline()">Adicionar e usar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) window.fecharModalCartaoInline(); });
  }

  window.abrirModalCartaoInline = function () {
    garantirModalCartaoInline();
    ['ci-nome', 'ci-bandeira', 'ci-limite', 'ci-vencimento'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const cor = document.getElementById('ci-cor'); if (cor) cor.value = '#f0c040';
    document.getElementById('modal-cartao-inline').classList.add('open');
  };

  window.fecharModalCartaoInline = function () {
    document.getElementById('modal-cartao-inline')?.classList.remove('open');
  };

  window.salvarCartaoInline = async function () {
    const nome = document.getElementById('ci-nome').value.trim();
    const bandeira = document.getElementById('ci-bandeira').value || '';
    const limite = parseFloat(document.getElementById('ci-limite').value) || 0;
    const vencimentoDia = parseInt(document.getElementById('ci-vencimento').value) || null;
    const cor = document.getElementById('ci-cor').value || '#f0c040';

    if (!nome) { window.showToast?.('⚠️ Informe o nome do cartão'); return; }
    if (!vencimentoDia || vencimentoDia < 1 || vencimentoDia > 31) { window.showToast?.('⚠️ Informe um dia de vencimento válido (1 a 31)'); return; }

    const btn = document.querySelector('#modal-cartao-inline .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
      const { collection, addDoc } = window.firebaseFns || {};
      if (!collection || !addDoc || !window.firebaseDb || !window.currentUser) {
        throw new Error('Serviço indisponível. Recarregue a página.');
      }
      const ref = collection(window.firebaseDb, `users/${window.currentUser.uid}/cartoes`);
      const docRef = await addDoc(ref, { nome, cor, bandeira, limite, vencimentoDia });

      window.cartoes = window.cartoes || [];
      window.cartoes.push({ id: docRef.id, nome, cor, bandeira, limite, vencimentoDia });

      if (typeof window.renderCartoes === 'function') window.renderCartoes();
      window.AppBus?.emit?.('cartoes_changed');

      // Repopula o select do modal de compra e seleciona o novo cartão
      if (typeof window.populateCartaoSelect === 'function') {
        window.populateCartaoSelect();
      } else {
        const sel = document.getElementById('m-cartao');
        if (sel) sel.innerHTML = window.cartoes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('') + '<option value="__novo__">+ Cadastrar novo cartão</option>';
      }
      const sel = document.getElementById('m-cartao');
      if (sel) { sel.value = docRef.id; }

      const vencInput = document.getElementById('m-vencimento');
      if (vencInput) vencInput.value = vencimentoDia;
      atualizarDicaVencimentoCartao();
      window.atualizarHintDivisivel?.();

      window.showToast?.('✅ Cartão criado e selecionado!');
      window.fecharModalCartaoInline();
    } catch (e) {
      console.error('[Fase3] erro ao criar cartão inline', e);
      window.showToast?.('❌ Erro ao criar cartão: ' + (e.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Adicionar e usar'; }
    }
  };

  /* ────────────────────────────────────────────────
     4) EDIÇÃO DE GASTO EXISTENTE — ao abrir para editar uma
        compra parcelada, também esconde o campo de vencimento
        manual (o toggleParcelas já cuida disso ao ser chamado
        pelas próprias funções de edição do app.js).
     ──────────────────────────────────────────────── */

  /* ────────────────────────────────────────────────
     5) BOTÃO SUPERIOR "ADICIONAR" — só aparece nas abas onde
        faz sentido lançar um gasto (Gastos, Parcelados,
        Recorrentes). Nas demais abas fica oculto.
     ──────────────────────────────────────────────── */
  const ABAS_COM_BOTAO_ADICIONAR = ['gastos', 'parcelados', 'recorrentes'];

  function atualizarVisibilidadeBotaoAdicionar() {
    const btn = document.querySelector('.btn-add');
    if (!btn) return;
    btn.style.display = ABAS_COM_BOTAO_ADICIONAR.includes(window.currentTab) ? '' : 'none';
  }

  function instalarVisibilidadeBotaoAdicionar() {
    atualizarVisibilidadeBotaoAdicionar();

    // Não usa "senão" (AppBus OU switchTab): liga nos dois, sempre que
    // disponíveis. Isso evita que o botão fique "preso" escondido/visível
    // caso um dos dois mecanismos não esteja pronto ainda no momento em
    // que este arquivo carrega (era a causa do bug de desaparecimento).
    const ligarAppBus = () => {
      if (!window.AppBus?.on) { setTimeout(ligarAppBus, 250); return; }
      window.AppBus.on('tab_changed', atualizarVisibilidadeBotaoAdicionar);
    };
    ligarAppBus();

    const ligarSwitchTab = () => {
      if (typeof window.switchTab !== 'function') { setTimeout(ligarSwitchTab, 250); return; }
      if (window.switchTab._comFase3Botao) return;
      const orig = window.switchTab;
      const nova = function (tab) {
        orig.apply(this, arguments);
        atualizarVisibilidadeBotaoAdicionar();
      };
      nova._comFase3Botao = true;
      window.switchTab = nova;
    };
    ligarSwitchTab();

    // Rede de segurança: reaplica o estado correto sempre que o app
    // terminar de inicializar (login) e periodicamente, caso alguma outra
    // parte do código toque no estilo do botão diretamente.
    const origAppInit = window.appInit;
    if (typeof origAppInit === 'function' && !origAppInit._comFase3Botao) {
      window.appInit = function (...args) {
        const r = origAppInit.apply(this, args);
        setTimeout(atualizarVisibilidadeBotaoAdicionar, 50);
        return r;
      };
      window.appInit._comFase3Botao = true;
    }
    setInterval(atualizarVisibilidadeBotaoAdicionar, 4000);
  }

  /* ────────────────────────────────────────────────
     INICIALIZAÇÃO
     ──────────────────────────────────────────────── */
  function tudoPronto() {
    return typeof window.toggleParcelas === 'function' &&
           typeof window.populateCartaoSelect !== 'undefined' &&
           document.getElementById('m-cartao') &&
           document.getElementById('modal-overlay');
  }

  function iniciar() {
    if (!tudoPronto()) { setTimeout(iniciar, 250); return; }
    instalarToggleParcelasSemFatura();
    instalarAoEscolherCartaoInline();
    garantirModalCartaoInline();
    // Aplica o estado inicial (caso o modal de compra já esteja com
    // "Compras parceladas" selecionado ao carregar a página)
    window.toggleParcelas();
  }

  // A visibilidade do botão "Adicionar" não depende do fluxo de cartões —
  // é iniciada separadamente para não ficar refém da mesma checagem de
  // prontidão do modal de compra (que só existe depois do login).
  instalarVisibilidadeBotaoAdicionar();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  console.log('[Fase3] Fluxo de cartão obrigatório + cadastro inline para parcelados ativo ✓');
})();

/* ===== [de /home/claude/work/app_patch_fase2_divisao_dinamica.js] ===== */
/* ============================================================
   FINANCESAPP — FASE 2: DIAS DE RECEBIMENTO DINÂMICOS
   + DIVISÃO DE SALÁRIO

   Remove toda a lógica fixa de "Divisão 15/30" e passa a
   distribuir contas entre os dias de recebimento cadastrados
   pelo usuário (users/{uid}.diasRecebimento, gravado no Wizard).

   Regra de distribuição (igual para saldo e faturas):
   um valor pendente é dividido em partes iguais entre TODOS os
   dias de recebimento cadastrados. Ex.: conta de R$600 com
   recebimentos nos dias 05 e 20 → R$300 no dia 05 e R$300 no dia 20.

   Para a divisão "Por Cartão", cada lançamento é alocado ao dia
   de recebimento mais próximo do seu próprio vencimento (bucket
   dinâmico), preservando o comportamento de "fatura fecha perto
   de tal recebimento" que existia com dia 15/30, porém agora
   com N dias.

   A tela "Divisão de Salário" só aparece no menu para quem tem
   mais de um dia de recebimento cadastrado.

   Carregue por último (depois de app.js, app_patches.js,
   app_wizard_cadastro.js e app_patch_fase4_salarios_dinamicos.js).
   ============================================================ */

(function () {
  'use strict';

  /* ────────────────────────────────────────────────
     DIAS DE RECEBIMENTO ATIVOS (fonte única de verdade)
     ──────────────────────────────────────────────── */
  function diasAtivosImpl() {
    const dias = (window.userProfile?.diasRecebimento || [])
      .map(d => parseInt(d))
      .filter(d => d >= 1 && d <= 31);
    const unicos = [...new Set(dias)].sort((a, b) => a - b);
    return unicos.length ? unicos : [15, 30]; // fallback p/ contas sem quiz preenchido
  }
  window.diasRecebimentoAtivos = window.diasRecebimentoAtivos || diasAtivosImpl;
  function dias() { return window.diasRecebimentoAtivos(); }

  // Dia de recebimento mais próximo de um vencimento (distância circular
  // dentro do "mês" de 31 dias) — usado pelos cards "Por Cartão", que
  // precisam alocar CADA lançamento a um único dia.
  function diaMaisProximo(diaVenc) {
    const lista = dias();
    const dv = parseInt(diaVenc) || 1;
    if (lista.length <= 1) return lista[0] || dv;
    let melhor = lista[0], menorDist = Infinity;
    lista.forEach(d => {
      const bruta = Math.abs(d - dv);
      const dist  = Math.min(bruta, 31 - bruta);
      if (dist < menorDist) { menorDist = dist; melhor = d; }
    });
    return melhor;
  }
  window.diaRecebimentoMaisProximo = diaMaisProximo;

  /* ────────────────────────────────────────────────
     SUBSTITUI faixaFaturaPorDia — antes retornava a string
     'dia15'/'dia30'; agora retorna o NÚMERO do dia de
     recebimento mais próximo. Todo o restante do app.js que
     compara com 'dia15'/'dia30' também é sobrescrito abaixo,
     então não sobra nenhuma referência à divisão fixa.
     ──────────────────────────────────────────────── */
  window.faixaFaturaPorDia = function (dia) {
    return diaMaisProximo(dia);
  };

  window.faturaPagamentoKey = function (mes, cartaoKey, dia) {
    return `${mes}|${cartaoKey}|${diaMaisProximo(dia)}`;
  };

  window.pagamentoFaturaCartao = function (mes, cartaoKey, dia) {
    const key = window.faturaPagamentoKey(mes, cartaoKey, dia);
    return (window.pagamentos || []).find(p => p.tipo === 'fatura-cartao' && p.faturaKey === key);
  };

  window.faturaCartaoPaga = function (mes, cartaoKey, dia) {
    return !!window.pagamentoFaturaCartao(mes, cartaoKey, dia);
  };

  window.gastoEstaEmFaturaPaga = function (g, mes) {
    const cartaoKey = window.chaveCartaoGasto ? window.chaveCartaoGasto(g) : (g?.cartaoId || g?.cartaoNome || '');
    if (!cartaoKey) return false;
    const diaBucket = diaMaisProximo(window.diaFaturaGasto ? window.diaFaturaGasto(g, mes) : 1);
    return window.faturaCartaoPaga(mes, cartaoKey, diaBucket);
  };

  window.filtrarFaturasPendentes = function (gastosMes, mes) {
    return gastosMes.filter(g => !window.gastoEstaEmFaturaPaga(g, mes));
  };

  window.tipoPagLabel = function (tipo) {
    const map = { individual: 'Um por um', soma: 'Soma total', dividido: 'Dividido entre os recebimentos' };
    return map[tipo] || tipo;
  };

  /* ────────────────────────────────────────────────
     TELA "DIVISÃO DE SALÁRIO" — SÓ PARA MULTI-DIA
     ──────────────────────────────────────────────── */
  function atualizarVisibilidadeAbaDivisao() {
    const mostrar = dias().length > 1;
    document.querySelectorAll('[data-tab="divisao"]').forEach(el => {
      el.style.display = mostrar ? '' : 'none';
    });
    // Se o usuário estiver na aba e ela deixar de fazer sentido, volta ao dashboard
    if (!mostrar && window.currentTab === 'divisao' && typeof window.switchTab === 'function') {
      window.switchTab('dashboard');
    }
  }

  function atualizarTextosDivisao() {
    const lista = dias();
    document.querySelectorAll('.nav-label').forEach(el => {
      if (el.textContent.trim() === 'Divisão 15/30') el.textContent = 'Divisão de Salário';
    });
    document.querySelectorAll('[data-tooltip="Divisão 15/30"]').forEach(el => el.setAttribute('data-tooltip', 'Divisão de Salário'));
    document.querySelectorAll('.mobile-nav-item').forEach(btn => {
      if (btn.textContent.trim() !== 'Divisão 15/30') return;
      const textNode = [...btn.childNodes].reverse().find(n => n.nodeType === 3 && n.textContent.trim());
      if (textNode) textNode.textContent = ' Divisão de Salário';
    });
    const hint = document.querySelector('.card-parcel .card-hint');
    if (hint) hint.textContent = lista.length > 1 ? `Dividido entre os dias ${lista.join(', ')}` : `Pago no dia ${lista[0]}`;
    const divisivelLabel = document.querySelector('#divisivel-group label');
    if (divisivelLabel) divisivelLabel.textContent = lista.length > 1 ? 'Entra na Divisão de Salário?' : 'Entra na divisão de contas?';
    const btnSim = document.getElementById('divisivel-btn-sim');
    if (btnSim) btnSim.textContent = lista.length > 1 ? `✂️ Sim, dividir entre os recebimentos` : '✂️ Sim, dividir';
    const sobrouLabel = document.querySelector('#sobrou-extra-group label');
    if (sobrouLabel) sobrouLabel.textContent = 'Dividir entre os dias de recebimento?';
    const sobrouSim = document.getElementById('sobrou-div-sim');
    if (sobrouSim) sobrouSim.textContent = '✂️ Sim, dividir';
  }

  window.atualizarHintDivisivel = function () {
    const hint = document.getElementById('divisivel-hint');
    const vencDia = parseInt(document.getElementById('m-vencimento')?.value) || null;
    if (!hint) return;
    const lista = dias();
    if (window.recDivisivel === true) {
      hint.textContent = lista.length > 1
        ? `✂️ Será incluído na Divisão de Salário e dividido igualmente entre os dias ${lista.join(', ')}.`
        : `✂️ Será incluído na divisão e pago integralmente no dia ${lista[0]}.`;
      hint.style.color = 'var(--accent)';
    } else if (window.recDivisivel === false) {
      const diaTexto = vencDia ? `dia ${vencDia}` : 'o dia de vencimento';
      hint.textContent = `📅 Não entra na Divisão de Salário. Aparecerá no calendário integralmente no ${diaTexto}.`;
      hint.style.color = 'var(--blue)';
    } else {
      hint.textContent = '';
    }
  };

  /* ────────────────────────────────────────────────
     ============ RENDER DIVISÃO (tela principal) ============
     Substitui window.renderDivisao por completo — cards de
     saldo dinâmicos (1 por dia de recebimento), detalhamento
     geral e sub-bloco "por cartão".
     ──────────────────────────────────────────────── */
  function garantirCardsDinamicos() {
    const cardsWrap = document.querySelector('.divisao-cards');
    if (!cardsWrap) return null;
    let dinamico = document.getElementById('div-cards-dinamico');
    if (!dinamico) {
      dinamico = document.createElement('div');
      dinamico.id = 'div-cards-dinamico';
      dinamico.className = 'divisao-cards';
      cardsWrap.parentNode.insertBefore(dinamico, cardsWrap);
      cardsWrap.style.display = 'none';
      cardsWrap.setAttribute('aria-hidden', 'true');
    }
    return dinamico;
  }

  window.renderDivisao = function () {
    const mes = document.getElementById('div-mes-select').value;
    document.getElementById('div-mes-label').textContent = formatMes(mes);

    const listaDias = dias();

    const recExcluirDivisaoIds = new Set(
      recorrentes.filter(r => r.ativo === false || r.divisivel === false).map(r => r.id)
    );
    const gastosDoMesPendente = window.filtrarFaturasPendentes(gastosResumoMesPendente(mes), mes).filter(g =>
      !(g.recorrenteId && recExcluirDivisaoIds.has(g.recorrenteId))
    );
    const totalGastosPendente = gastosDoMesPendente.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);

    const gastosDoMesTodos = gastosResumoMes(mes).filter(g =>
      !(g.recorrenteId && recExcluirDivisaoIds.has(g.recorrenteId))
    );

    const salObj  = salarios.find(s => s.mes === mes);
    const salario = salarioTotal(salObj);
    const extras  = totalExtrasSalario(salObj);
    const renda   = rendaTotalMes(salObj, mes);
    const totalJaPago = parceladosPagosMes(mes).reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
    const totalPagamentosConfirmados = totalPagamentosMes(mes);

    const saldo = renda - totalJaPago - totalPagamentosConfirmados;
    const parte = saldo > 0 ? saldo / listaDias.length : 0;

    // Cards dinâmicos "Guardar / pagar dia X"
    const cardsEl = garantirCardsDinamicos();
    if (cardsEl) {
      cardsEl.innerHTML = listaDias.map(d => `
        <div class="div-card">
          <div class="div-card-date">${d}</div>
          <div class="div-card-value">${fmtR(parte)}</div>
          <div class="div-card-hint">Guardar / pagar dia ${d}</div>
        </div>
      `).join('');
    }

    const cats = ['Alimentação', 'Compras parceladas', 'Compras recorrentes', 'Compras futuras', 'Roupas e calçados', 'Lazer', 'Auto-cuidado', 'Transporte'];
    const catTotais = cats.map(c => ({
      cat: c,
      val: gastosDoMesPendente.filter(g => g.categoria === c).reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)
    })).filter(x => x.val > 0);

    const jaPagoHtml = totalJaPago > 0 ? `
      <div class="div-row" style="background:rgba(61,214,140,0.06);border-radius:8px;padding:10px 12px;margin-bottom:4px">
        <span class="div-row-label" style="color:var(--green)">✅ Parcelas já pagas este mês</span>
        <span class="div-row-val" style="color:var(--green)">− ${fmtR(totalJaPago)}</span>
      </div>` : '';

    const recExcluidas = recorrentes.filter(r => r.ativo !== false && r.divisivel === false);
    const recExcluidasHtml = recExcluidas.length > 0 ? `
      <div class="div-row" style="background:rgba(77,157,224,0.05);border-radius:8px;padding:8px 12px;border:1px solid rgba(77,157,224,0.15);margin-top:2px">
        <span class="div-row-label" style="color:var(--blue);font-size:12px">📅 Fora desta divisão (só no calendário)</span>
        <span class="div-row-val" style="color:var(--text3);font-size:12px">${recExcluidas.map(r => escHtml(r.loja)).join(', ')}</span>
      </div>` : '';

    // Recorrentes/parcelados pendentes — bloco dinâmico (substitui o antigo
    // patch fixo de "recorrentes e parcelados 15/30" do app_patches.js)
    const recAtivos = recorrentes.filter(r => r.ativo !== false && r.divisivel !== false);
    const totalRecorrentes = recAtivos.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
    const parceladosPendentes = gastos
      .filter(g => g.categoria === 'Compras parceladas' && !(g.recorrenteId && recExcluirDivisaoIds.has(g.recorrenteId)))
      .map(g => ({ nome: g.loja || 'Parcelado', valor: valorParcelasNoMesPendente(g, mes) }))
      .filter(p => p.valor > 0);
    const totalParcelados = parceladosPendentes.reduce((s, p) => s + p.valor, 0);

    function linhasPorDia(total) {
      const parte = total / listaDias.length;
      return `<span style="font-size:12px;color:var(--text2)">${listaDias.map(d => `Dia ${d}: <b style="color:var(--accent)">${fmtR(parte)}</b>`).join(' &nbsp;|&nbsp; ')}</span>`;
    }

    const recParcBlocoHtml = (totalRecorrentes > 0 || totalParcelados > 0) ? `
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
        <div style="font-family:var(--font-head);font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
          ✂️ Recorrentes e Parcelados — divisão de salário
        </div>
        ${totalRecorrentes > 0 ? `
        <div class="div-row" style="margin-bottom:2px"><span class="div-row-label"><b>🔄 Recorrentes</b></span><span class="div-row-val neg">− ${fmtR(totalRecorrentes)}</span></div>
        <div class="div-row div-row-sub" style="padding-left:16px;margin-bottom:8px"><span class="div-row-label">${linhasPorDia(totalRecorrentes)}</span><span></span></div>` : ''}
        ${totalParcelados > 0 ? `
        <div class="div-row" style="margin-bottom:2px"><span class="div-row-label"><b>📦 Parcelados (pendente)</b></span><span class="div-row-val neg">− ${fmtR(totalParcelados)}</span></div>
        <div class="div-row div-row-sub" style="padding-left:16px;margin-bottom:8px"><span class="div-row-label">${linhasPorDia(totalParcelados)}</span><span></span></div>` : ''}
      </div>` : '';

    document.getElementById('div-detail').innerHTML = `
      <div class="div-row"><span class="div-row-label">Salário</span><span class="div-row-val pos">${fmtR(salario - extras)}</span></div>
      ${extras > 0 ? `<div class="div-row"><span class="div-row-label">Dinheiro externo</span><span class="div-row-val pos">${fmtR(extras)}</span></div>` : ''}
      <div class="div-row"><span class="div-row-label">Renda total</span><span class="div-row-val">${fmtR(renda)}</span></div>
      ${jaPagoHtml}
      ${totalPagamentosConfirmados > 0 ? `<div class="div-row" style="background:rgba(61,214,140,0.06);border-radius:8px;padding:10px 12px;margin-bottom:4px"><span class="div-row-label" style="color:var(--green)">✅ Pagamentos confirmados</span><span class="div-row-val" style="color:var(--green)">− ${fmtR(totalPagamentosConfirmados)}</span></div>` : ''}
      ${catTotais.map(x => `<div class="div-row"><span class="div-row-label">↳ ${x.cat} (pendente)</span><span class="div-row-val neg">− ${fmtR(x.val)}</span></div>`).join('')}
      <div class="div-row"><span class="div-row-label"><b>Total pendente</b></span><span class="div-row-val neg">− ${fmtR(totalGastosPendente)}</span></div>
      <div class="div-row"><span class="div-row-label"><b>Saldo líquido confirmado</b></span><span class="div-row-val ${saldo >= 0 ? 'pos' : 'neg'}">${fmtR(saldo)}</span></div>
      ${listaDias.map(d => `
      <div class="div-row" style="background:rgba(240,192,64,0.06);border-radius:8px;padding:12px;margin-top:4px">
        <span class="div-row-label"><b>Guardar dia ${d}</b></span>
        <span class="div-row-val" style="color:var(--accent)">${fmtR(parte)}</span>
      </div>`).join('')}
      ${recExcluidasHtml}
      ${recParcBlocoHtml}
    `;

    renderDivisaoPorCartao(mes);
    atualizarTextosDivisao();
  };

  /* ────────────────────────────────────────────────
     PAGAR FATURA DE CARTÃO (dinâmico, qualquer dia)
     ──────────────────────────────────────────────── */
  window.pagarFaturaCartaoDivisao = async function (cartaoKeyEncoded, diaParam) {
    const cartaoKey = decodeURIComponent(cartaoKeyEncoded || '');
    const diaFatura = diaMaisProximo(diaParam);
    const mes = document.getElementById('div-mes-select')?.value || new Date().toISOString().slice(0, 7);
    const faturaKey = window.faturaPagamentoKey(mes, cartaoKey, diaFatura);

    if (pagamentos.some(p => p.tipo === 'fatura-cartao' && p.faturaKey === faturaKey)) {
      showToast('✅ Essa fatura já foi paga.');
      return;
    }

    const recExcluirDivisaoIds = new Set(
      recorrentes.filter(r => r.ativo === false || r.divisivel === false).map(r => r.id)
    );
    const itens = window.filtrarFaturasPendentes(gastosResumoMesPendente(mes), mes).filter(g =>
      chaveCartaoGasto(g) === cartaoKey &&
      diaMaisProximo(diaFaturaGasto(g, mes)) === diaFatura &&
      !(g.recorrenteId && recExcluirDivisaoIds.has(g.recorrenteId))
    );

    if (!itens.length) {
      showToast('✅ Nenhuma fatura pendente para esse cartão e dia.');
      return;
    }

    const totalFatura = itens.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
    const totalNaoParcelado = itens.filter(g => g.categoria !== 'Compras parceladas').reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
    const cartaoNome = nomeCartaoPorChave(cartaoKey, itens[0]?.cartaoNome || 'Cartão');

    confirmarAcao({
      titulo: 'Confirmar pagamento da fatura',
      mensagem: `Dar baixa em <b>${escHtml(cartaoNome)}</b> no <b>dia ${diaFatura}</b>?<br><small style="color:var(--text3)">Total: ${fmtR(totalFatura)}. Essa fatura não poderá ser descontada novamente.</small>`,
      icone: '✅',
      tipoBotao: 'info',
      textoBotao: 'Confirmar pagamento',
      onConfirm: async () => {
        const { collection, addDoc } = fns();
        const ultimoDiaMes = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
        const dataPag = `${mes}-${String(Math.min(diaFatura, ultimoDiaMes)).padStart(2, '0')}`;

        for (const g of itens.filter(x => x.categoria === 'Compras parceladas')) {
          const numAtual = numParcelaNoMes(g, mes);
          const pagasNums = numsParcelasPagas(g);
          const agendadas = Array.isArray(g.parcelasAgendadas)
            ? g.parcelasAgendadas.filter(a => a.adiantadaMes === mes && diaMaisProximo(a.adiantadaDia) === diaFatura)
            : [];
          const nums = [
            ...(numAtual && !pagasNums.includes(numAtual) ? [numAtual] : []),
            ...agendadas.map(a => a.num).filter(n => !pagasNums.includes(n))
          ];
          if (!nums.length) continue;

          const pagas = parcelasPagasObj(g).filter(p => !nums.includes(p.num));
          nums.forEach(num => {
            const ag = agendadas.find(a => a.num === num);
            pagas.push({ num, data: ag?.data || dataPag, adiantadaMes: ag?.adiantadaMes, adiantadaDia: ag?.adiantadaDia, faturaCartaoKey: faturaKey });
          });

          const atrasos = parcelasAtrasadasObj(g).map(a =>
            nums.includes(a.num) && a.mesOrigem === mes ? { ...a, resolvido: true, pagoEm: dataPag } : a
          );
          const agendamentosRestantes = (g.parcelasAgendadas || []).filter(a => !nums.includes(a.num));

          await atualizarGastoParcelado(g, {
            parcelasPagas: pagas.sort((a, b) => a.num - b.num),
            parcelaPaga: pagas.length,
            parcelasAtrasadas: atrasos,
            parcelasAgendadas: agendamentosRestantes
          });
        }

        const docRef = await addDoc(collection(db(), `users/${uid()}/pagamentos`), {
          mes, dia: diaFatura, valor: totalFatura, valorSaldo: totalNaoParcelado, tipo: 'fatura-cartao',
          descricao: `Fatura ${cartaoNome} (dia ${diaFatura})`,
          cartaoId: cartoes.find(c => c.id === cartaoKey)?.id || null, cartaoNome, faturaKey, criadoEm: new Date().toISOString()
        });
        pagamentos.push({ id: docRef.id, mes, dia: diaFatura, valor: totalFatura, valorSaldo: totalNaoParcelado, tipo: 'fatura-cartao', descricao: `Fatura ${cartaoNome} (dia ${diaFatura})`, cartaoNome, faturaKey });

        await loadGastos();
        await loadPagamentos();
        showToast('✅ Fatura paga e saldo atualizado!', true);
        renderDivisao();
        renderParcelados();
        renderRecorrentes();
        renderDashboard();
        if (currentTab === 'pagamentos') renderPagamentos();
        if (currentTab === 'calendario') renderCalendario();
      }
    });
  };

  /* ────────────────────────────────────────────────
     ============ DIVISÃO POR CARTÃO (dinâmico) ============
     ──────────────────────────────────────────────── */
  window.renderDivisaoPorCartao = function (mes) {
    const el = document.getElementById('div-por-cartao');
    if (!el) return;

    const listaDias = dias();
    const _recExcCartaoIds = new Set(recorrentes.filter(r => r.ativo === false || r.divisivel === false).map(r => r.id));
    const gastosDoMes = window.filtrarFaturasPendentes(gastosResumoMesPendente(mes), mes).filter(g =>
      !(g.recorrenteId && _recExcCartaoIds.has(g.recorrenteId))
    );
    const comCartao = gastosDoMes.filter(g => g.cartaoId || g.cartaoNome);

    if (!comCartao.length && !cartoes.length) { el.innerHTML = ''; return; }

    const porCartao = {};
    comCartao.forEach(g => {
      const key = g.cartaoId || g.cartaoNome || 'Sem cartão';
      if (!porCartao[key]) porCartao[key] = { nome: g.cartaoNome || key, total: 0, itens: [] };
      porCartao[key].total += parseFloat(g.valor) || 0;
      porCartao[key].itens.push(g);
    });

    const cartaoCards = Object.entries(porCartao).map(([key, { nome, total, itens }]) => {
      const cartaoObj = cartoes.find(c => c.id === key);
      const cor = cartaoObj?.cor || '#8b92a8';
      const totalLiquido = total;

      // Bruto por dia de recebimento (bucket pelo dia mais próximo do vencimento)
      const brutoPorDia = {};
      listaDias.forEach(d => { brutoPorDia[d] = 0; });
      itens.forEach(g => {
        const d = diaMaisProximo(diaFaturaGasto(g, mes));
        brutoPorDia[d] = (brutoPorDia[d] || 0) + (parseFloat(g.valor) || 0);
      });

      const diaBlocosHtml = listaDias.map(d => `
        <div class="div-cartao-meta">
          <div class="div-cartao-meta-dia">Dia ${d}</div>
          <div class="div-cartao-meta-val">${fmtR(brutoPorDia[d])}</div>
        </div>`).join('<div class="div-cartao-sep">+</div>');

      const botoesHtml = listaDias.map(d => {
        const disabled = brutoPorDia[d] <= 0 || faturaCartaoPaga(mes, key, d);
        return `<button type="button" class="btn-fatura-divisao" ${disabled ? 'disabled' : ''} onclick="pagarFaturaCartaoDivisao('${encodeURIComponent(key)}', ${d})">
          ${faturaCartaoPaga(mes, key, d) ? 'Pago' : 'Pagar'} ${escHtml(nome)} (dia ${d})
        </button>`;
      }).join('');

      return `
        <div class="div-cartao-card" style="border-left:4px solid ${cor}">
          <div class="div-cartao-header">
            <div>
              <div class="div-cartao-nome">💳 ${escHtml(nome)}</div>
              <div class="div-cartao-sub">${itens.length} lançamento${itens.length !== 1 ? 's' : ''}</div>
            </div>
            <div class="div-cartao-total">${fmtR(totalLiquido)}</div>
          </div>
          <div class="div-cartao-divisao">${diaBlocosHtml}</div>
          <div class="div-cartao-actions">${botoesHtml}</div>
        </div>
      `;
    }).join('');

    el.innerHTML = cartaoCards ? `
      <div style="margin-bottom:20px">
        <div style="font-family:var(--font-head);font-size:13px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">
          💳 Por Cartão
        </div>
        <div class="div-cartao-grid">${cartaoCards}</div>
      </div>
    ` : '';
  };


  /* ────────────────────────────────────────────────
     ============ COUNTDOWN "PRÓXIMO PAGAMENTO" ============
     Substitui calcularProximoPagamento (antes fixo em 15/30)
     ──────────────────────────────────────────────── */
  window.calcularProximoPagamento = function () {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    const dia = hoje.getDate();
    const listaDias = dias();

    const ultimoDiaMesAtual = new Date(ano, mes + 1, 0).getDate();
    const diasValidosEsteMes = listaDias.map(d => Math.min(d, ultimoDiaMesAtual)).sort((a, b) => a - b);

    let proximaData = null;
    const proximoNesteMes = diasValidosEsteMes.find(d => d >= dia);

    if (proximoNesteMes !== undefined) {
      proximaData = new Date(ano, mes, proximoNesteMes);
    } else {
      const proximoMesIdx = mes + 1;
      const anoProximo = proximoMesIdx > 11 ? ano + 1 : ano;
      const mesProximo  = proximoMesIdx > 11 ? 0 : proximoMesIdx;
      const ultimoDiaProxMes = new Date(anoProximo, mesProximo + 1, 0).getDate();
      const primeiroDiaProxMes = Math.min(listaDias[0], ultimoDiaProxMes);
      proximaData = new Date(anoProximo, mesProximo, primeiroDiaProxMes);
    }

    const nomeData = `dia ${proximaData.getDate()} de ${proximaData.toLocaleDateString('pt-BR', { month: 'long' })}`;
    const hojeNorm = new Date(ano, mes, dia);
    const diff = Math.round((proximaData - hojeNorm) / (1000 * 60 * 60 * 24));

    return { diff, nomeData, proximaData };
  };

  /* ────────────────────────────────────────────────
     INICIALIZAÇÃO
     ──────────────────────────────────────────────── */
  function tudoPronto() {
    return typeof window.renderDivisao === 'function' &&
           typeof window.gastosResumoMesPendente === 'function' &&
           typeof window.fmtR === 'function' &&
           document.getElementById('div-detail');
  }

  function instalarHookToggleParcelas() {
    if (typeof window.toggleParcelas !== 'function' || window.toggleParcelas._comFase2Textos) return;
    const orig = window.toggleParcelas;
    const nova = function () {
      orig.apply(this, arguments);
      atualizarTextosDivisao();
    };
    nova._comFase2Textos = true;
    window.toggleParcelas = nova;
  }

  function iniciar() {
    if (!tudoPronto()) { setTimeout(iniciar, 250); return; }

    atualizarVisibilidadeAbaDivisao();
    atualizarTextosDivisao();
    instalarHookToggleParcelas();

    if (window.currentTab === 'divisao') renderDivisao();

    let ultimaAssinatura = JSON.stringify(dias());
    setInterval(() => {
      const atual = JSON.stringify(dias());
      if (atual !== ultimaAssinatura) {
        ultimaAssinatura = atual;
        atualizarVisibilidadeAbaDivisao();
        atualizarTextosDivisao();
        if (window.currentTab === 'divisao') renderDivisao();
        if (window.currentTab === 'dashboard') renderCountdownPagamentos?.();
      }
    }, 1000);

    if (window.AppBus?.on) {
      window.AppBus.on('tab_changed', ({ tab }) => {
        if (tab === 'divisao') atualizarTextosDivisao();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  console.log('[Fase2] Divisão de Salário dinâmica (sem 15/30 fixo) ativa ✓');
})();

/* ===== [de /home/claude/work/app_patch_fase5_recebimento_config.js] ===== */
/* ============================================================
   FINANCESAPP — FASE 5: ALTERAR DIA DE RECEBIMENTO NAS CONFIGURAÇÕES
   Adiciona à aba Configurações uma forma de o usuário trocar,
   a qualquer momento, o(s) dia(s) em que recebe salário — o mesmo
   dado gravado no Quiz de cadastro (users/{uid}.diasRecebimento).

   Ao salvar, window.userProfile.diasRecebimento é atualizado na
   hora e todos os pontos do sistema que dependem dele (Divisão,
   Salário, Dashboard, Calendário) já leem esse valor dinamicamente
   a cada render — então basta disparar os re-renders relevantes
   para o novo dia valer imediatamente em todo o app, sem F5.

   Carregue depois de app.js, app_live_refresh.js e
   app_wizard_cadastro.js.
   ============================================================ */

(function () {
  'use strict';

  const cfgEstado = {
    tipo: 'unico',       // 'unico' | 'multiplo'
    diaUnico: null,
    diasMultiplos: []
  };

  function cfgMsg(tipo, texto) {
    const el = document.getElementById('cfg-recebimento-msg');
    if (!el) return;
    if (typeof window.showCfgMsg === 'function') { window.showCfgMsg(el, tipo, texto); return; }
    el.textContent = texto;
  }

  /* ────────────────────────────────────────────────
     CHIPS DE DIAS MÚLTIPLOS (mesmo padrão do Wizard)
     ──────────────────────────────────────────────── */
  function renderChipsConfig() {
    const wrap = document.getElementById('cfg-dias-chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    cfgEstado.diasMultiplos.slice().sort((a, b) => a - b).forEach(dia => {
      const chip = document.createElement('span');
      chip.className = 'wizard-dia-chip';
      chip.innerHTML = `Dia ${String(dia).padStart(2, '0')} <button type="button" aria-label="Remover">✕</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        cfgEstado.diasMultiplos = cfgEstado.diasMultiplos.filter(d => d !== dia);
        renderChipsConfig();
      });
      wrap.appendChild(chip);
    });
  }

  window.adicionarDiaRecebimentoConfig = function () {
    const input = document.getElementById('cfg-dia-novo');
    const dia = parseInt(input?.value, 10);
    if (!dia || dia < 1 || dia > 31) { cfgMsg('error', 'Informe um dia válido (1 a 31).'); return; }
    if (cfgEstado.diasMultiplos.includes(dia)) { cfgMsg('error', 'Esse dia já foi adicionado.'); return; }
    cfgEstado.diasMultiplos.push(dia);
    if (input) input.value = '';
    cfgMsg('', '');
    renderChipsConfig();
  };

  /* ────────────────────────────────────────────────
     SELEÇÃO DE CARDS (único / múltiplo)
     ──────────────────────────────────────────────── */
  function ligarCardsConfig() {
    const container = document.getElementById('cfg-recebimento-options');
    if (!container || container._ligado) return;
    container._ligado = true;
    container.querySelectorAll('.wizard-card').forEach(card => {
      card.addEventListener('click', () => {
        container.querySelectorAll('.wizard-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        cfgEstado.tipo = card.dataset.value;
        const blocoUnico = document.getElementById('cfg-dia-unico-block');
        const blocoMulti = document.getElementById('cfg-dias-multiplos-block');
        if (blocoUnico) blocoUnico.style.display = cfgEstado.tipo === 'unico' ? 'flex' : 'none';
        if (blocoMulti) blocoMulti.style.display = cfgEstado.tipo === 'multiplo' ? 'flex' : 'none';
      });
    });

    document.getElementById('cfg-dia-novo')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); window.adicionarDiaRecebimentoConfig(); }
    });
  }

  /* ────────────────────────────────────────────────
     PREENCHE O ESTADO ATUAL AO ABRIR CONFIGURAÇÕES
     ──────────────────────────────────────────────── */
  function preencherEstadoAtual() {
    ligarCardsConfig();
    const dias = (window.userProfile?.diasRecebimento || []).filter(d => d);
    cfgEstado.tipo = dias.length > 1 ? 'multiplo' : 'unico';
    cfgEstado.diaUnico = dias.length ? dias[0] : null;
    cfgEstado.diasMultiplos = dias.length > 1 ? dias.slice() : [];

    const container = document.getElementById('cfg-recebimento-options');
    container?.querySelectorAll('.wizard-card').forEach(c => c.classList.toggle('active', c.dataset.value === cfgEstado.tipo));

    const blocoUnico = document.getElementById('cfg-dia-unico-block');
    const blocoMulti = document.getElementById('cfg-dias-multiplos-block');
    if (blocoUnico) blocoUnico.style.display = cfgEstado.tipo === 'unico' ? 'flex' : 'none';
    if (blocoMulti) blocoMulti.style.display = cfgEstado.tipo === 'multiplo' ? 'flex' : 'none';

    const inputUnico = document.getElementById('cfg-dia-unico');
    if (inputUnico) inputUnico.value = cfgEstado.diaUnico || '';

    renderChipsConfig();
    cfgMsg('', '');
  }

  function patchRenderConfiguracoes() {
    function tentar() {
      if (typeof window.renderConfiguracoes !== 'function') { setTimeout(tentar, 300); return; }
      if (window.renderConfiguracoes._comRecebimento) return;
      const orig = window.renderConfiguracoes;
      const nova = function () {
        orig.apply(this, arguments);
        preencherEstadoAtual();
      };
      nova._comRecebimento = true;
      window.renderConfiguracoes = nova;
    }
    tentar();
  }

  /* ────────────────────────────────────────────────
     SALVAR — grava no Firestore e propaga na hora para todo o app
     ──────────────────────────────────────────────── */
  window.salvarDiaRecebimentoConfig = async function () {
    const user = window.currentUser;
    if (!user) return;

    let diasRecebimento;
    if (cfgEstado.tipo === 'unico') {
      const dia = parseInt(document.getElementById('cfg-dia-unico')?.value, 10);
      if (!dia || dia < 1 || dia > 31) { cfgMsg('error', 'Informe o dia do recebimento (1 a 31).'); return; }
      diasRecebimento = [dia];
    } else {
      if (cfgEstado.diasMultiplos.length < 2) { cfgMsg('error', 'Adicione pelo menos 2 dias de recebimento.'); return; }
      diasRecebimento = cfgEstado.diasMultiplos.slice().sort((a, b) => a - b);
    }

    const btn = document.querySelector('#config-recebimento .config-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
      const { doc, updateDoc } = window.firebaseFns;
      await updateDoc(doc(window.firebaseDb, 'users', user.uid), { diasRecebimento });

      // Propaga imediatamente: qualquer função que leia
      // window.userProfile.diasRecebimento (Divisão, Salário, Dashboard,
      // Calendário) já passa a usar o novo valor no próximo render.
      window.userProfile = window.userProfile || {};
      window.userProfile.diasRecebimento = diasRecebimento;

      window.AppBus?.emit?.('perfil_usuario_changed');
      window.AppBus?.emit?.('salarios_changed');

      // Re-render direto das telas que dependem do dia de recebimento,
      // mesmo que não estejam com listener no AppBus.
      try { window.renderDashboard?.(); } catch (e) {}
      try { window.renderDivisaoMeses?.(); window.renderDivisao?.(); } catch (e) {}
      try { window.renderSalarios?.(); } catch (e) {}
      try { window.renderCalendario?.(); } catch (e) {}

      cfgMsg('success', '✅ Dia de recebimento atualizado! Já aplicado em todo o app.');
      window.showToast?.('✅ Dia de recebimento atualizado!');
    } catch (e) {
      console.error('[Fase5] erro ao salvar dia de recebimento', e);
      cfgMsg('error', 'Erro ao salvar: ' + (e.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Salvar dia de recebimento'; }
    }
  };

  /* ────────────────────────────────────────────────
     INICIALIZAÇÃO
     ──────────────────────────────────────────────── */
  function iniciar() {
    patchRenderConfiguracoes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  console.log('[Fase5] Alteração do dia de recebimento em Configurações ativa ✓');
})();

/* ===== [de /home/claude/work/app_patch_lembretes_entradas.js] ===== */
/* ============================================================
   FINANCESAPP — LEMBRETES DE ENTRADAS (Empreendedor/Autônomo)
   Usuários que escolheram o perfil "Empreendedor/Autônomo" no
   Wizard de cadastro informam se preferem lançar suas entradas
   diariamente, semanalmente (em um dia da semana) ou mensalmente
   (em um dia do mês). Esse arquivo:

   1) Verifica, a cada carregamento do app (e depois em intervalos),
      se hoje é um dia de lembrete de acordo com a frequência
      escolhida.
   2) Quando é, registra uma notificação em
      users/{uid}/notificacoes (persistida, para o usuário poder
      ver o histórico) e mostra um toast + notificação do
      navegador (se o usuário autorizar), lembrando de adicionar
      as entradas do período.
   3) Mostra um sino de notificações na topbar com contador de
      não lidas e uma lista simples para marcar como lida.

   OBS: como o app não tem um back-end/serviço rodando com a aba
   fechada, os lembretes acontecem enquanto o FinancesApp estiver
   aberto no navegador (ao carregar e a cada hora). Para lembretes
   mesmo de app fechado seria necessário Firebase Cloud Messaging
   + Cloud Functions — fora do escopo deste patch client-side.

   Carregue por último, depois de app_wizard_cadastro.js.
   ============================================================ */

(function () {
  'use strict';

  const DIAS_SEMANA_LABEL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  /* ────────────────────────────────────────────────
     HELPERS DE DATA
     ──────────────────────────────────────────────── */
  function hojeStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function ultimoDiaDoMesAtual() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }

  function chaveLocalHoje(uid) {
    return `fapp_lembrete_entrada_${uid}_${hojeStr()}`;
  }

  /* ────────────────────────────────────────────────
     A frequência escolhida manda hoje ser dia de lembrete?
     ──────────────────────────────────────────────── */
  function ehDiaDeLembrete(perfil) {
    if (!perfil || perfil.perfilFinanceiro !== 'autonomo' || !perfil.frequenciaEntradas) return false;

    if (perfil.frequenciaEntradas === 'diaria') return true;

    if (perfil.frequenciaEntradas === 'semanal') {
      const diaSemana = parseInt(perfil.diaSemanaEntradas, 10);
      if (Number.isNaN(diaSemana)) return false;
      return new Date().getDay() === diaSemana;
    }

    if (perfil.frequenciaEntradas === 'mensal') {
      const diaMes = parseInt(perfil.diaMesEntradas, 10);
      if (!diaMes) return false;
      const hoje = new Date().getDate();
      // Se o dia escolhido não existir no mês atual (ex: 31 em fevereiro),
      // usa o último dia do mês como equivalente.
      const diaAlvo = Math.min(diaMes, ultimoDiaDoMesAtual());
      return hoje === diaAlvo;
    }

    return false;
  }

  function mensagemLembrete(perfil) {
    if (perfil.frequenciaEntradas === 'semanal') {
      return `📥 Hoje é ${DIAS_SEMANA_LABEL[new Date().getDay()]}, seu dia de registrar as entradas da semana. Não esqueça de adicionar!`;
    }
    if (perfil.frequenciaEntradas === 'mensal') {
      return `📥 Hoje é o dia combinado para registrar suas entradas do mês. Não esqueça de adicionar!`;
    }
    return '📥 Não esqueça de registrar as entradas de hoje para manter seus dados financeiros atualizados.';
  }

  /* ────────────────────────────────────────────────
     PERSISTÊNCIA DA NOTIFICAÇÃO (users/{uid}/notificacoes)
     ──────────────────────────────────────────────── */
  async function registrarNotificacao(user, mensagem) {
    try {
      const { collection, addDoc } = window.firebaseFns;
      await addDoc(collection(window.firebaseDb, `users/${user.uid}/notificacoes`), {
        tipo: 'entrada_pendente',
        mensagem,
        lida: false,
        criadoEm: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[Lembretes] não foi possível registrar a notificação', e);
    }
  }

  function notificarNavegador(mensagem) {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      try { new Notification('FinancesApp', { body: mensagem, icon: 'assets/logo-financas-smart.jpg' }); } catch (e) {}
    }
  }

  async function checarLembreteHoje() {
    const user = window.currentUser;
    const perfil = window.userProfile;
    if (!user || !perfil) return;
    if (!ehDiaDeLembrete(perfil)) return;

    const chave = chaveLocalHoje(user.uid);
    if (localStorage.getItem(chave)) return; // já lembrado hoje nesta sessão/navegador
    localStorage.setItem(chave, '1');

    const mensagem = mensagemLembrete(perfil);
    window.showToast?.(mensagem);
    notificarNavegador(mensagem);
    await registrarNotificacao(user, mensagem);
    await atualizarSino();
  }

  /* ────────────────────────────────────────────────
     SINO DE NOTIFICAÇÕES NA TOPBAR
     ──────────────────────────────────────────────── */
  function garantirSino() {
    if (document.getElementById('lembretes-sino-btn')) return;
    const topbarRight = document.querySelector('.topbar-right');
    const btnAdd = document.querySelector('.btn-add');
    if (!topbarRight) return;

    const wrap = document.createElement('div');
    wrap.id = 'lembretes-sino-wrap';
    wrap.style.cssText = 'position:relative;display:none';
    wrap.innerHTML = `
      <button type="button" id="lembretes-sino-btn" aria-label="Notificações" style="
        display:flex;align-items:center;justify-content:center;
        width:38px;height:38px;border-radius:10px;border:1px solid var(--border);
        background:var(--bg3);color:var(--text2);cursor:pointer;position:relative;">
        <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
        <span id="lembretes-sino-badge" style="
          display:none;position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;
          border-radius:8px;background:var(--red);color:#fff;font-size:10px;font-weight:700;
          align-items:center;justify-content:center;padding:0 4px;line-height:16px;"></span>
      </button>
      <div id="lembretes-sino-dropdown" style="
        display:none;position:absolute;top:calc(100% + 8px);right:0;width:300px;max-height:360px;
        overflow-y:auto;background:var(--bg2);border:1px solid var(--border);border-radius:12px;
        box-shadow:0 12px 30px rgba(0,0,0,0.35);z-index:400;padding:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 6px 8px">
          <strong style="font-size:13px">Lembretes</strong>
          <button type="button" id="lembretes-marcar-todas" style="background:none;border:none;color:var(--accent);font-size:11.5px;cursor:pointer">Marcar todas como lidas</button>
        </div>
        <div id="lembretes-lista" style="display:flex;flex-direction:column;gap:6px"></div>
      </div>
    `;
    topbarRight.insertBefore(wrap, btnAdd || null);

    document.getElementById('lembretes-sino-btn').addEventListener('click', () => {
      const dd = document.getElementById('lembretes-sino-dropdown');
      if (!dd) return;
      const abrindo = dd.style.display === 'none';
      dd.style.display = abrindo ? 'block' : 'none';
      if (abrindo) carregarListaNotificacoes();
    });
    document.addEventListener('click', (e) => {
      const dd = document.getElementById('lembretes-sino-dropdown');
      const wrapEl = document.getElementById('lembretes-sino-wrap');
      if (!dd || dd.style.display === 'none') return;
      if (wrapEl && !wrapEl.contains(e.target)) dd.style.display = 'none';
    });
    document.getElementById('lembretes-marcar-todas').addEventListener('click', marcarTodasComoLidas);
  }

  async function atualizarSino() {
    const user = window.currentUser;
    const badge = document.getElementById('lembretes-sino-badge');
    const wrap = document.getElementById('lembretes-sino-wrap');
    if (!user || !badge || !wrap) return;

    // Só mostra o sino para quem tem lembretes configurados (Empreendedor/Autônomo
    // com frequência escolhida) — para os demais perfis, fica oculto.
    const perfil = window.userProfile;
    wrap.style.display = (perfil?.perfilFinanceiro === 'autonomo' && perfil?.frequenciaEntradas) ? 'flex' : 'none';

    try {
      const { collection, getDocs } = window.firebaseFns;
      const snap = await getDocs(collection(window.firebaseDb, `users/${user.uid}/notificacoes`));
      let naoLidas = 0;
      snap.forEach(d => { if (!d.data().lida) naoLidas++; });
      if (naoLidas > 0) {
        badge.style.display = 'flex';
        badge.textContent = naoLidas > 9 ? '9+' : String(naoLidas);
      } else {
        badge.style.display = 'none';
      }
    } catch (e) {
      // Silencioso: sino só deixa de mostrar contagem, não quebra o app
    }
  }

  async function carregarListaNotificacoes() {
    const user = window.currentUser;
    const lista = document.getElementById('lembretes-lista');
    if (!user || !lista) return;
    lista.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px">Carregando...</div>';

    try {
      const { collection, getDocs, doc, updateDoc } = window.firebaseFns;
      const snap = await getDocs(collection(window.firebaseDb, `users/${user.uid}/notificacoes`));
      const itens = [];
      snap.forEach(d => itens.push({ id: d.id, ...d.data() }));
      itens.sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));

      if (!itens.length) {
        lista.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px">Nenhum lembrete por enquanto.</div>';
        return;
      }

      lista.innerHTML = '';
      itens.slice(0, 20).forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = `
          display:flex;align-items:flex-start;gap:8px;padding:8px;border-radius:8px;
          background:${item.lida ? 'transparent' : 'var(--bg3)'};font-size:12.5px;color:var(--text2);
        `;
        const data = item.criadoEm ? new Date(item.criadoEm).toLocaleDateString('pt-BR') : '';
        row.innerHTML = `
          <div style="flex:1;line-height:1.4">
            <div>${item.mensagem || ''}</div>
            <div style="font-size:10.5px;color:var(--text3);margin-top:2px">${data}</div>
          </div>
          ${item.lida ? '' : '<button type="button" title="Marcar como lida" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:14px">✓</button>'}
        `;
        if (!item.lida) {
          row.querySelector('button')?.addEventListener('click', async () => {
            try {
              await updateDoc(doc(window.firebaseDb, `users/${user.uid}/notificacoes`, item.id), { lida: true });
              await carregarListaNotificacoes();
              await atualizarSino();
            } catch (e) {}
          });
        }
        lista.appendChild(row);
      });
    } catch (e) {
      lista.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px">Não foi possível carregar os lembretes.</div>';
    }
  }

  async function marcarTodasComoLidas() {
    const user = window.currentUser;
    if (!user) return;
    try {
      const { collection, getDocs, doc, updateDoc } = window.firebaseFns;
      const snap = await getDocs(collection(window.firebaseDb, `users/${user.uid}/notificacoes`));
      const pendentes = [];
      snap.forEach(d => { if (!d.data().lida) pendentes.push(d.id); });
      await Promise.all(pendentes.map(id => updateDoc(doc(window.firebaseDb, `users/${user.uid}/notificacoes`, id), { lida: true }).catch(() => {})));
      await carregarListaNotificacoes();
      await atualizarSino();
    } catch (e) {}
  }

  /* ────────────────────────────────────────────────
     INICIALIZAÇÃO
     ──────────────────────────────────────────────── */
  function aguardarPerfilEIniciar() {
    let tentativas = 0;
    const esperar = setInterval(() => {
      tentativas++;
      if (window.currentUser && window.userProfile) {
        clearInterval(esperar);
        garantirSino();
        atualizarSino();
        checarLembreteHoje();
        // Revisa a cada hora (cobre o caso de o app ficar aberto o dia todo
        // e a virada de dia/hora acontecer com a aba já carregada).
        setInterval(checarLembreteHoje, 60 * 60 * 1000);
      } else if (tentativas > 200) {
        clearInterval(esperar);
      }
    }, 300);
  }

  // Sempre que o perfil for (re)carregado (login, ou após salvar o Quiz),
  // reavalia o sino e o lembrete do dia.
  function ligarAppBus() {
    if (!window.AppBus?.on) { setTimeout(ligarAppBus, 300); return; }
    window.AppBus.on('perfil_usuario_changed', () => {
      garantirSino();
      atualizarSino();
      checarLembreteHoje();
    });
  }

  function iniciar() {
    aguardarPerfilEIniciar();
    ligarAppBus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  console.log('[Lembretes] Notificações automáticas de entradas (Empreendedor/Autônomo) ativas ✓');
})();
