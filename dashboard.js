/* ============================================================
   FINANCESAPP — dashboard.js
   Tela inicial: widgets, cards, indicadores, gráficos, resumos,
   insights e estatísticas.
   ============================================================ */


/* ===== [de /home/claude/work/dashboard_widgets.js] ===== */
﻿/* =============================================================
   FINANCESAPP — DASHBOARD PERSONALIZÁVEL v2
   dashboard_widgets.js — corrigido + insights criativos
   ============================================================= */

// ── DEFINIÇÃO DOS WIDGETS DISPONÍVEIS ──
const WIDGETS_DISPONIVEIS = [
  {
    id: 'grafico_mensal',
    nome: '📊 Gráfico Mensal',
    descricao: 'Evolução dos gastos nos últimos 6 meses',
    defaultAtivo: true,
    tamanho: 'half'
  },
  {
    id: 'categorias',
    nome: '🥧 Categorias',
    descricao: 'Distribuição de gastos por categoria (pizza)',
    defaultAtivo: true,
    tamanho: 'half'
  },
  {
    id: 'proximo_pagamento',
    nome: '📅 Próximo Pagamento',
    descricao: 'Contagem regressiva para os dias 15 e 30',
    defaultAtivo: true,
    tamanho: 'half'
  },
  {
    id: 'metas',
    nome: '🎯 Metas',
    descricao: 'Progresso das suas metas financeiras',
    defaultAtivo: true,
    tamanho: 'half'
  },
  {
    id: 'gastos_semana',
    nome: '📅 Gastos da Semana',
    descricao: 'O que você gastou nos últimos 7 dias',
    defaultAtivo: true,
    tamanho: 'half'
  },
  {
    id: 'saldo',
    nome: '💰 Saldo Detalhado',
    descricao: 'Explicação completa do seu saldo atual',
    defaultAtivo: true,
    tamanho: 'full'
  },
  {
    id: 'contas_futuras',
    nome: '🔮 Contas Futuras',
    descricao: 'Compras futuras pendentes de aprovação',
    defaultAtivo: true,
    tamanho: 'half'
  },
  {
    id: 'insights',
    nome: '💡 Insights',
    descricao: 'Alertas e dicas automáticas das suas finanças',
    defaultAtivo: true,
    tamanho: 'full'
  },
  {
    id: 'ciclo_financeiro',
    nome: '🔄 Ciclo Financeiro',
    descricao: 'Padrões de gasto ao longo do mês',
    defaultAtivo: false,
    tamanho: 'full'
  }
];

const WIDGETS_KEY = 'fapp_dashboard_widgets';

