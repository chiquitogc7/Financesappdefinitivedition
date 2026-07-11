/* ============================================================
   FINANCESAPP — utils.js
   Funções utilitárias puras e reaproveitáveis: formatação de
   moeda, datas, escape de HTML, toast de UI, etc.
   Não contém nenhuma regra de negócio nem chamada ao Firebase.
   Deve ser carregado ANTES dos demais módulos (utils, firebase,
   financeiro, dashboard, perfil, cadastro, app).
   ============================================================ */


/* ===== [de app.js] app.js ===== */
function mesesEntreDatas(inicioStr, fimStr) {
  const inicio = parseDateLocal(inicioStr);
  const fim = parseDateLocal(fimStr);
  if (!inicio || !fim) return 0;
  const meses = ((fim.getFullYear() * 12) + fim.getMonth()) - ((inicio.getFullYear() * 12) + inicio.getMonth()) + 1;
  return Math.max(1, meses);
}

function parseDateLocal(dataStr) {
  if (!dataStr) return null;
  const [y, m, d] = dataStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateInputLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function makeDateClamped(year, monthIndex, day) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

function fmtR(val) {
  return 'R$ ' + (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatData(data) {
  if (!data) return '';
  const [y, m, d] = data.split('-');
  return `${d}/${m}/${y}`;
}

function formatMes(mes) {
  if (!mes) return '';
  const [y, m] = mes.split('-');
  const nomes  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return nomes[parseInt(m) - 1] + '/' + y;
}

function getLast6Months() {
  const result = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    result.push(dt.toISOString().slice(0, 7));
  }
  return result;
}

function catStyle(cat) {
  const map = {
    'Alimentação':        { icon: '🍔', cls: 'cat-alimentacao' },
    'Compras parceladas': { icon: '💳', cls: 'cat-parcelado'   },
    'Compras recorrentes': { icon: '🔁', cls: 'cat-recorrente' },
    'Compras futuras':    { icon: '🔮', cls: 'cat-futuras'     },
    'Sobrou do último mês': { icon: '↗️', cls: 'cat-sobrou'      },
    'Roupas e calçados':  { icon: '👟', cls: 'cat-roupas'      },
    'Lazer':              { icon: '🎉', cls: 'cat-lazer'       },
    'Auto-cuidado':       { icon: '💆', cls: 'cat-autocuidado' },
    'Transporte':         { icon: '🚗', cls: 'cat-transporte'  },
    'Jogos':              { icon: '🎮', cls: 'cat-jogos'       },
  };
  return map[cat] || { icon: '💸', cls: 'cat-alimentacao' };
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, comUndo) {
  const t = document.getElementById('toast');
  t.innerHTML = comUndo && undoStack.length
    ? `${msg} <button onclick="desfazerUltimaAcao()" style="background:rgba(240,192,64,0.2);border:1px solid rgba(240,192,64,0.4);border-radius:6px;color:var(--accent);cursor:pointer;font-size:12px;padding:3px 10px;margin-left:10px;font-family:var(--font-body)">↩️ Desfazer</button>`
    : msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

// Enter no login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') {
    if (document.getElementById('form-cadastro')?.style.display !== 'none') doCadastro();
    else if (document.getElementById('form-recuperar')?.style.display !== 'none') doRecuperar();
    else if (document.getElementById('form-verificacao')?.style.display !== 'none') checarEmailVerificado();
    else doLogin();
  }
});

/* ============ SIDEBAR TOGGLE ============
   Ao minimizar, a sidebar mantém os ícones visíveis (só o texto some).
   A preferência do usuário é salva e restaurada nas próximas visitas. */
