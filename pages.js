// Navegação do painel: mantém os formulários e filtros montados entre páginas.
export function createEventPages(api) {
  const main = document.querySelector('main');
  const header = document.querySelector('.selected-event-header');
  main.prepend(header);
  const actions = header.querySelector('.event-actions');
  header.insertAdjacentHTML('beforeend', '<a class="switch-event" href="#eventos">⇄ Trocar evento</a>');
  const nav = document.createElement('nav');
  nav.className = 'event-navigation';
  nav.setAttribute('aria-label', 'Navegação do evento');
  const links = [['resumo','◫','Resumo'],['vendas','≡','Vendas'],['mesas','▦','Mesas'],['portaria','✓','Portaria'],['relatorio-financeiro','▥','Financeiro'],['historico','◷','Histórico'],['mais','•••','Mais']];
  nav.innerHTML = links.map(([id,icon,label]) => `<a href="#${id}" data-page-link="${id}"><span aria-hidden="true">${icon}</span>${label}</a>`).join('');
  document.body.append(nav);
  const extra = document.createElement('div');
  extra.innerHTML = `<section id="pageMore" class="workspace-panel" hidden><p class="eyebrow">EVENTO</p><h1>Mais opções</h1><p class="page-description">Acesse as ferramentas e configurações deste evento.</p><div class="page-shortcuts"><a href="#portaria">✓ <strong>Portaria</strong><small>Busca e check-in individual</small></a><a href="#relatorio-financeiro" data-manager>▥ <strong>Financeiro</strong><small>Recebimentos e vendedores</small></a><a href="#historico" data-manager>◷ <strong>Histórico</strong><small>Alterações da equipe</small></a><a href="#configuracao-ingresso" data-admin>▤ <strong>Configuração do ingresso</strong><small>Logo, tamanhos e prévia térmica</small></a></div><h2 data-manager>Configurações do evento</h2><div id="pageEventActions"></div></section><section id="pageDoor" class="workspace-panel" hidden><p class="eyebrow">PORTARIA</p><h1>Receber participantes</h1><p class="page-description">Leia o QR Code ou pesquise pelo nome, telefone ou mesa para registrar cada entrada.</p><div class="door-qr-card"><span class="door-qr-icon" aria-hidden="true"></span><div><strong>Validar ingresso pelo QR Code</strong><small>Abra a câmera, aponte para o código e confira se o ingresso está válido ou já foi utilizado.</small></div><button id="openQrScanner" class="button primary" type="button">Abrir câmera</button><button id="chooseQrImage" class="button secondary" type="button">Ler uma foto</button><input id="qrImageInput" type="file" accept="image/*" capture="environment" hidden></div><div class="door-tools"><label><span class="sr-only">Buscar participante</span><input id="doorSearch" type="search" placeholder="Nome, telefone ou mesa" autocomplete="off"></label><label><span class="sr-only">Situação da entrada</span><select id="doorFilter"><option value="all">Todas as entradas</option><option value="waiting">Aguardando</option><option value="checked">Check-in realizado</option></select></label></div><p id="doorCount" role="status"></p><div id="doorList"></div></section><section id="pageHistory" class="workspace-panel" hidden></section>`;
  main.append(...extra.children);
  document.querySelector('.events-panel').insertAdjacentHTML('beforebegin', '<div id="archiveHomeLink" class="page-action"><a class="button secondary" href="#arquivados">▣ Eventos arquivados <span id="archiveCount">0</span></a></div>');
  main.insertAdjacentHTML('beforeend', '<section id="pageArchived" class="workspace-panel" hidden><a class="button secondary" href="#eventos">← Eventos ativos</a><p class="eyebrow" style="margin-top:24px">ARQUIVO</p><h1>Eventos arquivados</h1><p class="page-description">Eventos encerrados e arquivados manualmente. O arquivamento automático ocorre às 23h59 do dia seguinte ao evento, no horário de Brasília.</p><div id="archivedEventsList" class="archive-list"></div></section>');
  actions.insertAdjacentHTML('beforeend', '<button id="archiveSelectedEvent" class="button secondary" type="button">Arquivar evento</button>');
  document.getElementById('archiveSelectedEvent').addEventListener('click', () => { if (context?.event) api.toggleArchive(context.event.id); });
  document.getElementById('archivedEventsList').addEventListener('click', event => { const button = event.target.closest('[data-restore-event]'); if (button) api.toggleArchive(button.dataset.restoreEvent); });
  document.querySelector('#pageEventActions').append(actions);
  actions.querySelector('[data-selected-action="sale"]').hidden = true;
  actions.querySelector('[data-selected-action="export"]').hidden = true;
  actions.querySelector('[data-selected-action="history"]').hidden = true;
  const audit = document.querySelector('.audit-log-shell');
  document.querySelector('#pageHistory').append(audit);
  audit.querySelector('[data-close]').hidden = true;
  const sales = document.querySelector('.sales-panel');
  sales.insertAdjacentHTML('beforebegin', '<div id="salesPageAction" class="page-action"><button class="button primary" data-selected-action="sale">+ Nova venda</button></div>');
  const summary = document.querySelector('.metrics');
  summary.insertAdjacentHTML('afterend', '<div id="summaryShortcuts" class="page-shortcuts"><a href="#vendas">≡ <strong>Vendas</strong><small>Participantes e novos ingressos</small></a><a href="#mesas" data-tables>▦ <strong>Mesas e bistrôs</strong><small>Mapa e reservas</small></a><a href="#portaria">✓ <strong>Portaria</strong><small>Conferir as entradas</small></a></div>');
  const positions = new Map();
  let previous = '';
  window.addEventListener('scroll', () => { if (previous) positions.set(previous, window.scrollY); }, {passive:true});
  let context;
  const byId = (id) => document.getElementById(id);
  function renderDoor() {
    if (!context) return;
    const query = api.normalize(byId('doorSearch').value);
    const digits = query.replace(/\D/g, '');
    const status = byId('doorFilter').value;
    const entries = context.sales.flatMap(sale => api.isTable(sale)
      ? api.occupants(sale).map((name,index) => ({sale,name,index,checked:api.checkins(sale)[index],label:sale.reservationLabel || 'Mesa'}))
      : [{sale,name:sale.buyerName,index:null,checked:sale.checkedIn,label:`${sale.quantity || 1} ingresso(s) · Avulso`}]);
    const visible = entries.filter(entry => (!query || api.normalize(`${entry.name} ${entry.label}`).includes(query) || (digits && String(entry.sale.buyerPhone || '').replace(/\D/g,'').includes(digits))) && (status === 'all' || Boolean(entry.checked) === (status === 'checked')));
    byId('doorCount').textContent = `${visible.length} encontrado(s) · ${entries.filter(e => e.checked).length} de ${entries.length} entradas realizadas`;
    byId('doorList').innerHTML = visible.length ? visible.map(e => `<article class="door-person"><div><strong>${api.escape(e.name || 'Participante')}</strong><small>${api.escape(e.label)}</small></div><button class="status ${e.checked ? 'checked' : ''}" type="button" ${e.index === null ? `data-checkin="${api.escape(e.sale.id)}"` : `data-table-occupant-checkin="${api.escape(e.sale.id)}" data-occupant-index="${e.index}"`}>${e.checked ? '✓ Check-in' : 'Fazer check-in'}</button></article>`).join('') : '<div class="empty">Nenhum participante encontrado.</div>';
  }
  byId('doorSearch').addEventListener('input', renderDoor);
  byId('doorFilter').addEventListener('change', renderDoor);
  return function sync(data) {
    context = data;
    let page = location.hash.slice(1) || 'eventos';
    if (!['eventos', 'arquivados', 'configuracao-ingresso', ...links.map(l => l[0])].includes(page)) page = 'eventos';
    if (!data.event && page !== 'arquivados') page = 'eventos';
    if (['relatorio-financeiro','historico'].includes(page) && !data.manager) page = 'resumo';
    if (page === 'configuracao-ingresso' && !data.admin) page = 'resumo';
    if (page === 'mesas' && !data.tables) page = 'resumo';
    const home = page === 'eventos';
    const globalPage = home || page === 'arquivados';
    const archived = (data.events || []).filter(event => api.isArchived(event)).sort((a,b) => b.date.localeCompare(a.date));
    byId('archiveCount').textContent = archived.length;
    byId('archiveHomeLink').hidden = !home;
    byId('pageArchived').hidden = page !== 'arquivados';
    byId('archiveSelectedEvent').hidden = !data.event || !api.canManage(data.event.id);
    byId('archiveSelectedEvent').textContent = api.isArchived(data.event) ? 'Restaurar evento' : 'Arquivar evento';
    if (page === 'arquivados') byId('archivedEventsList').innerHTML = archived.length ? archived.map(event => `<article class="archive-event"><div><strong>${api.escape(event.name)}</strong><small>${api.escape(event.date.split('-').reverse().join('/'))} · ${api.escape(event.place || '')}</small><small>${event.archived === true ? 'Arquivado manualmente' : 'Arquivado automaticamente'}</small></div><div class="archive-actions"><button type="button" class="button primary" data-select-event="${api.escape(event.id)}">Abrir evento</button>${api.canManage(event.id) ? `<button type="button" class="button secondary" data-restore-event="${api.escape(event.id)}">Restaurar</button>` : ''}</div></article>`).join('') : '<div class="empty">Nenhum evento arquivado.</div>';
    document.body.dataset.appPage = page;
    document.body.classList.toggle('event-workspace', !globalPage);
    document.body.classList.toggle('financial-report-open', page === 'relatorio-financeiro');
    header.hidden = globalPage;
    nav.hidden = globalPage;
    byId('dashboardPage').hidden = !['eventos','resumo','vendas','mesas'].includes(page);
    byId('selectedEventArea').hidden = home;
    document.querySelector('.hero').hidden = !home;
    document.querySelector('.events-panel').hidden = !home;
    summary.hidden = page !== 'resumo';
    byId('summaryShortcuts').hidden = page !== 'resumo';
    sales.hidden = page !== 'vendas';
    byId('salesPageAction').hidden = page !== 'vendas' || !data.seller;
    byId('tableMapPanel').hidden = page !== 'mesas' || !data.tables;
    byId('tableReservationsPanel').hidden = page !== 'mesas' || !data.tables;
    byId('financialReportPage').hidden = page !== 'relatorio-financeiro';
    byId('pageTicketConfig').hidden = page !== 'configuracao-ingresso';
    byId('pageMore').hidden = page !== 'mais';
    byId('pageDoor').hidden = page !== 'portaria';
    byId('pageHistory').hidden = page !== 'historico';
    document.querySelector('.fab').hidden = true;
    document.querySelectorAll('[data-manager]').forEach(el => el.hidden = !data.manager);
    document.querySelectorAll('[data-admin]').forEach(el => el.hidden = !data.admin);
    document.querySelectorAll('[data-tables]').forEach(el => el.hidden = !data.tables);
    nav.querySelectorAll('a').forEach(link => {
      const route = link.dataset.pageLink;
      link.hidden = (route === 'mesas' && !data.tables) || (['historico','relatorio-financeiro'].includes(route) && !data.manager);
      link.classList.toggle('active', route === page);
      link.classList.toggle('mobile-parent-active', route === 'mais' && ['portaria','historico','relatorio-financeiro','configuracao-ingresso'].includes(page));
      if (route === page) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    });
    const key = `${data.event?.id || ''}:${page}`;
    if (key !== previous) {
      previous = key;
      requestAnimationFrame(() => window.scrollTo({top:positions.get(key) || 0,behavior:'instant'}));
    }
    document.title = `${home ? 'Meus eventos' : page === 'arquivados' ? 'Eventos arquivados' : page === 'configuracao-ingresso' ? 'Configuração do ingresso' : links.find(l => l[0] === page)?.[2] || 'Evento'}${!globalPage ? ` — ${data.event.name}` : ''} | Le Beef`;
    if (page === 'portaria') renderDoor();
  };
}