// ── CARREGAR PREFERÊNCIAS DO USUÁRIO ──
function carregarWidgetPrefs() {
  try {
    const raw = localStorage.getItem(WIDGETS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const prefs = {};
  WIDGETS_DISPONIVEIS.forEach(w => { prefs[w.id] = w.defaultAtivo; });
  return prefs;
}

function salvarWidgetPrefs(prefs) {
  localStorage.setItem(WIDGETS_KEY, JSON.stringify(prefs));
}

function isWidgetAtivo(id) {
  return carregarWidgetPrefs()[id] !== false;
}

// ── RENDERIZAR PAINEL DE CUSTOMIZAÇÃO ──
window.abrirCustomizarDashboard = function () {
  document.getElementById('customizar-dashboard-overlay')?.remove();
  const prefs = carregarWidgetPrefs();
  const overlay = document.createElement('div');
  overlay.id = 'customizar-dashboard-overlay';
  overlay.className = 'customizar-overlay';

  const cards = WIDGETS_DISPONIVEIS.map(w => `
    <label class="widget-toggle-card ${prefs[w.id] !== false ? 'ativo' : ''}" data-widget-id="${w.id}">
      <div class="widget-toggle-info">
        <div class="widget-toggle-nome">${w.nome}</div>
        <div class="widget-toggle-desc">${w.descricao}</div>
        <span class="widget-size-badge">${w.tamanho === 'full' ? 'Largura total' : 'Meia largura'}</span>
      </div>
      <div class="widget-toggle-switch ${prefs[w.id] !== false ? 'on' : ''}">
        <div class="widget-toggle-knob"></div>
      </div>
      <input type="checkbox" hidden ${prefs[w.id] !== false ? 'checked' : ''} name="${w.id}">
    </label>
  `).join('');

  overlay.innerHTML = `
    <div class="customizar-modal">
      <div class="customizar-header">
        <div>
          <h3>🎛️ Personalizar Dashboard</h3>
          <p>Escolha os widgets que deseja exibir</p>
        </div>
        <button type="button" class="customizar-close" onclick="document.getElementById('customizar-dashboard-overlay').remove()">✕</button>
      </div>
      <div class="customizar-body">
        <div class="widget-grid">${cards}</div>
      </div>
      <div class="customizar-footer">
        <button type="button" class="btn-secondary" onclick="resetarWidgets()">Restaurar padrão</button>
        <button type="button" class="btn-primary" style="width:auto;padding:12px 28px" onclick="salvarWidgetsEFechar()">Salvar e aplicar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  overlay.querySelectorAll('.widget-toggle-card').forEach(card => {
    card.addEventListener('click', () => {
      const sw = card.querySelector('.widget-toggle-switch');
      const cb = card.querySelector('input[type=checkbox]');
      setTimeout(() => {
        const isOn = cb.checked;
        sw.classList.toggle('on', isOn);
        card.classList.toggle('ativo', isOn);
      }, 0);
    });
  });

  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
};

window.resetarWidgets = function () {
  const prefs = {};
  WIDGETS_DISPONIVEIS.forEach(w => { prefs[w.id] = w.defaultAtivo; });
  salvarWidgetPrefs(prefs);
  document.getElementById('customizar-dashboard-overlay')?.remove();
  renderDashboard();
  showToast('✅ Dashboard restaurado ao padrão');
};

window.salvarWidgetsEFechar = function () {
  const overlay = document.getElementById('customizar-dashboard-overlay');
  if (!overlay) return;
  const prefs = {};
  overlay.querySelectorAll('.widget-toggle-card').forEach(card => {
    const id = card.dataset.widgetId;
    const cb = card.querySelector('input[type=checkbox]');
    prefs[id] = cb.checked;
  });
  salvarWidgetPrefs(prefs);
  overlay.remove();
  renderDashboard();
  showToast('✅ Dashboard personalizado!');
};

function renderWidgetProximoPagamento(container) {
  if (typeof calcularProximoPagamento !== 'function') {
    container.innerHTML = '<div class="widget-empty">Próximo pagamento indisponível.</div>';
    return;
  }
  const { diff, nomeData } = calcularProximoPagamento();
  let icon, cor, msg;
  if (diff === 0) {
    icon = '🔔'; cor = 'var(--accent)';
    msg = '<strong>Hoje é dia de pagamento!</strong> Confira suas baixas manuais.';
  } else if (diff === 1) {
    icon = '⚡'; cor = '#e8843a';
    msg = `<strong>Amanhã é dia de pagamento</strong> (${nomeData}).`;
  } else if (diff <= 5) {
    icon = '⏳'; cor = '#e8a83a';
    msg = `<strong>Faltam ${diff} dias</strong> para o próximo pagamento (${nomeData}).`;
  } else {
    icon = '📅'; cor = 'var(--blue)';
    msg = `<strong>Faltam ${diff} dias</strong> para o próximo pagamento (${nomeData}).`;
  }

  container.innerHTML = `
    <div class="pagamento-widget" style="border-left-color:${cor}">
      <div class="pagamento-widget-icon">${icon}</div>
      <div class="pagamento-widget-info">
        <div class="widget-title" style="color:${cor}">Próximo Pagamento</div>
        <div class="pagamento-widget-msg">${msg}</div>
      </div>
      <div class="pagamento-widget-count" style="border-color:${cor}44;background:${cor}22;color:${cor}">
        <strong>${diff === 0 ? 'Hoje' : diff}</strong>
        ${diff > 0 ? `<span>dia${diff !== 1 ? 's' : ''}</span>` : ''}
      </div>
    </div>
  `;
}
// ── RENDERIZAR WIDGET: GASTOS DA SEMANA ──
// Lê diretamente de window.gastos no momento do render (sempre sincronizado)
function renderWidgetGastosSemana(container) {
  const hoje = new Date();
  const semAgo = new Date(hoje);
  semAgo.setDate(hoje.getDate() - 6);
  const fmtDateLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const inicioStr = fmtDateLocal(semAgo);
  const fimStr = fmtDateLocal(hoje);

  // Sempre usa a referência mais recente de window.gastos
  const todosGastos = window.gastos || [];
  const gastosSemana = todosGastos.filter(g => {
    if (!g.data) return false;
    const d = g.data.slice(0,10);
    return d >= inicioStr && d <= fimStr &&
      g.categoria !== 'Compras parceladas' &&
      g.categoria !== 'Compras futuras';
  });

  const porDia = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - i);
    const key = fmtDateLocal(d);
    porDia[key] = 0;
  }
  gastosSemana.forEach(g => {
    const k = g.data.slice(0,10);
    if (porDia[k] !== undefined) porDia[k] += parseFloat(g.valor) || 0;
  });

  const dias = Object.entries(porDia);
  const maxVal = Math.max(...dias.map(([,v]) => v), 1);
  const totalSemana = dias.reduce((s,[,v]) => s + v, 0);

  const nomesDias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const barsHtml = dias.map(([data, val]) => {
    const d = new Date(data + 'T12:00:00');
    const pct = Math.round((val / maxVal) * 100);
    const nomeDia = nomesDias[d.getDay()];
    const diaNum = d.getDate();
    const ehHoje = data === fmtDateLocal(hoje);
    return `
      <div class="semana-bar-col">
        <div class="semana-bar-wrap">
          <div class="semana-bar-fill ${ehHoje ? 'hoje' : ''}" style="height:0%" data-h="${pct}%"></div>
        </div>
        <div class="semana-bar-val">${val > 0 ? 'R$ ' + val.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0}) : ''}</div>
        <div class="semana-bar-label ${ehHoje ? 'hoje' : ''}">${nomeDia}<br><span>${diaNum}</span></div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="widget-header">
      <div class="widget-title">📅 Gastos da Semana</div>
      <div class="widget-total">${typeof fmtR === 'function' ? fmtR(totalSemana) : 'R$ ' + totalSemana.toFixed(2)}</div>
    </div>
    <div class="semana-bars">${barsHtml}</div>
    <div class="semana-resumo">
      <span>${gastosSemana.length} lançamento${gastosSemana.length !== 1 ? 's' : ''} nos últimos 7 dias</span>
    </div>
  `;

  setTimeout(() => {
    container.querySelectorAll('.semana-bar-fill[data-h]').forEach(b => {
      b.style.height = b.dataset.h;
    });
  }, 80);
}

// ── RENDERIZAR WIDGET: METAS RESUMO ──
// Filtra window.metas no momento do render — reflete exclusões imediatamente
function renderWidgetMetas(container) {
  // Força leitura atualizada: usa window.metas diretamente
  const metasAtivas = (window.metas || []).filter(m => !m.concluida);

  if (!metasAtivas.length) {
    container.innerHTML = `
      <div class="widget-header"><div class="widget-title">🎯 Metas</div></div>
      <div class="widget-empty">Nenhuma meta cadastrada.<br><button class="widget-link-btn" onclick="switchTab('metas')">Criar meta →</button></div>
    `;
    return;
  }

  const metasHtml = metasAtivas.slice(0, 3).map(m => {
    const atual = parseFloat(m.valorAtual || m.atual) || 0;
    const alvo  = parseFloat(m.valorAlvo  || m.objetivo) || 1;
    const pct   = Math.min(Math.round((atual / alvo) * 100), 100);
    const corBarra = pct >= 100 ? 'var(--green)' : pct >= 60 ? 'var(--accent)' : 'var(--blue)';
    return `
      <div class="meta-widget-item">
        <div class="meta-widget-info">
          <span class="meta-widget-nome">${typeof escHtml === 'function' ? escHtml(m.nome) : m.nome}</span>
          <span class="meta-widget-pct">${pct}%</span>
        </div>
        <div class="meta-widget-bar-bg">
          <div class="meta-widget-bar-fill" style="width:0%;background:${corBarra}" data-w="${pct}%"></div>
        </div>
        <div class="meta-widget-vals">
          <span>${typeof fmtR === 'function' ? fmtR(atual) : 'R$ '+atual.toFixed(2)}</span>
          <span style="color:var(--text3)">de ${typeof fmtR === 'function' ? fmtR(alvo) : 'R$ '+alvo.toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="widget-header">
      <div class="widget-title">🎯 Metas</div>
      <button class="widget-link-btn" onclick="switchTab('metas')">Ver todas →</button>
    </div>
    <div class="metas-widget-list">${metasHtml}</div>
  `;

  setTimeout(() => {
    container.querySelectorAll('.meta-widget-bar-fill[data-w]').forEach(b => {
      b.style.width = b.dataset.w;
    });
  }, 80);
}

// ── RENDERIZAR WIDGET: CONTAS FUTURAS ──
function renderWidgetContasFuturas(container) {
  const futuras = (window.gastos || [])
    .filter(g => g.categoria === 'Compras futuras' && !g.statusFutura)
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''))
    .slice(0, 5);

  if (!futuras.length) {
    container.innerHTML = `
      <div class="widget-header"><div class="widget-title">🔮 Contas Futuras</div></div>
      <div class="widget-empty">Sem compras futuras pendentes.<br><button class="widget-link-btn" onclick="switchTab('gastos')">Adicionar →</button></div>
    `;
    return;
  }

  const totalFuturas = futuras.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);

  const itensHtml = futuras.map(g => `
    <div class="futura-widget-item" onclick="switchTab('gastos'); setTimeout(()=>switchGastosSubtab('pendentes'),100)">
      <div class="futura-widget-icon">🔮</div>
      <div class="futura-widget-info">
        <div class="futura-widget-nome">${typeof escHtml === 'function' ? escHtml(g.loja) : g.loja}</div>
        <div class="futura-widget-data">Vence ${typeof formatData === 'function' ? formatData(g.data) : g.data}</div>
      </div>
      <div class="futura-widget-valor">${typeof fmtR === 'function' ? fmtR(g.valor) : 'R$ '+parseFloat(g.valor).toFixed(2)}</div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="widget-header">
      <div class="widget-title">🔮 Contas Futuras</div>
      <div class="widget-total">${typeof fmtR === 'function' ? fmtR(totalFuturas) : 'R$ '+totalFuturas.toFixed(2)}</div>
    </div>
    <div class="futuras-widget-list">${itensHtml}</div>
    ${futuras.length >= 5 ? `<button class="widget-link-btn" style="margin-top:8px;display:block;text-align:center;width:100%" onclick="switchTab('gastos');setTimeout(()=>switchGastosSubtab('pendentes'),100)">Ver todas →</button>` : ''}
  `;
}

// ── INSIGHTS CRIATIVOS ──
// Substitui a função renderInsights do app.js por uma versão mais rica e criativa
window._renderInsightsCriativo = function(gastosDoMes, gastosAnt, saldo) {
  const el = document.getElementById('insights-box-widget') || document.getElementById('insights-box');
  if (!el) return;

  const insights = [];
  const cats = ['Alimentação', 'Lazer', 'Auto-cuidado', 'Transporte', 'Jogos', 'Roupas e calçados', 'Compras parceladas', 'Compras recorrentes'];

  // Insights de variação por categoria (mais criativos)
  const frasesSobindo = [
    (cat, pct) => `🔥 ${cat} explodiu ${pct}% esse mês. Tá pegando fogo, hein?`,
    (cat, pct) => `📈 Seus gastos com ${cat} subiram ${pct}% — hora de dar uma freada.`,
    (cat, pct) => `⚠️ ${cat} subiu ${pct}% em relação ao mês passado. Ficou caro ser você!`,
    (cat, pct) => `🤔 ${cat} +${pct}%? Dá pra cortar um pouquinho aí.`,
  ];
  const frasesDescendo = [
    (cat, pct) => `🎉 Uau! ${cat} caiu ${pct}% esse mês. Economista do ano!`,
    (cat, pct) => `💚 ${cat} caiu ${pct}% — você tá no caminho certo, parabéns!`,
    (cat, pct) => `🥳 ${pct}% a menos em ${cat}. Continua assim e seu futuro agradece!`,
    (cat, pct) => `✨ ${cat} encolheu ${pct}% — pequena vitória, grande orgulho.`,
  ];

  cats.forEach(cat => {
    const agora = gastosDoMes.filter(g => g.categoria === cat).reduce((s, g) => s + g.valor, 0);
    const antes = gastosAnt.filter(g => g.categoria === cat).reduce((s, g) => s + g.valor, 0);
    if (agora > 0 && antes > 0) {
      const pct = ((agora - antes) / antes) * 100;
      if (pct > 25) {
        const fn = frasesSobindo[Math.floor(Math.random() * frasesSobindo.length)];
        insights.push({ tipo: 'warn', texto: fn(cat, pct.toFixed(0)) });
      }
      if (pct < -25) {
        const fn = frasesDescendo[Math.floor(Math.random() * frasesDescendo.length)];
        insights.push({ tipo: 'ok', texto: fn(cat, Math.abs(pct).toFixed(0)) });
      }
    }
    if (agora > 0 && antes === 0) {
      if (cat === 'Lazer' && agora > 200) {
        const fmtV = typeof fmtR === 'function' ? fmtR(agora) : 'R$ '+agora.toFixed(2);
        const opcs = [
          `🎮 ${fmtV} em Lazer esse mês — divertido, mas caro! Fica de olho.`,
          `🎪 Lazer em alta: ${fmtV} gastos. Curtir a vida é bom, mas o bolso sente.`,
          `🎯 ${fmtV} com Lazer — novo mês, nova oportunidade de equilibrar.`,
        ];
        insights.push({ tipo: 'warn', texto: opcs[Math.floor(Math.random() * opcs.length)] });
      }
    }
  });

  // Saldo caindo há 3 meses
  if (typeof getLast6Months === 'function' && typeof salarios !== 'undefined') {
    const ultMeses = getLast6Months();
    const saldosMeses = ultMeses.map(m => {
      const sal = salarios.find(s => s.mes === m);
      const renda = typeof rendaTotalMes === 'function' ? rendaTotalMes(sal) : 0;
      const gast = typeof totalGastosMes === 'function' ? totalGastosMes(m) : 0;
      return renda - gast;
    });
    const quant = saldosMeses.length;
    if (quant >= 3 && saldosMeses[quant-1] < saldosMeses[quant-2] && saldosMeses[quant-2] < saldosMeses[quant-3]) {
      const opcs = [
        '📉 Saldo caindo há 3 meses seguidos. Hora de uma revisão geral nos gastos!',
        '🚨 3 meses no vermelho tendencial. Bora sentar e rever o orçamento?',
        '⚠️ Tendência de queda por 3 meses. Pequenos ajustes agora evitam problemas maiores.',
      ];
      insights.push({ tipo: 'danger', texto: opcs[Math.floor(Math.random() * opcs.length)] });
    }
  }

  // Saldo negativo
  if (saldo < 0) {
    const opcs = [
      `🚨 Saldo negativo esse mês! Hora de apertar os cintos.`,
      `🔴 Você está no vermelho! Revise os gastos antes que piore.`,
      `💸 Saldo no negativo — é hora de olhar item por item e cortar o desnecessário.`,
    ];
    insights.push({ tipo: 'danger', texto: opcs[Math.floor(Math.random() * opcs.length)] });
  }

  // Parcelas altas
  const totalParc = gastosDoMes.filter(g => g.categoria === 'Compras parceladas').reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
  const rendaMes = typeof rendaDashboardMes === 'function' ? rendaDashboardMes(new Date().toISOString().slice(0,7)) : 0;
  if (rendaMes > 0 && totalParc / rendaMes > 0.3) {
    const pctParc = ((totalParc / rendaMes) * 100).toFixed(0);
    const opcs = [
      `💳 ${pctParc}% da sua renda vai pra parcelas. O cartão tá mandando em você.`,
      `😬 Parcelas comendo ${pctParc}% da renda — cuidado pra não apertar no fim do mês.`,
      `🏦 ${pctParc}% comprometido com parcelas. Antes de parcelar de novo, pense bem!`,
    ];
    insights.push({ tipo: 'warn', texto: opcs[Math.floor(Math.random() * opcs.length)] });
  }

  // Insights positivos extras (aparece se tiver saldo positivo e sem outros alertas)
  if (saldo > 0 && insights.filter(i => i.tipo !== 'ok').length === 0) {
    const diasDoMes = new Date().getDate();
    const metasMes = window.metas ? window.metas.filter(m => !m.concluida).length : 0;
    const opcsOk = [
      '🌟 Mês tranquilo até agora. Continue assim e você vai fechar no azul!',
      '✅ Finanças equilibradas. Que tal destinar um pouco para alguma meta?',
      '💪 Sem alertas por aqui! Você está controlando bem seu dinheiro.',
      `📅 Dia ${diasDoMes} do mês e tudo sob controle. Bom ritmo!`,
    ];
    if (metasMes > 0) opcsOk.push(`🎯 Você tem ${metasMes} meta${metasMes > 1 ? 's' : ''} ativa${metasMes > 1 ? 's' : ''} — continua focado!`);
    insights.push({ tipo: 'ok', texto: opcsOk[Math.floor(Math.random() * opcsOk.length)] });
  }

  if (!insights.length) {
    insights.push({ tipo: 'ok', texto: '✅ Suas finanças estão equilibradas este mês. Continue assim!' });
  }

  const insightsHtml = insights.map(i => `
    <div class="insight-chip insight-${i.tipo}">${i.texto}</div>
  `).join('');
  window._lastInsightsHtml = insightsHtml;
  el.innerHTML = insightsHtml;
  const legacySlot = document.getElementById('insights-box');
  if (legacySlot && legacySlot !== el) legacySlot.innerHTML = insightsHtml;
};

// Sobrescreve a função renderInsights do app.js assim que estiver disponível
(function patchInsights() {
  function tentar() {
    if (typeof window.renderInsights !== 'function') { setTimeout(tentar, 300); return; }
    window.renderInsights = window._renderInsightsCriativo;
  }
  tentar();
})();

// ── INJETAR WIDGETS NO DASHBOARD ──
// Sempre recria os widgets a partir das referências atuais de window.gastos / window.metas
window.renderDashboardWidgets = function() {
  const prefs = carregarWidgetPrefs();
  const dashContainer = document.getElementById('dashboard-widgets-area');
  if (!dashContainer) return;

  dashContainer.innerHTML = '';

  // Widget: Insights
  if (prefs['insights'] !== false) {
    const w = criarWidgetEl('insights', 'full');
    const box = w.querySelector('.widget-content');
    box.innerHTML = '<div id="insights-box-widget" class="insights-box"></div>';
    dashContainer.appendChild(w);
    const proxyBox = w.querySelector('#insights-box-widget');
    if (proxyBox && window._lastInsightsHtml) proxyBox.innerHTML = window._lastInsightsHtml;
  }

  // Widget: Saldo detalhado
  if (prefs['saldo'] !== false) {
    const w = criarWidgetEl('saldo', 'full');
    const box = w.querySelector('.widget-content');
    box.innerHTML = '<div id="explicador-saldo-widget"></div>';
    dashContainer.appendChild(w);
  }

  // Half widgets
  const halfWidgets = [];

  if (prefs['grafico_mensal'] !== false) {
    halfWidgets.push({
      id: 'grafico_mensal',
      html: `
        <div class="widget-header"><div class="widget-title">📊 Evolução Mensal</div></div>
        <canvas id="chartBarra" style="max-height:200px"></canvas>
      `
    });
  }

  if (prefs['categorias'] !== false) {
    halfWidgets.push({
      id: 'categorias',
      html: `
        <div class="widget-header"><div class="widget-title">🥧 Categorias</div></div>
        <canvas id="chartPizza" style="max-height:200px"></canvas>
      `
    });
  }
  if (prefs['proximo_pagamento'] !== false) {
    halfWidgets.push({
      id: 'proximo_pagamento',
      render: (el) => renderWidgetProximoPagamento(el)
    });
  }
  // Widget Metas — sempre re-renderiza com dados atuais
  if (prefs['metas'] !== false) {
    halfWidgets.push({
      id: 'metas',
      render: (el) => renderWidgetMetas(el)
    });
  }

  // Widget Gastos Semana — sempre re-renderiza com dados atuais
  if (prefs['gastos_semana'] !== false) {
    halfWidgets.push({
      id: 'gastos_semana',
      render: (el) => renderWidgetGastosSemana(el)
    });
  }

  // Widget Contas Futuras — sempre re-renderiza com dados atuais
  if (prefs['contas_futuras'] !== false) {
    halfWidgets.push({
      id: 'contas_futuras',
      render: (el) => renderWidgetContasFuturas(el)
    });
  }

  if (halfWidgets.length) {
    const grid = document.createElement('div');
    grid.className = 'widgets-half-grid';
    halfWidgets.forEach(wDef => {
      const w = criarWidgetEl(wDef.id, 'half');
      const box = w.querySelector('.widget-content');
      if (wDef.html) box.innerHTML = wDef.html;
      if (wDef.render) wDef.render(box);
      grid.appendChild(w);
    });
    dashContainer.appendChild(grid);
  }

  if (prefs['ciclo_financeiro'] !== false) {
    const w = criarWidgetEl('ciclo_financeiro', 'full');
    const box = w.querySelector('.widget-content');
    box.innerHTML = '<div id="ciclo-financeiro-widget"></div>';
    dashContainer.appendChild(w);
  }
};

function criarWidgetEl(id, tamanho) {
  const div = document.createElement('div');
  div.className = `widget-modular widget-${tamanho}`;
  div.dataset.widgetId = id;
  div.innerHTML = `<div class="widget-content"></div>`;
  return div;
}

window.injetarBotaoCustomizar = function() {
  if (document.getElementById('btn-customizar-dashboard')) return;
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'btn-customizar-dashboard';
  btn.className = 'btn-customizar-dash';
  btn.title = 'Personalizar dashboard';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:currentColor"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>
    Widgets
  `;
  btn.onclick = window.abrirCustomizarDashboard;
  topbarRight.insertBefore(btn, topbarRight.firstChild);
};

/* ===== [de app.js] app.js ===== */
let chartPizza  = null;
let chartBarra  = null;
function verificarResumoMes() {
  const hoje = new Date();
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  // Mostra resumo se for o último dia do mês
  if (hoje.getDate() === ultimoDiaMes) {
    setTimeout(() => mostrarResumoMes(), 1500);
  }
}

function mostrarResumoMes(mesForcar) {
  const mes = mesForcar || new Date().toISOString().slice(0, 7);
  const gastosDoMes = gastosResumoMes(mes);
  if (!gastosDoMes.length) return;

  const salObj  = salarios.find(s => s.mes === mes);
  const renda   = rendaTotalMes(salObj, mes);
  const total   = gastosDoMes.reduce((s, g) => s + g.valor, 0);
  const saldo   = renda - total;

  // Maior categoria
  const cats = ['Alimentação', 'Compras parceladas', 'Compras recorrentes', 'Roupas e calçados', 'Lazer', 'Auto-cuidado', 'Transporte'];
  let maiorCat = '', maiorVal = 0;
  cats.forEach(c => {
    const v = gastosDoMes.filter(g => g.categoria === c).reduce((s, g) => s + g.valor, 0);
    if (v > maiorVal) { maiorVal = v; maiorCat = c; }
  });

  // Dia mais caro
  const porDia = {};
  gastosDoMes.forEach(g => {
    porDia[g.data] = (porDia[g.data] || 0) + g.valor;
  });
  let diaMaisCaro = '', diaVal = 0;
  Object.entries(porDia).forEach(([d, v]) => {
    if (v > diaVal) { diaVal = v; diaMaisCaro = d; }
  });

  const [y, m] = mes.split('-');
  const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const nomeMes = nomesMes[parseInt(m) - 1];

  const overlay = document.createElement('div');
  overlay.className = 'resumo-mes-overlay';
  overlay.innerHTML = `
    <div class="resumo-mes-modal">
      <div class="resumo-mes-confete" id="resumo-confete"></div>
      <div class="resumo-mes-header">
        <div class="resumo-mes-icon">📊</div>
        <h2>Resumo de ${nomeMes} ${y}</h2>
        <p>Seu mês financeiro em detalhes</p>
      </div>
      <div class="resumo-mes-cards">
        <div class="resumo-stat ${saldo >= 0 ? 'resumo-stat-green' : 'resumo-stat-red'}">
          <span class="resumo-stat-label">${saldo >= 0 ? '💰 Você economizou' : '⚠️ Déficit'}</span>
          <span class="resumo-stat-val">${fmtR(Math.abs(saldo))}</span>
        </div>
        <div class="resumo-stat resumo-stat-yellow">
          <span class="resumo-stat-label">📦 Total de gastos</span>
          <span class="resumo-stat-val">${fmtR(total)}</span>
        </div>
        ${maiorCat ? `<div class="resumo-stat resumo-stat-blue">
          <span class="resumo-stat-label">🏆 Maior categoria</span>
          <span class="resumo-stat-val">${maiorCat}</span>
          <span class="resumo-stat-sub">${fmtR(maiorVal)}</span>
        </div>` : ''}
        ${diaMaisCaro ? `<div class="resumo-stat resumo-stat-purple">
          <span class="resumo-stat-label">📅 Dia mais caro</span>
          <span class="resumo-stat-val">${formatData(diaMaisCaro)}</span>
          <span class="resumo-stat-sub">${fmtR(diaVal)}</span>
        </div>` : ''}
        <div class="resumo-stat resumo-stat-neutral">
          <span class="resumo-stat-label">🧾 Qtd. lançamentos</span>
          <span class="resumo-stat-val">${gastosDoMes.length}</span>
        </div>
        <div class="resumo-stat resumo-stat-neutral">
          <span class="resumo-stat-label">📈 Renda total</span>
          <span class="resumo-stat-val">${fmtR(renda)}</span>
        </div>
      </div>
      <button class="resumo-mes-fechar" onclick="this.closest('.resumo-mes-overlay').remove()">
        Fechar resumo
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  // Confete se economizou
  if (saldo > 0) dispararConfete(overlay.querySelector('#resumo-confete'));
}

function dispararConfete(container) {
  const cores = ['#f0c040','#3dd68c','#4d9de0','#e8843a','#9b72e8','#e05454'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'confete-particula';
    p.style.cssText = `
      left:${Math.random()*100}%;
      background:${cores[Math.floor(Math.random()*cores.length)]};
      animation-delay:${Math.random()*1.5}s;
      animation-duration:${1.5 + Math.random()}s;
      width:${6 + Math.random()*6}px;
      height:${6 + Math.random()*6}px;
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    container.appendChild(p);
  }
}

// ============ NAVEGAÇÃO ============
function renderDashboard() {
  const mes         = new Date().toISOString().slice(0, 7);
  const mesAnterior = getPreviousMonth(mes);
  const cicloAtual  = cicloFinanceiroPorData();
  const cicloAnt    = cicloFinanceiroAnterior(cicloAtual);
  const gastosDoMes = gastosResumoMes(mes);
  const gastosAnt   = gastosResumoMes(mesAnterior);
  const totalGastos = totalGastosDashboardPeriodo(cicloAtual.inicio, cicloAtual.fim);
  const totalAnt    = totalGastosDashboardPeriodo(cicloAnt.inicio, cicloAnt.fim);
  const salObj      = salarioPorMes(mes) || salarioMaisRecenteAte(mes);
  const renda       = rendaTotalMes(salObj, mes);
  const saldo       = renda - totalGastos;
  const parcelaMensal = saldo > 0 ? saldo / 2 : 0;
  const rendaHint = document.getElementById('card-renda-hint');
  if (rendaHint) {
    rendaHint.textContent = salObj
      ? `Base ${formatMes(salObj.mes)}: salários + extras`
      : `Sem salário lançado ainda`;
  }

  let varPct = 0;
  if (totalAnt > 0) varPct = ((totalGastos - totalAnt) / totalAnt) * 100;
  const varSinal = varPct >= 0 ? '+' : '';
  const varCor   = varPct > 0 ? 'var(--red)' : 'var(--green)';
  const varEl    = document.getElementById('card-gastos-var');
  if (varEl) {
    varEl.textContent = `${formatData(formatDateInputLocal(cicloAtual.inicio))} a ${formatData(formatDateInputLocal(cicloAtual.fim))} • ${varSinal}${varPct.toFixed(1)}% vs ciclo anterior`;
    varEl.style.color = varCor;
  }

  animateValue('card-renda',   renda);
  animateValue('card-gastos',  totalGastos);
  animateValue('card-saldo',   saldo);
  animateValue('card-parcela', parcelaMensal);

  // ── SISTEMA DE WIDGETS PERSONALIZÁVEIS ──
  if (window.renderDashboardWidgets) {
    window.renderDashboardWidgets();
    // Injeta botão de customizar
    if (window.injetarBotaoCustomizar) window.injetarBotaoCustomizar();
    // Renderiza conteúdos nos slots dos widgets
    setTimeout(() => {
      const pizzaEl = document.getElementById('chartPizza');
      if (pizzaEl) renderChartPizza(gastosDoMes);
      const barraEl = document.getElementById('chartBarra');
      if (barraEl) renderChartBarra();

      const insightsWidget = document.getElementById('insights-box-widget');
      const insightsLegacy = document.getElementById('insights-box');
      const _targetInsights = insightsWidget || insightsLegacy;
      if (_targetInsights) renderInsights(gastosDoMes, gastosAnt, saldo);

      const saldoWidget = document.getElementById('explicador-saldo-widget');
      const saldoLegacy = document.getElementById('explicador-saldo');
      const _targetSaldo = saldoWidget || saldoLegacy;
      if (_targetSaldo) {
        renderExplicadorSaldo(gastosDoMes, gastosAnt, saldo, renda, totalGastos);
      }

      const cicloWidget = document.getElementById('ciclo-financeiro-widget');
      const cicloLegacy = document.getElementById('ciclo-financeiro');
      if (cicloWidget || cicloLegacy) renderCicloFinanceiro();
    }, 50);
  } else {
    // Fallback sem sistema de widgets
    renderChartPizza(gastosDoMes);
    renderChartBarra();
    renderInsights(gastosDoMes, gastosAnt, saldo);
    renderExplicadorSaldo(gastosDoMes, gastosAnt, saldo, renda, totalGastos);
    renderCicloFinanceiro();
  }
}

function getPreviousMonth(mesStr) {
  const [y, m] = mesStr.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return d.toISOString().slice(0, 7);
}

// ============ EXPLICADOR DE SALDO ============
function renderExplicadorSaldo(gastosDoMes, gastosAnt, saldo, renda, totalGastosDashboard) {
  const el = document.getElementById('explicador-saldo-widget') || document.getElementById('explicador-saldo');
  if (!el) return;

  const cats = ['Alimentação', 'Compras parceladas', 'Compras recorrentes', 'Roupas e calçados', 'Lazer', 'Auto-cuidado', 'Transporte'];
  const mudancas = [];

  cats.forEach(cat => {
    const agora = gastosDoMes.filter(g => g.categoria === cat).reduce((s, g) => s + g.valor, 0);
    const antes = gastosAnt.filter(g => g.categoria === cat).reduce((s, g) => s + g.valor, 0);
    const delta = agora - antes;
    if (Math.abs(delta) > 10) {
      mudancas.push({ cat, agora, antes, delta });
    }
  });

  mudancas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const totalGastos = totalGastosDashboard ?? gastosDoMes.reduce((s, g) => s + g.valor, 0);

  let html = `
    <div class="explicador-header">
      <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:var(--blue)"><path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>
      Explicação do saldo
    </div>
    <div class="explicador-saldo-resumo">
      <div class="explicador-saldo-val ${saldo >= 0 ? 'pos' : 'neg'}">${fmtR(saldo)}</div>
      <div class="explicador-saldo-label">Renda ${fmtR(renda)} − Gastos ${fmtR(totalGastos)}</div>
    </div>
  `;

  if (mudancas.length > 0) {
    html += `<div class="explicador-sub">Por que seu saldo ${saldo >= 0 ? 'está positivo' : 'mudou'} este mês:</div>`;
    html += mudancas.slice(0, 4).map(m => {
      const sinal = m.delta > 0 ? '+' : '';
      const cor   = m.delta > 0 ? 'var(--red)' : 'var(--green)';
      const icon  = m.delta > 0 ? '📈' : '📉';
      const pct   = m.antes > 0 ? ` (${m.delta > 0 ? '+' : ''}${((m.delta/m.antes)*100).toFixed(0)}%)` : '';
      return `
        <div class="explicador-linha">
          <span>${icon} ${m.cat}</span>
          <span style="color:${cor};font-weight:600">${sinal}${fmtR(m.delta)}${pct}</span>
        </div>
      `;
    }).join('');
  } else {
    html += `<div class="explicador-sub" style="padding:8px 0;color:var(--text3)">Sem variações significativas vs mês anterior.</div>`;
  }

  el.innerHTML = html;
}

// ============ CICLO FINANCEIRO AUTOMÁTICO ============
function renderCicloFinanceiro() {
  const el = document.getElementById('ciclo-financeiro-widget') || document.getElementById('ciclo-financeiro');
  if (!el) return;

  // Analisa últimos 3 meses
  const meses = getLast6Months();
  const hoje  = new Date();

  // 1. Dias mais caros (agrupa todos os gastos por dia-do-mês)
  const porDiaMes = {}; // { 1: total, 2: total, ... }
  meses.forEach(mes => {
    gastos.filter(g => g.data.startsWith(mes)).forEach(g => {
      const dia = parseInt(g.data.split('-')[2]);
      porDiaMes[dia] = (porDiaMes[dia] || 0) + g.valor;
    });
  });

  // Top 3 dias mais caros
  const diasOrdenados = Object.entries(porDiaMes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([dia, val]) => ({ dia: parseInt(dia), val }));

  // 2. Semanas críticas (agrupa por semana 1-4)
  const porSemana = { 1: 0, 2: 0, 3: 0, 4: 0 };
  meses.forEach(mes => {
    gastos.filter(g => g.data.startsWith(mes)).forEach(g => {
      const dia    = parseInt(g.data.split('-')[2]);
      const semana = Math.min(Math.ceil(dia / 7), 4);
      porSemana[semana] += g.valor;
    });
  });
  const semanaMaisGastada = Object.entries(porSemana).sort((a, b) => b[1] - a[1])[0];

  // 3. Detecção saldo negativo recorrente em dias específicos
  const alertasDias = [];
  // Checa se fim de mês (dias 25-31) tende a ser problemático
  const mesAtual = new Date().toISOString().slice(0, 7);
  const saldosMeses = meses.map(m => {
    const sal   = salarios.find(s => s.mes === m);
    const renda = rendaTotalMes(sal, m);
    const gast  = totalGastosMes(m);
    return { mes: m, saldo: renda - gast };
  });

  // Verifica negatividade nos 3 últimos meses
  const negativos = saldosMeses.filter(s => s.saldo < 0).length;

  let html = `
    <div class="ciclo-header">
      <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:var(--purple)"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
      Ciclo Financeiro — Padrões Detectados
    </div>
    <div class="ciclo-grid">
  `;

  // Card dias mais caros
  if (diasOrdenados.length) {
    html += `
      <div class="ciclo-card">
        <div class="ciclo-card-titulo">📅 Dias que você mais gasta</div>
        ${diasOrdenados.map((d, i) => `
          <div class="ciclo-bar-row">
            <span class="ciclo-dia-num">Dia ${d.dia}</span>
            <div class="ciclo-bar-bg">
              <div class="ciclo-bar-fill" style="width:0%;background:${i===0?'var(--red)':i===1?'var(--accent)':'var(--blue)'}" data-w="${Math.round((d.val/diasOrdenados[0].val)*100)}"></div>
            </div>
            <span class="ciclo-dia-val">${fmtR(d.val)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Card semanas
  const semLabels = ['1ª sem (1–7)', '2ª sem (8–14)', '3ª sem (15–21)', '4ª sem (22–31)'];
  const semMax    = Math.max(...Object.values(porSemana));
  html += `
    <div class="ciclo-card">
      <div class="ciclo-card-titulo">📆 Gasto por semana do mês</div>
      ${Object.entries(porSemana).map(([sem, val]) => `
        <div class="ciclo-bar-row">
          <span class="ciclo-dia-num" style="min-width:100px;font-size:11px">${semLabels[parseInt(sem)-1]}</span>
          <div class="ciclo-bar-bg">
            <div class="ciclo-bar-fill" style="width:0%;background:${parseInt(sem)===parseInt(semanaMaisGastada[0])?'var(--red)':'var(--accent)'}" data-w="${semMax > 0 ? Math.round((val/semMax)*100) : 0}"></div>
          </div>
          <span class="ciclo-dia-val">${fmtR(val)}</span>
        </div>
      `).join('')}
    </div>
  `;

  // Alertas de padrão
  const alertas = [];
  if (negativos >= 2) alertas.push({ tipo: 'danger', texto: `Você ficou no negativo em ${negativos} dos últimos ${meses.length} meses — padrão de déficit recorrente 🚨` });
  if (semanaMaisGastada && parseInt(semanaMaisGastada[0]) >= 4) alertas.push({ tipo: 'warn', texto: `Sua semana mais cara costuma ser a última do mês (dias 22–31) — planeje reservas 📋` });
  if (diasOrdenados[0]?.dia >= 25) alertas.push({ tipo: 'warn', texto: `Você sempre gasta mais no dia ${diasOrdenados[0].dia} — fique de olho no fim do mês 👀` });
  if (diasOrdenados[0]?.dia <= 5) alertas.push({ tipo: 'ok', texto: `Você concentra gastos no começo do mês — seu saldo costuma ser melhor no fim 🎯` });

  if (alertas.length) {
    html += `<div class="ciclo-card ciclo-card-alertas" style="grid-column:1/-1">
      <div class="ciclo-card-titulo">🔍 Padrões identificados</div>
      ${alertas.map(a => `<div class="insight-chip insight-${a.tipo}" style="margin-bottom:6px">${a.texto}</div>`).join('')}
    </div>`;
  }

  html += '</div>';
  el.innerHTML = html;

  // Anima barras
  setTimeout(() => {
    el.querySelectorAll('.ciclo-bar-fill[data-w]').forEach(b => {
      b.style.width = b.dataset.w + '%';
    });
  }, 80);
}

// ============ INSIGHTS ============
function renderInsights(gastosDoMes, gastosAnt, saldo) {
  // Suporta tanto o slot legado (#insights-box) quanto o slot do widget (#insights-box-widget)
  const el = document.getElementById('insights-box-widget') || document.getElementById('insights-box');
  if (!el) return;

  const insights = [];
  const cats = ['Alimentação', 'Lazer', 'Auto-cuidado', 'Transporte', 'Roupas e calçados', 'Compras parceladas', 'Compras recorrentes'];

  cats.forEach(cat => {
    const agora = gastosDoMes.filter(g => g.categoria === cat).reduce((s, g) => s + g.valor, 0);
    const antes = gastosAnt.filter(g => g.categoria === cat).reduce((s, g) => s + g.valor, 0);
    if (agora > 0 && antes > 0) {
      const pct = ((agora - antes) / antes) * 100;
      if (pct > 25) insights.push({ tipo: 'warn', texto: `${cat} subiu ${pct.toFixed(0)}% em relação ao mês passado 📈` });
      if (pct < -25) insights.push({ tipo: 'ok', texto: `Parabéns! ${cat} caiu ${Math.abs(pct).toFixed(0)}% — ótima economia 📉` });
    }
    if (agora > 0 && antes === 0) {
      if (cat === 'Lazer' && agora > 200) insights.push({ tipo: 'warn', texto: `Você gastou ${fmtR(agora)} com Lazer esse mês — fique de olho 👀` });
    }
  });

  const ultMeses   = getLast6Months();
  const saldosMeses = ultMeses.map(m => {
    const sal   = salarios.find(s => s.mes === m);
    const renda = rendaTotalMes(sal, m);
    const gast  = totalGastosMes(m);
    return renda - gast;
  });
  const quant = saldosMeses.length;
  if (quant >= 3 && saldosMeses[quant-1] < saldosMeses[quant-2] && saldosMeses[quant-2] < saldosMeses[quant-3]) {
    insights.push({ tipo: 'danger', texto: `Seu saldo está caindo há 3 meses consecutivos ⚠️` });
  }

  if (saldo < 0) insights.push({ tipo: 'danger', texto: `Atenção: seu saldo está negativo este mês! 🚨` });

  const totalParc = gastosDoMes.filter(g => g.categoria === 'Compras parceladas').reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
  const renda     = rendaDashboardMes(new Date().toISOString().slice(0,7));
  if (renda > 0 && totalParc / renda > 0.3) {
    insights.push({ tipo: 'warn', texto: `Parcelas representam ${((totalParc/renda)*100).toFixed(0)}% da sua renda — cuidado com o cartão 💳` });
  }

  if (!insights.length) {
    insights.push({ tipo: 'ok', texto: 'Suas finanças estão equilibradas este mês. Continue assim! 🎉' });
  }

  const insightsHtml = insights.map(i => `
    <div class="insight-chip insight-${i.tipo}">${i.texto}</div>
  `).join('');
  window._lastInsightsHtml = insightsHtml;
  el.innerHTML = insightsHtml;
  // Popular também o slot legado se estivermos no widget e o legado ainda existir
  const legacySlot = document.getElementById('insights-box');
  if (legacySlot && legacySlot !== el) legacySlot.innerHTML = insightsHtml;
}

// Animação gradual de valor nos cards
function animateValue(id, target) {
  const el       = document.getElementById(id);
  const duration = 900;
  const start    = performance.now();
  const prev     = parseFloat((el.textContent || '0').replace(/[^0-9,.-]/g, '').replace(',', '.')) || 0;
  function step(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3);
    const current  = prev + (target - prev) * ease;
    el.textContent = fmtR(current);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ============ GRÁFICO PIZZA ============
function renderChartPizza(gastosDoMes) {
  const cats   = ['Alimentação', 'Compras parceladas', 'Compras recorrentes', 'Roupas e calçados', 'Lazer', 'Auto-cuidado', 'Transporte'];
  const cores  = ['#3dd68c', '#f0c040', '#7db8e8', '#f28ab2', '#4d9de0', '#e8843a', '#9b72e8', '#e05454'];
  const totais = cats.map(c => gastosDoMes.filter(g => g.categoria === c).reduce((s, g) => s + g.valor, 0));
  const total  = totais.reduce((a, b) => a + b, 0);

  const canvas = document.getElementById('chartPizza');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (chartPizza) { chartPizza.destroy(); chartPizza = null; }

  if (total === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#545c74';
    ctx.font = '14px DM Sans';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhum gasto este mês', canvas.width / 2, canvas.height / 2);
    return;
  }

  chartPizza = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: cats,
      datasets: [{
        data: totais,
        backgroundColor: cores,
        borderColor: '#13161d',
        borderWidth: 3,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      animation: { animateRotate: true, animateScale: true, duration: 1200, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8b92a8', font: { family: 'DM Sans', size: 12 }, padding: 14, usePointStyle: true, pointStyleWidth: 8 }
        },
        tooltip: { callbacks: { label: ctx => ` ${fmtR(ctx.raw)}` } }
      }
    }
  });
}

// ============ GRÁFICO BARRAS ============
function renderChartBarra() {
  const meses   = getLast6Months();
  const valores = meses.map(m => gastos.filter(g => g.data.startsWith(m)).reduce((s, g) => s + g.valor, 0));
  const canvas  = document.getElementById('chartBarra');
  if (!canvas) return;

  if (chartBarra) { chartBarra.destroy(); chartBarra = null; }

  chartBarra = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: meses.map(m => formatMes(m)),
      datasets: [{
        label: 'Gastos',
        data: valores,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return 'rgba(240,192,64,0.2)';
          const gradient = c.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, 'rgba(240,192,64,0.05)');
          gradient.addColorStop(1, 'rgba(240,192,64,0.45)');
          return gradient;
        },
        borderColor: '#f0c040',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 1400, easing: 'easeOutQuart', delay: (ctx) => ctx.dataIndex * 100 },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmtR(ctx.raw)}` } }
      },
      scales: {
        x: { ticks: { color: '#8b92a8', font: { family: 'DM Sans' } }, grid: { color: '#252935' } },
        y: {
          beginAtZero: true,
          ticks: { color: '#8b92a8', font: { family: 'DM Sans' }, callback: v => 'R$ ' + v },
          grid: { color: '#252935' }
        }
      }
    }
  });
}

// ============ GASTOS LIST ============
function calcularProximoPagamento() {
  const hoje = new Date();
  const ano  = hoje.getFullYear();
  const mes  = hoje.getMonth(); // 0-indexed
  const dia  = hoje.getDate();

  // Último dia do mês atual
  const ultimoDiaMesAtual = new Date(ano, mes + 1, 0).getDate();

  // Datas de pagamento: dia 15 e dia 30 (ou último dia do mês se < 30)
  const pag15  = 15;
  const pag30  = Math.min(30, ultimoDiaMesAtual);

  let proximaData = null;
  let nomeData    = '';

  if (dia < pag15) {
    // Próximo pagamento: dia 15 deste mês
    proximaData = new Date(ano, mes, pag15);
    nomeData    = `dia 15 de ${proximaData.toLocaleDateString('pt-BR', { month: 'long' })}`;
  } else if (dia < pag30) {
    // Próximo pagamento: dia 30 (ou último dia) deste mês
    proximaData = new Date(ano, mes, pag30);
    nomeData    = `dia ${pag30} de ${proximaData.toLocaleDateString('pt-BR', { month: 'long' })}`;
  } else {
    // Passou do dia 30 — próximo pagamento é dia 15 do mês seguinte
    const proximoMes        = mes + 1;
    const anoProximo        = proximoMes > 11 ? ano + 1 : ano;
    const mesProximo        = proximoMes > 11 ? 0 : proximoMes;
    proximaData = new Date(anoProximo, mesProximo, 15);
    nomeData    = `dia 15 de ${proximaData.toLocaleDateString('pt-BR', { month: 'long' })}`;
  }

  // Diferença em dias inteiros
  const hojeNorm    = new Date(ano, mes, dia);
  const diff        = Math.round((proximaData - hojeNorm) / (1000 * 60 * 60 * 24));

  return { diff, nomeData, proximaData };
}

function renderCountdownPagamentos() {
  const banner = document.getElementById('pag-countdown-banner');
  if (!banner) return;

  const { diff, nomeData } = calcularProximoPagamento();

  let icon, cor, msg, urgencia;
  if (diff === 0) {
    icon = '🔔'; cor = 'var(--accent)'; urgencia = 'hoje';
    msg = '<strong>Hoje é dia de pagamento!</strong> Não esqueça de registrar seus pagamentos.';
  } else if (diff === 1) {
    icon = '⚡'; cor = '#e8843a'; urgencia = 'amanhã';
    msg = `<strong>Amanhã é dia de pagamento</strong> (${nomeData}). Prepare-se!`;
  } else if (diff <= 5) {
    icon = '⏳'; cor = '#e8a83a'; urgencia = `${diff} dias`;
    msg = `<strong>Faltam ${diff} dias</strong> para o próximo pagamento (${nomeData}).`;
  } else {
    icon = '📅'; cor = 'var(--blue)'; urgencia = `${diff} dias`;
    msg = `<strong>Faltam ${diff} dias</strong> para o próximo pagamento (${nomeData}).`;
  }

  banner.innerHTML = `
    <div style="
      background: var(--bg2);
      border: 1px solid ${cor}44;
      border-left: 4px solid ${cor};
      border-radius: 14px;
      padding: 18px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    ">
      <div style="font-size: 32px; flex-shrink: 0; line-height:1">${icon}</div>
      <div style="flex:1">
        <div style="
          font-family: var(--font-head);
          font-size: 11px; font-weight: 700;
          color: ${cor};
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-bottom: 4px;
        ">Próximo Pagamento</div>
        <div style="font-size:14px; color: var(--text); line-height:1.5">${msg}</div>
      </div>
      <div style="
        background: ${cor}22;
        border: 1px solid ${cor}44;
        border-radius: 10px;
        padding: 10px 16px;
        text-align: center;
        flex-shrink: 0;
      ">
        <div style="font-family:var(--font-head);font-size:26px;font-weight:800;color:${cor};line-height:1">${diff === 0 ? '🔔' : diff}</div>
        ${diff > 0 ? `<div style="font-size:10px;color:var(--text2);font-weight:600;margin-top:2px">DIA${diff !== 1 ? 'S' : ''}</div>` : ''}
      </div>
    </div>
  `;
}

// ============ PAGAMENTOS ============
window.abrirResumoMes = function () {
  const mes = new Date().toISOString().slice(0, 7);
  mostrarResumoMes(mes);
};

// ============ LOGIN / LOGOUT ============

/* ===== [de app_patches.js] ===== */
/* ============================================================
   FINANCESAPP — PATCHES v1 (8 melhorias)
   Carregado APÓS app.js, pin_security.js e app_themes.js
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────────
   PATCH 1 — Saudação automática com nome do usuário no Dashboard
   ────────────────────────────────────────────────────────────── */
(function patchSaudacaoDashboard() {
  function getSaudacao() {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'Bom dia';
    if (h >= 12 && h < 18) return 'Boa tarde';
    if (h >= 18 && h < 24) return 'Boa noite';
    return 'Boa madrugada';
  }

  function injetarSaudacao() {
    const tab = document.getElementById('tab-dashboard');
    if (!tab) return;

    const user = window.currentUser;
    const nome = user?.displayName
      ? user.displayName.split(' ')[0]
      : (user?.email ? user.email.split('@')[0] : '');

    // Se já existe, apenas atualiza o conteúdo (não recria)
    const existente = document.getElementById('dashboard-saudacao');
    if (existente) {
      const span = existente.querySelector('span:last-child');
      if (span) span.textContent = `${getSaudacao()}${nome ? ', ' + nome : ''}!`;
      return;
    }

    const div = document.createElement('div');
    div.id = 'dashboard-saudacao';
    div.style.cssText = `
      font-family: var(--font-head, 'Outfit', sans-serif);
      font-size: 20px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 14px;
      padding: 0 2px;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    div.innerHTML = `<span>👋</span><span>${getSaudacao()}${nome ? ', ' + nome : ''}!</span>`;

    // Insere antes das cards
    const cardsRow = tab.querySelector('.cards-row');
    if (cardsRow) tab.insertBefore(div, cardsRow);
    else tab.insertAdjacentElement('afterbegin', div);
  }

  // Aguarda renderDashboard existir e patcha
  function tentar() {
    if (typeof window.renderDashboard !== 'function') {
      setTimeout(tentar, 300);
      return;
    }
    const orig = window.renderDashboard;
    window.renderDashboard = function () {
      orig.apply(this, arguments);
      injetarSaudacao();
    };
  }
  tentar();
})();


/* ──────────────────────────────────────────────────────────────
   PATCH 2 — Botão "Widgets" aparece APENAS no Dashboard (fade in/out)

   NOTA: este patch chegou a forçar o botão "Adicionar" (.btn-add) a
   ficar sempre visível via CSS com !important. Isso ficou obsoleto
   e passou a CONFLITAR com a regra atual (o botão deve aparecer só
   em Gastos/Parcelados/Recorrentes — ver app_patch_botao_adicionar.js),
   causando o bug do botão "sumindo" ou não sendo escondido
   corretamente. A regra de visibilidade do .btn-add agora vive só
   lá, de forma centralizada.
   ────────────────────────────────────────────────────────────── */

/* ===== [de app_patches.js] ===== */
(function patchBotaoWidgetsVisivel() {
  // CSS de fade para o botão Widgets
  const style = document.createElement('style');
  style.textContent = `
    /* Widgets: fade controlado */
    #btn-customizar-dashboard {
      transition: opacity 0.35s ease, transform 0.35s ease, visibility 0.35s !important;
      opacity: 0;
      transform: translateY(-6px);
      pointer-events: none;
      visibility: hidden;
    }
    #btn-customizar-dashboard.widget-btn-visible {
      opacity: 1 !important;
      transform: translateY(0) !important;
      pointer-events: auto !important;
      visibility: visible !important;
    }
  `;
  document.head.appendChild(style);

  function atualizarVisibilidadeWidgets(tab) {
    // Aguarda um frame para o botão ser injetado pelo dashboard_widgets.js
    requestAnimationFrame(function() {
      const btn = document.getElementById('btn-customizar-dashboard');
      if (!btn) return;
      if (tab === 'dashboard') {
        btn.classList.add('widget-btn-visible');
      } else {
        btn.classList.remove('widget-btn-visible');
      }
    });
  }

  // Patcha switchTab para detectar mudança de aba
  function tentar() {
    if (typeof window.switchTab !== 'function') {
      setTimeout(tentar, 300);
      return;
    }
    const orig = window.switchTab;
    window.switchTab = function (tab) {
      orig.apply(this, arguments);
      atualizarVisibilidadeWidgets(tab);
    };
    // Estado inicial
    setTimeout(() => atualizarVisibilidadeWidgets(window.currentTab || 'dashboard'), 600);
  }
  tentar();
})();


/* ──────────────────────────────────────────────────────────────
   PATCH 3 — "Sobrou do último mês": perguntar divisão 15/30 e
              se já foi pago; se pago → gastos pagos; se não →
              botão "Marcar como pago"
   ────────────────────────────────────────────────────────────── */

/* ===== [de /home/claude/work/app_patch_fase_b.js] ===== */
/* ============================================================
   FINANCESAPP — PATCH FASE B
   (6) Insights só aparecem após R$ 100 acumulados em gastos.
   Carregue por último, depois de dashboard_widgets.js e app.js,
   pois precisa esperar a versão "criativa" dos insights assumir.
   ============================================================ */

(function () {
  'use strict';

  const LIMITE_INSIGHTS = 100;

  function pronto() {
    if (typeof window.renderInsights !== 'function') return false;
    // dashboard_widgets.js troca window.renderInsights pela versão criativa
    // de forma assíncrona (polling); esperamos essa troca acontecer antes de
    // aplicarmos nosso gate, senão ele seria sobrescrito e perdido.
    if (typeof window._renderInsightsCriativo === 'function' &&
        window.renderInsights !== window._renderInsightsCriativo) return false;
    return true;
  }

  function totalAcumuladoGastos() {
    return (window.gastos || []).reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
  }

  function aplicarGate() {
    if (!pronto()) { setTimeout(aplicarGate, 150); return; }
    if (window.renderInsights._comGateFaseB) return; // já aplicado

    const orig = window.renderInsights;

    const gated = function (gastosDoMes, gastosAnt, saldo) {
      const box = document.getElementById('insights-box-widget') || document.getElementById('insights-box');
      const total = totalAcumuladoGastos();

      if (total < LIMITE_INSIGHTS) {
        if (box) {
          const falta = LIMITE_INSIGHTS - total;
          const fmt = typeof window.fmtR === 'function' ? window.fmtR : (v => 'R$ ' + v.toFixed(2));
          box.innerHTML = `
            <div class="insights-bloqueado">
              <div class="insights-bloqueado-icone">🔒</div>
              <p>Os insights aparecem depois que você registrar pelo menos <strong>${fmt(LIMITE_INSIGHTS)}</strong> em gastos.</p>
              <p class="insights-bloqueado-falta">Faltam ${fmt(falta)} para desbloquear.</p>
            </div>`;
        }
        return;
      }

      return orig.apply(this, arguments);
    };

    gated._comGateFaseB = true;
    window.renderInsights = gated;
    // Se a versão criativa ainda vier a ser (re)atribuída depois por algum
    // motivo, mantém a referência interna também com o gate aplicado.
    if (typeof window._renderInsightsCriativo === 'function') {
      window._renderInsightsCriativo = gated;
    }
  }

  aplicarGate();

  console.log('[FaseB] Gate de Insights (R$100 acumulados) ativo ✓');
})();
