// ===== STATE =====
let token = localStorage.getItem('ph_token') || null;
let me = JSON.parse(localStorage.getItem('ph_me') || 'null');
let allServers = [];
let offerFilters = {};
let msgPollInterval = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  initParticles();
  updateHeaderUI();
  await loadServers();
  handleRoute();
  if (me) pollMessages();
  window.addEventListener('popstate', handleRoute);
});

function handleRoute() {
  const p = new URLSearchParams(location.search);
  const page = p.get('p') || 'home';
  const id = p.get('id');
  const tok = p.get('token');
  const tab = p.get('tab');
  if (page === 'verify' && tok) { verifyEmail(tok); return; }
  if (page === 'reset-password' && tok) { navigate('reset-password', { token: tok }); return; }
  navigate(page, { id, tab }, true);
}

function setUrl(page, params = {}) {
  const p = new URLSearchParams({ p: page });
  Object.entries(params).forEach(([k,v]) => { if (v != null) p.set(k, v); });
  history.pushState({}, '', '?' + p);
}

// ===== PARTICLES =====
function initParticles() {
  const c = document.getElementById('particles');
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div'); p.className = 'par';
    p.style.cssText = `left:${Math.random()*100}%;width:${Math.random()*2+1}px;height:${Math.random()*2+1}px;animation-duration:${Math.random()*14+8}s;animation-delay:${Math.random()*10}s;`;
    c.appendChild(p);
  }
}

// ===== API =====
async function api(method, path, body = null, isFormData = false) {
  const opts = { method, headers: {} };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body && !isFormData) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  else if (body && isFormData) opts.body = body;
  const res = await fetch('/api' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Błąd serwera');
  return data;
}

async function loadServers() {
  try { allServers = await api('GET', '/servers'); } catch {}
}

// ===== AUTH UI =====
function updateHeaderUI() {
  const authBtns = document.getElementById('auth-buttons');
  const userNav = document.getElementById('user-nav');
  if (me && token) {
    authBtns.style.display = 'none';
    userNav.style.display = 'flex';
    document.getElementById('nav-username').textContent = me.username;
    const roleBadgeEl = document.getElementById('nav-role-badge');
    if (roleBadgeEl) roleBadgeEl.innerHTML = me.role !== 'user' ? `<span class="role-badge role-badge-${me.role}" style="margin-left:4px">${me.role==='admin'?'👑 Admin':'🛡️ TuT'}</span>` : '';
    const roleIconEl = document.getElementById('nav-role-icon');
    if (roleIconEl) {
      if (me.avatar) roleIconEl.innerHTML = `<img src="${me.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid var(--border2);">`;
      else roleIconEl.textContent = me.role === 'admin' ? '👑' : me.role === 'tutor' ? '🛡️' : '🧙';
    }
  } else {
    authBtns.style.display = 'flex';
    userNav.style.display = 'none';
  }
}

function logout() {
  token = null; me = null;
  localStorage.removeItem('ph_token'); localStorage.removeItem('ph_me');
  if (msgPollInterval) clearInterval(msgPollInterval);
  updateHeaderUI(); navigate('home'); toast('Wylogowano');
}

function pollMessages() {
  const check = async () => {
    try {
      const data = await api('GET', '/messages/unread');
      const badge = document.getElementById('msg-badge');
      if (badge) { badge.textContent = data.count; badge.style.display = data.count > 0 ? 'flex' : 'none'; }
    } catch {}
  };
  check(); msgPollInterval = setInterval(check, 30000);
}

// ===== NAVIGATION =====
function navigate(page, params = {}, noHistory = false) {
  closeModal();
  if (!noHistory) setUrl(page, params);
  switch (page) {
    case 'home': renderHome(); break;
    case 'servers': renderServers(); break;
    case 'server': renderServerPage(params.id); break;
    case 'offers': renderOffers(params); break;
    case 'offer': renderOffer(params.id); break;
    case 'add-offer': renderAddOffer(); break;
    case 'account': renderAccount(params.tab || 'dashboard'); break;
    case 'messages': renderMessages(params.userId); break;
    case 'profile': renderProfile(params.id); break;
    case 'admin': renderAdmin(params.tab || 'dashboard'); break;
    case 'reset-password': renderResetPassword(params.token); break;
    default: renderHome();
  }
}

// ===== HOME =====
function renderHome() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <section class="servers-hero">
      <div style="position:relative;z-index:1">
        <div class="hero-eyebrow">⚔️ METIN2 MARKETPLACE — PRYWATNE SERWERY</div>
        <h1 class="hero h1" style="font-family:var(--font-d);font-size:clamp(28px,4vw,54px);font-weight:900;color:var(--white);margin:12px 0;text-shadow:0 0 40px rgba(200,148,14,.2)">
          Kupuj i sprzedawaj<br><span style="color:var(--gold2)">na swoim serwerze</span>
        </h1>
        <p style="color:var(--text2);max-width:500px;margin:0 auto 32px;font-size:18px;line-height:1.6">
          Licytacje, sprzedaż bezpośrednia i bezpieczne transakcje z TuTorem. Wybierz swój serwer.
        </p>
        <div class="hero-search" style="margin:0 auto 20px">
          <input id="hero-q" placeholder="Szukaj broni, zbroi, postaci..." onkeydown="if(event.key==='Enter')doSearch()">
          <button onclick="doSearch()">🔍 SZUKAJ</button>
        </div>
      </div>
    </section>
    <div class="divider"></div>
    <div class="section">
      <div class="section-title">🖥️ Wybierz serwer</div>
      <div class="server-grid" id="server-grid">
        ${allServers.map(s => `
          <div class="server-card" onclick="navigate('server',{id:'${s.slug}'})">
            <span class="server-card-icon">${s.slug==='projekt-hard'?`<img src="/images/projekt-hard.png" style="width:80px;height:60px;object-fit:contain;">`:"⚔️"}</span>
            <div class="server-card-name">${esc(s.name)}</div>
            ${s.rates ? `<div class="server-card-rates">${esc(s.rates)}</div>` : ''}
            ${s.description ? `<div class="server-card-desc">${esc(s.description)}</div>` : ''}
            <div class="server-card-footer">
              <span class="server-offer-count" id="count-${s.id}">Ładowanie...</span>
              <button class="btn btn-gold btn-sm">Przeglądaj →</button>
            </div>
          </div>`).join('')}
        <div class="server-card" style="opacity:.5;cursor:default">
          <span class="server-card-icon">🔜</span>
          <div class="server-card-name">Następny serwer</div>
          <div class="server-card-desc">Wkrótce kolejne serwery Metin2!</div>
          <span class="server-badge-soon">WKRÓTCE</span>
        </div>
      </div>
    </div>
    <div class="section" style="padding-top:0">
      <div class="section-title">🔥 Ostatnie ogłoszenia</div>
      <div id="latest-offers"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  // Load offer counts per server
  allServers.forEach(async s => {
    try {
      const data = await api('GET', `/offers?server_id=${s.id}&limit=1`);
      const el = document.getElementById(`count-${s.id}`);
      if (el) el.textContent = `${data.total} ogłoszeń`;
    } catch {}
  });
  // Latest offers
  api('GET', '/offers?limit=8&sort=newest').then(data => {
    const el = document.getElementById('latest-offers');
    if (el) el.innerHTML = offerCards(data.offers);
  }).catch(() => {
    const el = document.getElementById('latest-offers');
    if (el) el.innerHTML = '<div class="empty"><span class="empty-icon">⚔️</span><h3>Brak ogłoszeń</h3></div>';
  });
}

function doSearch() {
  const q = document.getElementById('hero-q')?.value?.trim();
  navigate('offers', q ? { search: q } : {});
}

// ===== SERVERS PAGE =====
function renderServers() {
  document.getElementById('app').innerHTML = `
    <div class="page">
      <h1 style="font-family:var(--font-d);font-size:26px;color:var(--white);margin-bottom:8px">🖥️ Serwery Metin2</h1>
      <p style="color:var(--text2);margin-bottom:28px">Wybierz serwer, aby przeglądać i wystawiać ogłoszenia</p>
      <div class="server-grid">
        ${allServers.map(s => `
          <div class="server-card" onclick="navigate('server',{id:'${s.slug}'})">
            <span class="server-card-icon">${s.slug==='projekt-hard'?`<img src="/images/projekt-hard.png" style="width:80px;height:60px;object-fit:contain;">`:"⚔️"}</span>
            <div class="server-card-name">${esc(s.name)}</div>
            ${s.rates ? `<div class="server-card-rates">${esc(s.rates)}</div>` : ''}
            ${s.description ? `<div class="server-card-desc">${esc(s.description)}</div>` : ''}
            <button class="btn btn-gold btn-sm" style="margin-top:8px">Przeglądaj ogłoszenia →</button>
          </div>`).join('')}
      </div>
    </div>`;
}

// ===== SERVER PAGE =====
async function renderServerPage(slug) {
  const srv = allServers.find(s => s.slug === slug);
  if (!srv) { navigate('servers'); return; }
  document.getElementById('app').innerHTML = `
    <div style="background:linear-gradient(180deg,#0d0a06,#181208);padding:36px 20px 0;text-align:center;border-bottom:1px solid var(--border)">
      <div style="max-width:1280px;margin:0 auto">
        <div style="margin-bottom:10px">${srv.slug==='projekt-hard'?`<img src="/images/projekt-hard.png" style="height:80px;object-fit:contain;">`:`<span style="font-size:48px">⚔️</span>`}</div>
        <h1 style="font-family:var(--font-d);font-size:32px;color:var(--white);margin-bottom:6px">${esc(srv.name)}</h1>
        ${srv.rates ? `<div style="color:var(--gold2);font-family:var(--font-d);font-size:14px;margin-bottom:8px">${esc(srv.rates)}</div>` : ''}
        ${srv.description ? `<p style="color:var(--text2);max-width:500px;margin:0 auto 16px">${esc(srv.description)}</p>` : ''}
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;padding-bottom:24px">
          <button class="btn btn-gold" onclick="navigate('add-offer',{server:'${srv.slug}'})">+ Wystaw przedmiot</button>
        </div>
      </div>
    </div>
    <div class="page" style="padding-top:24px">
      <div id="srv-offers-area"></div>
    </div>`;
  renderServerOffers(srv);
}

async function renderServerOffers(srv) {
  const cats = await api('GET', `/servers/${srv.slug}/categories`).catch(() => []);
  const area = document.getElementById('srv-offers-area');
  if (!area) return;
  area.innerHTML = `
    <div class="offers-layout">
      <aside>
        <div class="sidebar-box">
          <div class="sidebar-label">Typ</div>
          <div class="filter-item" data-type="" onclick="setSrvFilter('type','')">Wszystkie</div>
          <div class="filter-item" data-type="buy_now" onclick="setSrvFilter('type','buy_now')">🛒 Kup teraz</div>
          <div class="filter-item" data-type="auction" onclick="setSrvFilter('type','auction')">⏰ Licytacje</div>
        </div>
        <div class="sidebar-box">
          <div class="sidebar-label">Kategoria</div>
          ${cats.map(c => `<div class="filter-item" data-cat="${c.slug}" onclick="setSrvFilter('category','${c.slug}')">${c.icon||'📦'} ${esc(c.name)}</div>`).join('')}
        </div>
      </aside>
      <div>
        <div class="offers-toolbar">
          <span class="offers-count" id="srv-count">Ładowanie...</span>
          <div class="toolbar-right">
            <input type="text" id="srv-search" placeholder="Szukaj..." style="width:170px;padding:7px 12px;font-size:13px" onkeydown="if(event.key==='Enter')fetchSrvOffers()">
            <select class="filter-select" id="srv-sort" onchange="fetchSrvOffers()">
              <option value="newest">Najnowsze</option>
              <option value="cheapest">Najtańsze</option>
              <option value="expensive">Najdroższe</option>
              <option value="popular">Popularne</option>
              <option value="ending">Kończące się</option>
            </select>
          </div>
        </div>
        <div id="srv-offers"><div class="loading"><div class="spinner"></div></div></div>
        <div id="srv-pager"></div>
      </div>
    </div>`;
  window._srvFilters = { server_id: srv.id, page: 1, sort: 'newest' };
  fetchSrvOffers();
}

function setSrvFilter(key, val) {
  const f = window._srvFilters || {};
  if (key === 'category') { f.category = f.category === val ? undefined : val; }
  else f[key] = val || undefined;
  f.page = 1;
  window._srvFilters = f;
  document.querySelectorAll('[data-cat]').forEach(el => el.classList.toggle('active', el.dataset.cat === f.category));
  document.querySelectorAll('[data-type]').forEach(el => el.classList.toggle('active', el.dataset.type === (f.type||'')));
  fetchSrvOffers();
}

async function fetchSrvOffers() {
  const f = window._srvFilters || {};
  f.search = document.getElementById('srv-search')?.value || undefined;
  f.sort = document.getElementById('srv-sort')?.value || 'newest';
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k,v]) => { if (v != null && v !== undefined) p.set(k, v); });
  p.set('limit', 12);
  const out = document.getElementById('srv-offers');
  if (out) out.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', '/offers?' + p);
    const cnt = document.getElementById('srv-count');
    if (cnt) cnt.textContent = `${data.total} ogłoszeń`;
    if (out) out.innerHTML = data.offers.length ? offerCards(data.offers) : '<div class="empty"><span class="empty-icon">🔍</span><h3>Brak wyników</h3></div>';
    renderSrvPager(data.page, data.pages);
  } catch { if (out) out.innerHTML = '<div class="empty"><span class="empty-icon">⚠️</span><h3>Błąd</h3></div>'; }
}

function renderSrvPager(cur, total) {
  const el = document.getElementById('srv-pager');
  if (!el || total <= 1) return;
  let h = '<div class="pagination">';
  if (cur > 1) h += `<button class="pager" onclick="srvPage(${cur-1})">←</button>`;
  for (let i = Math.max(1,cur-2); i <= Math.min(total,cur+2); i++) h += `<button class="pager${i===cur?' active':''}" onclick="srvPage(${i})">${i}</button>`;
  if (cur < total) h += `<button class="pager" onclick="srvPage(${cur+1})">→</button>`;
  el.innerHTML = h + '</div>';
}
function srvPage(p) { window._srvFilters.page = p; fetchSrvOffers(); window.scrollTo(0,200); }

// ===== OFFERS LIST (global) =====
async function renderOffers(params = {}) {
  offerFilters = { sort: 'newest', ...params };
  document.getElementById('app').innerHTML = `
    <div class="page">
      <button class="back-btn" onclick="navigate('home')">← Strona główna</button>
      <div class="offers-layout">
        <aside>
          <div class="sidebar-box">
            <div class="sidebar-label">Serwer</div>
            ${allServers.map(s => `<div class="filter-item" data-srv="${s.id}" onclick="setFilter('server_id','${s.id}')">${esc(s.name)}</div>`).join('')}
          </div>
          <div class="sidebar-box">
            <div class="sidebar-label">Typ</div>
            <div class="filter-item" data-type="" onclick="setFilter('type','')">Wszystkie</div>
            <div class="filter-item" data-type="buy_now" onclick="setFilter('type','buy_now')">🛒 Kup teraz</div>
            <div class="filter-item" data-type="auction" onclick="setFilter('type','auction')">⏰ Licytacje</div>
          </div>
        </aside>
        <div>
          <div class="offers-toolbar">
            <span class="offers-count" id="offers-count">Ładowanie...</span>
            <div class="toolbar-right">
              <input type="text" id="search-q" placeholder="Szukaj..." value="${params.search||''}" style="width:170px;padding:7px 12px;font-size:13px" onkeydown="if(event.key==='Enter')applySearch()">
              <select class="filter-select" id="sort-sel" onchange="setFilter('sort',this.value)">
                <option value="newest">Najnowsze</option><option value="cheapest">Najtańsze</option>
                <option value="expensive">Najdroższe</option><option value="popular">Popularne</option>
                <option value="ending">Kończące się</option>
              </select>
            </div>
          </div>
          <div id="offers-out"><div class="loading"><div class="spinner"></div></div></div>
          <div id="pager-out"></div>
        </div>
      </div>
    </div>`;
  fetchOffers();
}

function setFilter(key, val) {
  if (key === 'server_id' || key === 'type') {
    const same = offerFilters[key] == val && val !== '';
    offerFilters[key] = same ? undefined : (val||undefined);
    document.querySelectorAll(`[data-${key==='server_id'?'srv':'type'}]`).forEach(el =>
      el.classList.toggle('active', el.dataset[key==='server_id'?'srv':'type'] == offerFilters[key]));
  } else offerFilters[key] = val;
  offerFilters.page = 1; fetchOffers();
}

function applySearch() { offerFilters.search = document.getElementById('search-q')?.value||''; offerFilters.page=1; fetchOffers(); }

async function fetchOffers() {
  const f = offerFilters; const p = new URLSearchParams();
  Object.entries(f).forEach(([k,v]) => { if (v != null && v !== '') p.set(k, v); });
  p.set('page', f.page||1); p.set('limit', 12);
  const out = document.getElementById('offers-out');
  if (out) out.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', '/offers?' + p);
    const cnt = document.getElementById('offers-count');
    if (cnt) cnt.textContent = `${data.total} ogłoszeń`;
    if (out) out.innerHTML = data.offers.length ? offerCards(data.offers) : '<div class="empty"><span class="empty-icon">🔍</span><h3>Brak wyników</h3></div>';
    renderPager(data.page, data.pages);
  } catch { if (out) out.innerHTML = '<div class="empty"><span class="empty-icon">⚠️</span><h3>Błąd ładowania</h3></div>'; }
}

function renderPager(cur, total) {
  const el = document.getElementById('pager-out'); if (!el || total<=1) return;
  let h = '<div class="pagination">';
  if (cur>1) h+=`<button class="pager" onclick="goPage(${cur-1})">←</button>`;
  for(let i=Math.max(1,cur-2);i<=Math.min(total,cur+2);i++) h+=`<button class="pager${i===cur?' active':''}" onclick="goPage(${i})">${i}</button>`;
  if(cur<total) h+=`<button class="pager" onclick="goPage(${cur+1})">→</button>`;
  el.innerHTML=h+'</div>';
}
function goPage(p){offerFilters.page=p;fetchOffers();window.scrollTo(0,0);}

// ===== OFFER CARDS =====
function offerCards(list) {
  if (!list?.length) return '<div class="empty"><span class="empty-icon">⚔️</span><h3>Brak ogłoszeń</h3></div>';
  return `<div class="offers-grid">${list.map(o => {
    const imgs = safeJson(o.images,[]);
    const isBoth = o.type==='both';
    const isA = o.type==='auction'||isBoth;
    const price = (isA&&!isBoth) ? (o.auction_current||o.auction_start) : o.price;
    const endTs = o.auction_end ? o.auction_end*1000 : null;
    const typeBadge = isBoth ? '⚡ LICYTACJA + KUP TERAZ' : (o.type==='auction' ? '⏰ LICYTACJA' : '🛒 KUP TERAZ');
    const typeCls = isBoth ? 'badge-both' : (o.type==='auction' ? 'badge-auction' : 'badge-buy');
    const isSold = o.status==='sold';
    return `<div class="offer-card${isSold?' offer-sold':''}" onclick="navigate('offer',{id:${o.id}})">
      <div class="offer-img">
        ${imgs[0]?`<img src="${imgs[0]}" alt="${esc(o.title)}" loading="lazy">`:catEmoji(o.category_slug)}
        ${isSold?`<div class="sold-overlay">✅ SPRZEDANE</div>`:`<span class="offer-type-badge ${typeCls}">${typeBadge}</span>`}
      </div>
      <div class="offer-body">
        <div class="offer-cat">${o.server_name?esc(o.server_name)+' · ':''}${o.category_name||''}</div>
        <div class="offer-title">${esc(o.title)}</div>
        <div class="offer-footer">
          <div>
            ${isBoth?`<div class="offer-price">${fmtPrice(o.auction_current||o.auction_start)} <small>PLN (licyt.)</small></div><div style="font-size:12px;color:var(--green2)">🛒 Kup teraz: ${fmtPrice(o.price)} PLN</div>`:
              `<div class="offer-price">${fmtPrice(price)} <small>PLN</small></div>`}
            ${isA?`<div class="auction-end">${o.bid_count||0} ofert${endTs?' · '+timeLeft(endTs):''}</div>`:''}
          </div>
          <div class="offer-meta2">${avatarHtml(o.seller_avatar,o.seller_role,18)} ${esc(o.seller_name)}${roleBadge(o.seller_role)}</div>
        </div>
      </div>
    </div>`; }).join('')}</div>`;
}

// ===== OFFER DETAIL =====
async function renderOffer(id) {
  document.getElementById('app').innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div><br>Ładowanie...</div></div>';
  try {
    const o = await api('GET', `/offers/${id}`);
    const imgs = safeJson(o.images,[]);
    const isBoth = o.type==='both';
    const isA = o.type==='auction'||isBoth;
    const auctionPrice = o.auction_current||o.auction_start;
    const price = isA&&!isBoth ? auctionPrice : o.price;
    const endTs = o.auction_end?o.auction_end*1000:null;
    const stars = starStr(o.seller_rating);
    document.getElementById('app').innerHTML = `
      <div class="page">
        <button class="back-btn" onclick="history.back()">← Wróć</button>
        <div class="detail-grid">
          <div>
            <div class="main-img" id="main-img">${imgs[0]?`<img src="${imgs[0]}" id="mimg">`:catEmoji(o.category_slug)}</div>
            ${imgs.length>1?`<div class="thumb-row">${imgs.map((u,i)=>`<div class="thumb${i===0?' active':''}" onclick="switchImg('${u}',this)"><img src="${u}" loading="lazy"></div>`).join('')}</div>`:''}
            <h1 class="detail-title" style="margin-top:16px">${esc(o.title)}</h1>
            <div class="detail-meta">
              ${o.server_name?`<span class="meta-pill">🖥️ ${esc(o.server_name)}</span>`:''}
              ${o.category_name?`<span class="meta-pill">📂 ${esc(o.category_name)}</span>`:''}
              <span class="meta-pill">${isA?'⏰ Licytacja':'🛒 Kup teraz'}</span>
              <span class="meta-pill">👁️ ${o.views}</span>
            </div>
            <div class="detail-desc">${o.description?esc(o.description).replace(/\n/g,'<br>'):'<em style="color:var(--text3)">Brak opisu.</em>'}</div>
            ${isA&&o.bids?.length?`<div style="margin-top:24px"><div class="sidebar-box-title">Historia licytacji</div><div class="bids-list">${o.bids.map(b=>`<div class="bid-item"><span class="bid-user">🧙 ${esc(b.username)}</span><span class="bid-amount">${fmtPrice(b.amount)} PLN</span></div>`).join('')}</div></div>`:''}
          </div>
          <div>
            <div class="sidebar-box">
              <div class="sidebar-box-title">${isA?'Aktualna oferta':'Cena'}</div>
              ${isBoth?`
                <div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-end;flex-wrap:wrap">
                  <div><div style="font-size:11px;color:var(--text3);font-family:var(--font-d);letter-spacing:1px;margin-bottom:2px">LICYTACJA</div><div class="price-big" style="margin:0">${fmtPrice(auctionPrice)} PLN</div></div>
                  <div style="color:var(--text3);font-size:20px;margin-bottom:6px">lub</div>
                  <div><div style="font-size:11px;color:var(--text3);font-family:var(--font-d);letter-spacing:1px;margin-bottom:2px">KUP TERAZ</div><div style="font-family:var(--font-d);font-size:26px;font-weight:900;color:var(--green2)">${fmtPrice(o.price)} PLN</div></div>
                </div>`:
                `<div class="price-big">${fmtPrice(price)} PLN</div>`}
              ${isA&&endTs?`<div class="auction-timer" id="atimer">${timeLeft(endTs)}</div>`:''}
              ${isA?`<div class="price-sub">Min. następna oferta: <strong>${fmtPrice((auctionPrice||0)+0.01)} PLN</strong></div>
                ${me&&me.id!==o.seller_id?`<div class="bid-row"><input type="number" id="bid-amt" placeholder="Twoja oferta PLN" step="0.01" min="${(auctionPrice||0)+0.01}"><button class="btn btn-gold" onclick="placeBid(${o.id})">Licytuj</button></div>`
                :(!me?`<button class="btn btn-ghost btn-full" onclick="showModal('login')">Zaloguj się by licytować</button>`:'')}
              `:''}
              ${(o.type==='buy_now'||isBoth)?`${me&&me.id!==o.seller_id?`<button class="btn btn-gold btn-full btn-lg" style="margin-top:8px" onclick="buyNow(${o.id},${o.seller_id})">🛒 KUP TERAZ — ${fmtPrice(o.price)} PLN</button>`
                :(!me?`<button class="btn btn-gold btn-full btn-lg" onclick="showModal('login')">🛒 Zaloguj się</button>`:
                `<div style="color:var(--text3);font-size:13px;text-align:center;padding:8px">To Twoje ogłoszenie</div>`)}`:
              (!isA?`<div style="color:var(--text3);font-size:13px;text-align:center;padding:8px">To Twoje ogłoszenie</div>`:'')}
            </div>
            <div class="sidebar-box">
              <div class="sidebar-box-title">Sprzedawca</div>
              <div class="seller-row">
                <div class="seller-avatar" style="overflow:hidden">${avatarHtml(o.seller_avatar,o.seller_role,44)}</div>
                <div>
                  <div class="seller-name"><a href="#" onclick="navigate('profile',{id:${o.seller_id}});return false;">${esc(o.seller_name)}</a>${roleBadge(o.seller_role)}</div>
                  <div class="seller-stats-row"><span class="stars">${stars}</span><span>${o.total_sales||0} sprzedaży</span></div>
                </div>
              </div>
              ${me&&me.id!==o.seller_id?`<button class="btn btn-ghost btn-full btn-sm" onclick="navigate('messages',{userId:${o.seller_id}})">💬 Wyślij wiadomość</button>`:''}
            ${me&&me.id===o.seller_id?`<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
              ${o.status==='active'?`<button class="btn btn-red btn-sm btn-full" onclick="markSold(${o.id})">✅ Oznacz jako sprzedane</button>`:''}
              ${o.status==='sold'?`<button class="btn btn-ghost btn-sm btn-full" onclick="reactivateOffer(${o.id})">🔄 Reaktywuj ogłoszenie</button>`:''}
            </div>`:''}
            </div>
            ${o.status==='sold'?`<div class="sold-banner">✅ SPRZEDANE</div>`:''}
            ${me&&me.id!==o.seller_id&&o.status!=='sold'?`
            <div class="tutor-box">
              <div class="tutor-title">🛡️ Zamów TuTora — bezpieczna transakcja</div>
              <div class="tutor-desc">TuTor pośredniczy i gwarantuje bezpieczeństwo.<br><strong style="color:var(--gold2)">Koszt: 20 PLN</strong></div>
              <div style="margin-bottom:10px">
                <div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-family:var(--font-d)">METODA PŁATNOŚCI:</div>
                <div class="payment-btns">
                  <div class="pay-btn" id="pay-blik" onclick="selectPayment('blik')">💳 BLIK</div>
                  <div class="pay-btn" id="pay-revolut" onclick="selectPayment('revolut')">💸 Revolut</div>
                </div>
              </div>
              <button class="btn btn-green btn-full btn-sm" onclick="requestTutor(${o.id})">🛡️ Zamów TuTora</button>
            </div>`:''}
          </div>
        </div>
      </div>`;
    if (isA&&endTs) {
      const el=document.getElementById('atimer');
      if(el){const iv=setInterval(()=>{if(!document.getElementById('atimer')){clearInterval(iv);return;}document.getElementById('atimer').textContent=timeLeft(endTs);},1000);}
    }
  } catch(e) { document.getElementById('app').innerHTML=`<div class="page"><div class="empty"><span class="empty-icon">⚠️</span><h3>${e.message}</h3></div></div>`; }
}

function switchImg(url,el){const m=document.getElementById('main-img');if(m)m.innerHTML=`<img src="${url}">`;document.querySelectorAll('.thumb').forEach(t=>t.classList.remove('active'));el.classList.add('active');}
let selPay=null;
function selectPayment(m){selPay=m;document.querySelectorAll('.pay-btn').forEach(b=>b.classList.remove('selected'));document.getElementById('pay-'+m)?.classList.add('selected');}
async function requestTutor(id){if(!me)return showModal('login');if(!selPay)return toast('Wybierz metodę płatności','error');try{const r=await api('POST','/tutor/request',{offer_id:id,payment_method:selPay});toast(r.message,'success');}catch(e){toast(e.message,'error');}}
async function placeBid(id){if(!me)return showModal('login');const amt=parseFloat(document.getElementById('bid-amt')?.value);if(!amt||amt<=0)return toast('Podaj kwotę','error');try{const r=await api('POST',`/offers/${id}/bid`,{amount:amt});toast(r.message,'success');renderOffer(id);}catch(e){toast(e.message,'error');}}
function buyNow(id,sid){
  if(!me)return showModal('login');
  navigate('messages',{userId:sid});
  toast('Napisz do sprzedawcy aby ustalić szczegóły transakcji');
}
async function markSold(id){
  if(!confirm('Oznaczyć ogłoszenie jako sprzedane? Zniknie z listy aktywnych.'))return;
  try{await api('PATCH',`/offers/${id}/sold`);toast('Oznaczono jako sprzedane!','success');renderOffer(id);}
  catch(e){toast(e.message,'error');}
}
async function reactivateOffer(id){
  try{await api('PATCH',`/offers/${id}/reactivate`);toast('Ogłoszenie reaktywowane!','success');renderOffer(id);}
  catch(e){toast(e.message,'error');}
}

// ===== ADD OFFER =====
async function renderAddOffer(prefillServer) {
  if (!me) { showModal('login'); toast('Zaloguj się aby wystawić ogłoszenie','error'); return; }
  const user = db_me_check();
  document.getElementById('app').innerHTML = `
    <div class="add-page">
      <button class="back-btn" onclick="navigate('home')">← Wróć</button>
      <h1 class="page-title">➕ Wystaw przedmiot</h1>
      <p class="page-sub">Metin2 Marketplace — wybierz serwer i kategorię</p>

      <div class="form-group">
        <label class="form-label">Serwer *</label>
        <div class="server-select-grid" id="srv-select">
          ${allServers.map(s=>`<div class="server-opt${prefillServer===s.slug?' selected':''}" data-srvid="${s.id}" data-srvslug="${s.slug}" onclick="selectServer(this,${s.id},'${s.slug}')">
            <div class="server-opt-name">${esc(s.name)}</div>
            ${s.rates?`<div class="server-opt-rates">${esc(s.rates)}</div>`:''}
          </div>`).join('')}
        </div>
        <input type="hidden" id="f-server-id" value="${prefillServer?allServers.find(s=>s.slug===prefillServer)?.id||'':''}" >
      </div>

      <div class="form-group" id="f-cat-group" style="${!prefillServer?'display:none':''}">
        <label class="form-label">Kategoria *</label>
        <select id="f-cat"><option value="">— Wybierz kategorię —</option></select>
      </div>

      <div class="form-group">
        <label class="form-label">Typ ogłoszenia *</label>
        <div class="type-select">
          <div class="type-opt selected" id="opt-buy_now" onclick="selectType('buy_now')">
            <span class="type-opt-icon">🛒</span><div class="type-opt-name">Kup teraz</div><div class="type-opt-desc">Stała cena</div>
          </div>
          <div class="type-opt" id="opt-auction" onclick="selectType('auction')">
            <span class="type-opt-icon">⏰</span><div class="type-opt-name">Licytacja</div><div class="type-opt-desc">Cena rośnie</div>
          </div>
          <div class="type-opt" id="opt-both" onclick="selectType('both')">
            <span class="type-opt-icon">⚡</span><div class="type-opt-name">Licytacja + Kup teraz</div><div class="type-opt-desc">Oba tryby</div>
          </div>
        </div>
        <input type="hidden" id="f-type" value="buy_now">
      </div>

      <div class="form-group">
        <label class="form-label">Tytuł ogłoszenia *</label>
        <input type="text" id="f-title" placeholder="np. Smocza Broń +9 Full Opcja">
      </div>

      <div id="buynow-field" class="form-group">
        <label class="form-label">Cena "Kup teraz" (PLN) *</label>
        <input type="number" id="f-price" placeholder="49.99" min="0.01" step="0.01">
      </div>
      <div id="auction-fields" style="display:none">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Cena startowa licytacji (PLN) *</label><input type="number" id="f-start" placeholder="5.00" min="0.01" step="0.01"></div>
          <div class="form-group"><label class="form-label">Koniec aukcji *</label><input type="datetime-local" id="f-end"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Opis</label>
        <textarea id="f-desc" rows="5" placeholder="Opisz przedmiot: opcje, stan, jak przebiega transakcja..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Screeny przedmiotu (max 5)</label>
        <input type="file" id="f-imgs" accept="image/*" multiple onchange="previewImages(this)">
        <div class="img-preview" id="img-preview"></div>
      </div>
      <button class="btn btn-gold btn-full btn-lg" onclick="submitOffer()">⚔️ OPUBLIKUJ OGŁOSZENIE</button>
    </div>`;

  const dt = document.getElementById('f-end');
  if (dt) { const n=new Date(); n.setHours(n.getHours()+1); dt.min=n.toISOString().slice(0,16); }
  if (prefillServer) {
    const srv = allServers.find(s=>s.slug===prefillServer);
    if (srv) loadCategoriesForServer(srv.id);
    document.querySelector(`[data-srvslug="${prefillServer}"]`)?.classList.add('selected');
  }
}

function db_me_check() { return me; }

async function selectServer(el, serverId, serverSlug) {
  document.querySelectorAll('.server-opt').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('f-server-id').value = serverId;
  document.getElementById('f-cat-group').style.display = 'block';
  loadCategoriesForServer(serverId);
}

async function loadCategoriesForServer(serverId) {
  try {
    const cats = await api('GET', `/categories?server_id=${serverId}`);
    const sel = document.getElementById('f-cat');
    if (sel) sel.innerHTML = '<option value="">— Wybierz kategorię —</option>' + cats.map(c=>`<option value="${c.id}">${c.icon||''} ${esc(c.name)}</option>`).join('');
  } catch {}
}

function selectType(type){document.getElementById('f-type').value=type;document.querySelectorAll('.type-opt').forEach(e=>e.classList.remove('selected'));document.getElementById('opt-'+type)?.classList.add('selected');document.getElementById('buynow-field').style.display=(type==='buy_now'||type==='both')?'block':'none';document.getElementById('auction-fields').style.display=(type==='auction'||type==='both')?'block':'none';const lbl=document.querySelector('#buynow-field .form-label');if(lbl)lbl.textContent=type==='both'?'Cena "Kup teraz" (PLN) *':'Cena (PLN) *';}

function previewImages(input){const prev=document.getElementById('img-preview');if(!prev)return;prev.innerHTML='';Array.from(input.files).slice(0,5).forEach(f=>{const r=new FileReader();r.onload=e=>{const d=document.createElement('div');d.className='img-prev-item';d.innerHTML=`<img src="${e.target.result}">`;prev.appendChild(d);};r.readAsDataURL(f);});}

async function submitOffer(){
  const type=document.getElementById('f-type')?.value;
  const title=document.getElementById('f-title')?.value?.trim();
  const cat=document.getElementById('f-cat')?.value;
  const serverId=document.getElementById('f-server-id')?.value;
  const desc=document.getElementById('f-desc')?.value?.trim();
  const files=document.getElementById('f-imgs')?.files;
  if(!serverId)return toast('Wybierz serwer','error');
  if(!title)return toast('Wpisz tytuł','error');
  if(!cat)return toast('Wybierz kategorię','error');
  const fd=new FormData();
  fd.append('title',title);fd.append('description',desc||'');fd.append('category_id',cat);fd.append('server_id',serverId);fd.append('type',type);
  // Handle all types: buy_now, auction, both
  if(type==='buy_now'||type==='both'){
    const price=parseFloat(document.getElementById('f-price')?.value);
    if(!price||price<=0)return toast('Podaj cenę Kup Teraz','error');
    fd.append('price',price);
  }
  if(type==='auction'||type==='both'){
    const start=parseFloat(document.getElementById('f-start')?.value);
    const end=document.getElementById('f-end')?.value;
    if(!start||start<=0)return toast('Podaj cenę startową licytacji','error');
    if(!end)return toast('Podaj datę zakończenia aukcji','error');
    fd.append('auction_start',start);
    fd.append('auction_end',end);
  }
  if(files)Array.from(files).slice(0,5).forEach(f=>fd.append('images',f));
  try{const btn=document.querySelector('.add-page .btn-gold');if(btn){btn.disabled=true;btn.textContent='Dodawanie...';}
    const r=await api('POST','/offers',fd,true);toast('Ogłoszenie dodane!','success');navigate('offer',{id:r.id});}
  catch(e){toast(e.message,'error');const btn=document.querySelector('.add-page .btn-gold');if(btn){btn.disabled=false;btn.textContent='⚔️ OPUBLIKUJ OGŁOSZENIE';}}
}

// ===== ACCOUNT =====
async function renderAccount(tab='dashboard'){
  if(!me){showModal('login');return;}
  const isAdmin=me.role==='admin';const isTutor=me.role==='tutor'||isAdmin;
  document.getElementById('app').innerHTML=`
    <div class="page">
      <div class="account-grid">
        <aside>
          <div class="sidebar-box">
            <div style="text-align:center;padding:8px 0 16px">
              <div style="font-size:36px;margin-bottom:6px">${isAdmin?'👑':isTutor?'🛡️':'🧙'}</div>
              <div style="font-family:var(--font-d);font-size:15px;color:var(--white)">${esc(me.username)}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px">${me.role?.toUpperCase()}</div>
            </div>
            ${[['dashboard','📊','Dashboard'],['offers','📋','Moje ogłoszenia'],['messages','💬','Wiadomości'],['tutor','🛡️','TuTor'],['settings','⚙️','Ustawienia'],
               ...(isTutor?[['admin-panel','👑','Panel Admina/Tutora']]:[]),
               ['logout','🚪','Wyloguj']].map(([id,icon,label])=>`
              <div class="account-nav-item${tab===id?' active':''}" onclick="${id==='logout'?'logout()':id==='admin-panel'?`navigate('admin')`:`renderAccount('${id}')`}">${icon} ${label}</div>`).join('')}
          </div>
        </aside>
        <div id="account-content"><div class="loading"><div class="spinner"></div></div></div>
      </div>
    </div>`;
  loadAccountTab(tab);
}

async function loadAccountTab(tab){
  const el=document.getElementById('account-content');if(!el)return;
  if(tab==='dashboard'){
    try{const u=await api('GET','/auth/me');
      el.innerHTML=`<div class="account-panel">
        <div class="panel-title">📊 Dashboard</div>
        <div class="stat-cards"><div class="stat-card"><span class="stat-card-num">${u.total_sales||0}</span><span class="stat-card-label">Sprzedaży</span></div><div class="stat-card"><span class="stat-card-num">${fmtRating(u.rating)}</span><span class="stat-card-label">Ocena</span></div><div class="stat-card"><span class="stat-card-num">${u.rating_count||0}</span><span class="stat-card-label">Opinii</span></div></div>
        <div style="padding:16px;background:var(--bg4);border-radius:var(--r);margin-bottom:16px"><div style="font-family:var(--font-d);font-size:11px;color:var(--text3);margin-bottom:8px;letter-spacing:1px">PROFIL</div>
        <p><strong style="color:var(--text2)">Login:</strong> ${esc(u.username)}</p><p><strong style="color:var(--text2)">Email:</strong> ${esc(u.email)}</p>${u.discord?`<p><strong style="color:var(--text2)">Discord:</strong> ${esc(u.discord)}</p>`:''}</div>
        <button class="btn btn-gold" onclick="renderAccount('settings')">⚙️ Edytuj profil</button>
      </div>`;}catch{el.innerHTML='<div class="empty">Błąd</div>';}
  } else if(tab==='offers'){
    try{const offers=await api('GET','/offers/my/list');
      el.innerHTML=`<div class="account-panel"><div class="panel-title">📋 Moje ogłoszenia<button class="btn btn-gold btn-sm" style="margin-left:auto" onclick="navigate('add-offer')">+ Nowe</button></div>
        ${offers.length?offers.map(o=>{const imgs=safeJson(o.images,[]);return`<div class="offer-row">
          <div class="offer-row-img" onclick="navigate('offer',{id:${o.id}})" style="cursor:pointer">${imgs[0]?`<img src="${imgs[0]}">`:catEmoji(o.category_slug||'')}</div>
          <div class="offer-row-info" onclick="navigate('offer',{id:${o.id}})" style="cursor:pointer"><div class="offer-row-title">${esc(o.title)}</div><div class="offer-row-meta">${o.server_name?esc(o.server_name)+' · ':''} ${o.type==='auction'?'⏰':'🛒'} · ${o.bid_count||0} ofert · ${o.views} wyśw.</div></div>
          <div class="offer-row-price">${fmtPrice(o.type==='auction'?(o.auction_current||o.auction_start):o.price)} PLN</div>
          <button class="btn btn-red btn-sm" onclick="delMyOffer(${o.id})">🗑</button></div>`;}).join(''):'<div class="empty" style="padding:24px"><span class="empty-icon">📋</span><h3>Brak ogłoszeń</h3><button class="btn btn-gold" onclick="navigate(\'add-offer\')">Dodaj</button></div>'}
      </div>`;}catch{el.innerHTML='<div class="empty">Błąd</div>';}
  } else if(tab==='messages'){renderMessages(null,true);
  } else if(tab==='tutor'){
    try{const data=await api('GET','/tutor/my');
      el.innerHTML=`<div class="account-panel"><div class="panel-title">🛡️ TuTor</div>
        <div style="font-family:var(--font-d);font-size:11px;color:var(--text3);margin-bottom:10px;letter-spacing:1px">ZŁOŻONE PRZEZE MNIE</div>
        ${data.sent.length?data.sent.map(t=>`<div class="offer-row"><div class="offer-row-info"><div class="offer-row-title">${esc(t.offer_title)}</div><div class="offer-row-meta">Sprzedawca: ${esc(t.seller_name)} · ${t.payment_method?.toUpperCase()} · <span class="status-pill status-${t.status}">${t.status}</span></div></div></div>`).join(''):'<p style="color:var(--text3)">Brak</p>'}
      </div>`;}catch{el.innerHTML='<div class="empty">Błąd</div>';}
  } else if(tab==='settings'){
    try{const u=await api('GET','/auth/me');
      el.innerHTML=`<div class="account-panel"><div class="panel-title">⚙️ Ustawienia profilu</div>
        <div class="form-group">
          <label class="form-label">Awatar</label>
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
            <div style="width:80px;height:80px;border-radius:50%;overflow:hidden;border:2px solid var(--border2);background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:36px;flex-shrink:0" id="avatar-preview">
              ${u.avatar?`<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;">`:(u.role==='admin'?'👑':u.role==='tutor'?'🛡️':'🧙')}
            </div>
            <div>
              <input type="file" id="s-avatar" accept="image/*" onchange="previewAvatar(this)" style="margin-bottom:8px">
              <div style="font-size:12px;color:var(--text3)">Max 2MB · JPG, PNG, GIF</div>
              <button class="btn btn-gold btn-sm" style="margin-top:8px" onclick="uploadAvatar()">📸 Zapisz awatar</button>
            </div>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Bio / O mnie</label><textarea id="s-bio" rows="3">${esc(u.bio||'')}</textarea></div>
        <div class="form-group"><label class="form-label">Discord</label><input type="text" id="s-discord" value="${esc(u.discord||'')}"></div>
        <button class="btn btn-gold" onclick="saveSettings()">💾 Zapisz zmiany</button>
      </div>`;}catch{}
  }
}

async function saveSettings(){const bio=document.getElementById('s-bio')?.value;const discord=document.getElementById('s-discord')?.value;try{await api('PUT','/auth/me',{bio,discord});toast('Zaktualizowano!','success');}catch(e){toast(e.message,'error');}}

function previewAvatar(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{const prev=document.getElementById('avatar-preview');if(prev)prev.innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`; };
  reader.readAsDataURL(file);
}

async function uploadAvatar(){
  const file=document.getElementById('s-avatar')?.files[0];
  if(!file)return toast('Wybierz zdjęcie','error');
  const fd=new FormData();fd.append('avatar',file);
  try{
    const r=await api('POST','/auth/avatar',fd,true);
    me.avatar=r.avatar;localStorage.setItem('ph_me',JSON.stringify(me));
    toast(r.message,'success');
  }catch(e){toast(e.message,'error');}
}
async function delMyOffer(id){if(!confirm('Usunąć?'))return;try{await api('DELETE',`/offers/${id}`);toast('Usunięto','success');loadAccountTab('offers');}catch(e){toast(e.message,'error');}}

// ===== ADMIN PANEL =====
async function renderAdmin(tab='dashboard'){
  if(!me||!['admin','tutor'].includes(me.role)){toast('Brak dostępu','error');navigate('home');return;}
  const isAdmin=me.role==='admin';
  document.getElementById('app').innerHTML=`
    <div class="admin-layout">
      <div class="admin-sidebar">
        <div class="admin-logo">
          <div class="admin-logo-title">${isAdmin?'👑 PANEL ADMINA':'🛡️ PANEL TUTORA'}</div>
          <div class="admin-logo-role">${esc(me.username)}</div>
        </div>
        <div class="admin-nav-section">Główne</div>
        <div class="admin-nav-item${tab==='dashboard'?' active':''}" onclick="adminTab('dashboard')"><span class="nav-icon">📊</span>Dashboard</div>
        <div class="admin-nav-item${tab==='tutor-requests'?' active':''}" onclick="adminTab('tutor-requests')"><span class="nav-icon">🛡️</span>Zlecenia TuTora</div>
        <div class="admin-nav-item${tab==='messages'?' active':''}" onclick="adminTab('messages')"><span class="nav-icon">💬</span>Wiadomości</div>
        <div class="admin-nav-section">Zarządzanie</div>
        <div class="admin-nav-item${tab==='users'?' active':''}" onclick="adminTab('users')"><span class="nav-icon">👥</span>Użytkownicy</div>
        <div class="admin-nav-item${tab==='offers'?' active':''}" onclick="adminTab('offers')"><span class="nav-icon">📋</span>Ogłoszenia</div>
        ${isAdmin?`<div class="admin-nav-item${tab==='servers'?' active':''}" onclick="adminTab('servers')"><span class="nav-icon">🖥️</span>Serwery</div>`:''}
        <div class="admin-nav-section">Konto</div>
        <div class="admin-nav-item" onclick="navigate('account')"><span class="nav-icon">🧙</span>Mój profil</div>
        <div class="admin-nav-item" onclick="logout()"><span class="nav-icon">🚪</span>Wyloguj</div>
      </div>
      <div class="admin-content" id="admin-content"><div class="loading"><div class="spinner"></div></div></div>
    </div>`;
  loadAdminTab(tab);
}

function adminTab(tab){document.querySelectorAll('.admin-nav-item').forEach(el=>el.classList.remove('active'));event.currentTarget?.classList.add('active');loadAdminTab(tab);}

async function loadAdminTab(tab){
  const el=document.getElementById('admin-content');if(!el)return;
  el.innerHTML='<div class="loading"><div class="spinner"></div></div>';

  if(tab==='dashboard'){
    try{const s=await api('GET','/admin/stats');
      el.innerHTML=`<div class="admin-title">📊 Dashboard</div>
        <div class="stat-grid">
          <div class="stat-box"><span class="stat-box-num">${s.users}</span><span class="stat-box-label">Użytkownicy</span></div>
          <div class="stat-box"><span class="stat-box-num">${s.offers}</span><span class="stat-box-label">Aktywne ogłoszenia</span></div>
          <div class="stat-box warn"><span class="stat-box-num">${s.banned}</span><span class="stat-box-label">Zbanowani</span></div>
          <div class="stat-box warn"><span class="stat-box-num">${s.tutor_pending}</span><span class="stat-box-label">Oczekujące TuTor</span></div>
          <div class="stat-box"><span class="stat-box-num">${s.tutor_requests}</span><span class="stat-box-label">Wszystkie TuTor</span></div>
          <div class="stat-box"><span class="stat-box-num">${s.servers}</span><span class="stat-box-label">Serwery</span></div>
        </div>
        <div class="admin-title" style="margin-top:8px">⚡ Szybkie akcje</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-gold" onclick="adminTab('tutor-requests')">🛡️ Zlecenia TuTora (${s.tutor_pending} oczekuje)</button>
          <button class="btn btn-ghost" onclick="adminTab('users')">👥 Zarządzaj użytkownikami</button>
          <button class="btn btn-ghost" onclick="adminTab('offers')">📋 Przeglądaj ogłoszenia</button>
        </div>`;}catch{el.innerHTML='<div class="empty">Błąd</div>';}
  }

  else if(tab==='tutor-requests'){
    try{const reqs=await api('GET','/admin/tutor-requests');
      el.innerHTML=`<div class="admin-title">🛡️ Zlecenia TuTora</div>
        <div class="tabs">
          <div class="tab active" onclick="filterTutor('')">Wszystkie (${reqs.length})</div>
          <div class="tab" onclick="filterTutor('pending')">Oczekujące</div>
          <div class="tab" onclick="filterTutor('in_progress')">W trakcie</div>
          <div class="tab" onclick="filterTutor('completed')">Zakończone</div>
        </div>
        <div id="tutor-list">${renderTutorCards(reqs)}</div>`;
      window._allTutorReqs=reqs;
    }catch{el.innerHTML='<div class="empty">Błąd</div>';}
  }

  else if(tab==='users'){
    el.innerHTML=`<div class="admin-title">👥 Użytkownicy</div>
      <div class="search-bar"><input type="text" id="usr-search" placeholder="Szukaj loginu lub emaila..." onkeydown="if(event.key==='Enter')loadUsers()"><button class="btn btn-gold btn-sm" onclick="loadUsers()">Szukaj</button></div>
      <div id="users-table"><div class="loading"><div class="spinner"></div></div></div>`;
    loadUsers();
  }

  else if(tab==='offers'){
    el.innerHTML=`<div class="admin-title">📋 Ogłoszenia</div>
      <div class="search-bar"><input type="text" id="off-search" placeholder="Szukaj..." onkeydown="if(event.key==='Enter')loadAdminOffers()"><button class="btn btn-gold btn-sm" onclick="loadAdminOffers()">Szukaj</button></div>
      <div id="offers-table"><div class="loading"><div class="spinner"></div></div></div>`;
    loadAdminOffers();
  }

  else if(tab==='messages'){
    // Admin can use regular messages
    renderMessages(null, true, true);
  }

  else if(tab==='servers'&&me.role==='admin'){
    try{const srvs=await api('GET','/admin/servers');
      el.innerHTML=`<div class="admin-title">🖥️ Serwery</div>
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:20px;margin-bottom:20px">
          <div style="font-family:var(--font-d);font-size:13px;color:var(--text2);margin-bottom:14px">Dodaj nowy serwer</div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Nazwa</label><input type="text" id="nsrv-name" placeholder="Nazwa serwera"></div>
            <div class="form-group"><label class="form-label">Slug (URL)</label><input type="text" id="nsrv-slug" placeholder="np. mroczny-mt2"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Rates</label><input type="text" id="nsrv-rates" placeholder="np. x500"></div>
            <div class="form-group"><label class="form-label">Opis</label><input type="text" id="nsrv-desc" placeholder="Krótki opis"></div>
          </div>
          <button class="btn btn-gold" onclick="addServer()">➕ Dodaj serwer</button>
        </div>
        <table class="data-table"><thead><tr><th>ID</th><th>Nazwa</th><th>Slug</th><th>Rates</th><th>Status</th><th>Akcje</th></tr></thead>
        <tbody>${srvs.map(s=>`<tr><td>${s.id}</td><td>${esc(s.name)}</td><td>${esc(s.slug)}</td><td>${esc(s.rates||'—')}</td><td><span class="status-pill ${s.is_active?'status-completed':'status-cancelled'}">${s.is_active?'Aktywny':'Ukryty'}</span></td><td><button class="btn btn-ghost btn-sm" onclick="toggleServer(${s.id})">${s.is_active?'Ukryj':'Aktywuj'}</button></td></tr>`).join('')}</tbody></table>`;}
    catch{el.innerHTML='<div class="empty">Błąd</div>';}
  }
}

function filterTutor(status){const all=window._allTutorReqs||[];const filtered=status?all.filter(r=>r.status===status):all;document.getElementById('tutor-list').innerHTML=renderTutorCards(filtered);document.querySelectorAll('.tabs .tab').forEach((t,i)=>t.classList.toggle('active',i===['','pending','in_progress','completed'].indexOf(status)));}

function renderTutorCards(reqs){
  if(!reqs.length)return'<div class="empty"><span class="empty-icon">🛡️</span><h3>Brak zleceń</h3></div>';
  return reqs.map(r=>`
    <div class="tutor-card">
      <div class="tutor-card-header">
        <div><div class="tutor-card-title">📦 ${esc(r.offer_title)}</div></div>
        <span class="tutor-status status-${r.status}">${{pending:'Oczekuje',in_progress:'W trakcie',completed:'Zakończone',cancelled:'Anulowane'}[r.status]||r.status}</span>
      </div>
      <div class="tutor-card-meta">
        👤 Kupujący: <strong>${esc(r.buyer_name)}</strong> &nbsp;|&nbsp;
        🧙 Sprzedawca: <strong>${esc(r.seller_name)}</strong> &nbsp;|&nbsp;
        💳 ${r.payment_method?.toUpperCase()||'—'} &nbsp;|&nbsp;
        ${r.tutor_name?`🛡️ TuTor: <strong>${esc(r.tutor_name)}</strong>`:'Bez TuTora'}
        ${r.notes?`<br>📝 ${esc(r.notes)}`:''}
      </div>
      <div class="tutor-card-actions">
        ${r.status==='pending'?`<button class="btn btn-green btn-sm" onclick="tutorAction(${r.id},'assign')">✋ Przejmij zlecenie</button>`:''}
        ${r.status==='in_progress'?`<button class="btn btn-gold btn-sm" onclick="tutorComplete(${r.id})">✅ Zakończ</button><button class="btn btn-red btn-sm" onclick="tutorAction(${r.id},'cancel')">❌ Anuluj</button>`:''}
        <button class="btn btn-ghost btn-sm" onclick="navigate('messages',{userId:${r.buyer_id}})">💬 Napisz do kupującego</button>
        <button class="btn btn-ghost btn-sm" onclick="navigate('messages',{userId:${r.seller_id}})">💬 Napisz do sprzedawcy</button>
      </div>
    </div>`).join('');
}

async function tutorAction(id,action){try{const r=await api('POST',`/admin/tutor-requests/${id}/${action}`);toast(r.message,'success');loadAdminTab('tutor-requests');}catch(e){toast(e.message,'error');}}
async function tutorComplete(id){const notes=prompt('Notatka do zlecenia (opcjonalnie):');try{const r=await api('POST',`/admin/tutor-requests/${id}/complete`,{notes:notes||''});toast(r.message,'success');loadAdminTab('tutor-requests');}catch(e){toast(e.message,'error');}}

async function loadUsers(){
  const search=document.getElementById('usr-search')?.value||'';
  try{const data=await api('GET',`/admin/users?search=${encodeURIComponent(search)}`);
    document.getElementById('users-table').innerHTML=`
      <table class="data-table"><thead><tr><th>ID</th><th>Login</th><th>Email</th><th>Rola</th><th>Status</th><th>Sprzedaży</th><th>Akcje</th></tr></thead>
      <tbody>${data.users.map(u=>`<tr>
        <td>${u.id}</td>
        <td><a href="#" onclick="navigate('profile',{id:${u.id}});return false">${esc(u.username)}</a></td>
        <td style="font-size:12px;color:var(--text3)">${esc(u.email)}</td>
        <td><span class="role-pill role-${u.role}">${u.role}</span></td>
        <td>${u.is_banned?'<span style="color:var(--red2)">🚫 Zbanowany</span>':'<span style="color:var(--green2)">✅ Aktywny</span>'}</td>
        <td>${u.total_sales||0}</td>
        <td class="action-btns">
          <button class="btn btn-ghost btn-sm" onclick="navigate('messages',{userId:${u.id}})">💬</button>
          ${me.role==='admin'?`
            <select onchange="changeRole(${u.id},this.value);this.value=''" style="background:var(--bg4);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:4px;font-size:12px;cursor:pointer">
              <option value="">Rola...</option><option value="user">user</option><option value="tutor">tutor</option><option value="admin">admin</option>
            </select>
            ${u.is_banned?`<button class="btn btn-green btn-sm" onclick="banUser(${u.id},false)">Odblokuj</button>`:
              `<button class="btn btn-red btn-sm" onclick="banUser(${u.id},true)">🚫 Ban</button>`}`:''}
        </td></tr>`).join('')}</tbody></table>
      <div style="color:var(--text3);font-size:13px;margin-top:8px">Łącznie: ${data.total} użytkowników</div>`;}
  catch{document.getElementById('users-table').innerHTML='<div class="empty">Błąd</div>';}
}

async function banUser(id,ban){
  if(ban){const reason=prompt('Powód bana:');if(reason===null)return;try{await api('POST',`/admin/users/${id}/ban`,{reason});toast('Zbanowano','success');loadUsers();}catch(e){toast(e.message,'error');}}
  else{try{await api('POST',`/admin/users/${id}/unban`);toast('Odblokowano','success');loadUsers();}catch(e){toast(e.message,'error');}}
}
async function changeRole(id,role){if(!role)return;if(!confirm(`Zmienić rolę na ${role}?`))return;try{await api('POST',`/admin/users/${id}/role`,{role});toast('Rola zmieniona','success');loadUsers();}catch(e){toast(e.message,'error');}}

async function loadAdminOffers(){
  const search=document.getElementById('off-search')?.value||'';
  try{const data=await api('GET',`/admin/offers?search=${encodeURIComponent(search)}&status=active`);
    document.getElementById('offers-table').innerHTML=`
      <table class="data-table"><thead><tr><th>ID</th><th>Tytuł</th><th>Serwer</th><th>Sprzedawca</th><th>Status</th><th>Akcje</th></tr></thead>
      <tbody>${data.offers.map(o=>`<tr>
        <td>${o.id}</td>
        <td><a href="#" onclick="navigate('offer',{id:${o.id}});return false">${esc(o.title)}</a></td>
        <td style="font-size:12px;color:var(--text3)">${esc(o.server_name||'—')}</td>
        <td>${esc(o.seller_name)}</td>
        <td><span class="status-pill status-${o.status==='active'?'completed':'cancelled'}">${o.status}</span></td>
        <td><button class="btn btn-red btn-sm" onclick="adminDelOffer(${o.id})">🗑 Usuń</button></td>
      </tr>`).join('')}</tbody></table>
      <div style="color:var(--text3);font-size:13px;margin-top:8px">Łącznie: ${data.total}</div>`;}
  catch{document.getElementById('offers-table').innerHTML='<div class="empty">Błąd</div>';}
}

async function adminDelOffer(id){if(!confirm('Usunąć ogłoszenie?'))return;try{await api('DELETE',`/admin/offers/${id}`);toast('Usunięto','success');loadAdminOffers();}catch(e){toast(e.message,'error');}}
async function addServer(){const name=document.getElementById('nsrv-name')?.value;const slug=document.getElementById('nsrv-slug')?.value;const rates=document.getElementById('nsrv-rates')?.value;const desc=document.getElementById('nsrv-desc')?.value;if(!name||!slug)return toast('Nazwa i slug wymagane','error');try{await api('POST','/servers',{name,slug,rates,description:desc});toast('Serwer dodany!','success');await loadServers();loadAdminTab('servers');}catch(e){toast(e.message,'error');}}
async function toggleServer(id){try{const r=await api('PATCH',`/servers/${id}/toggle`);toast(r.message,'success');await loadServers();loadAdminTab('servers');}catch(e){toast(e.message,'error');}}

// ===== MESSAGES =====
let activeConv=null;
async function renderMessages(userId,inAccount=false,inAdmin=false){
  if(!me){showModal('login');return;}
  if(!inAccount&&!inAdmin){document.getElementById('app').innerHTML=`<div class="page"><button class="back-btn" onclick="navigate('home')">← Wróć</button><div id="msgs-wrap"></div></div>`;}
  const container=inAccount||inAdmin?document.getElementById(inAdmin?'admin-content':'account-content'):document.getElementById('msgs-wrap');
  if(!container)return;
  container.innerHTML='<div class="loading"><div class="spinner"></div></div>';
  try{const convs=await api('GET','/messages/inbox');
    activeConv=userId?Number(userId):(convs[0]?.other_id||null);
    container.innerHTML=`${inAccount||inAdmin?'<div class="panel-title">💬 Wiadomości</div>':''}<div class="messages-grid">
      <div class="conv-list" id="conv-list">
        ${convs.length?convs.map(c=>`<div class="conv-item${activeConv===c.other_id?' active':''}" onclick="openConv(${c.other_id})" data-uid="${c.other_id}">
          <div class="conv-name">🧙 ${esc(c.other_username)}${c.unread>0?`<span class="conv-unread">${c.unread}</span>`:''}</div>
          <div class="conv-preview">${esc(c.last_body||'')}</div>
        </div>`).join(''):'<div style="padding:20px;color:var(--text3);font-size:13px">Brak wiadomości</div>'}
      </div>
      <div id="chat-panel" class="chat-area">${activeConv?'':'<div class="chat-empty">Wybierz rozmowę</div>'}</div>
    </div>`;
    if(activeConv)loadConv(activeConv);pollMessages();}
  catch{container.innerHTML='<div class="empty">Błąd</div>';}
}

async function openConv(uid){activeConv=uid;document.querySelectorAll('.conv-item').forEach(el=>el.classList.toggle('active',Number(el.dataset.uid)===uid));loadConv(uid);}

async function loadConv(uid){
  const panel=document.getElementById('chat-panel');if(!panel)return;
  panel.innerHTML='<div class="loading"><div class="spinner"></div></div>';
  try{const data=await api('GET',`/messages/conversation/${uid}`);
    panel.innerHTML=`<div class="chat-header">💬 ${esc(data.other?.username||'')}</div>
      <div class="chat-messages" id="chat-msgs">
        ${data.messages.map(m=>{const mine=m.from_id===me.id;return`<div><div class="msg-bubble ${mine?'mine':'theirs'}">${esc(m.body)}</div><div class="msg-time" style="${mine?'text-align:right':''}">${timeAgo(m.created_at*1000)}</div></div>`;}).join('')}
        ${!data.messages.length?'<div style="color:var(--text3);text-align:center;padding:20px">Wyślij pierwszą wiadomość</div>':''}
      </div>
      <div class="chat-input-row"><input type="text" id="msg-input" placeholder="Napisz wiadomość..." onkeydown="if(event.key==='Enter')sendMsg(${uid})"><button class="btn btn-gold btn-sm" onclick="sendMsg(${uid})">Wyślij</button></div>`;
    const msgs=document.getElementById('chat-msgs');if(msgs)msgs.scrollTop=msgs.scrollHeight;pollMessages();}
  catch{panel.innerHTML='<div class="chat-empty">Błąd</div>';}
}

async function sendMsg(toId){const input=document.getElementById('msg-input');const body=input?.value?.trim();if(!body)return;try{await api('POST','/messages/send',{to_id:toId,body});input.value='';loadConv(toId);}catch(e){toast(e.message,'error');}}

// ===== PROFILE =====
async function renderProfile(id){
  document.getElementById('app').innerHTML='<div class="page"><div class="loading"><div class="spinner"></div></div></div>';
  try{const u=await api('GET',`/auth/user/${id}`);
    document.getElementById('app').innerHTML=`<div class="page">
      <button class="back-btn" onclick="history.back()">← Wróć</button>
      <div class="profile-header">
        <div class="profile-avatar" style="overflow:hidden">${avatarHtml(u.avatar,u.role,72)}</div>
        <div>
          <div class="profile-name">${esc(u.username)} ${u.role!=='user'?`<span class="role-pill role-${u.role}">${u.role}</span>`:''}</div>
          <div class="stars">${starStr(u.rating)} ${fmtRating(u.rating)} (${u.rating_count||0} opinii)</div>
          <div class="profile-since">Od ${new Date(u.created_at*1000).getFullYear()} · ${u.total_sales||0} transakcji</div>
          ${u.discord?`<div style="font-size:13px;color:var(--text2);margin-top:4px">Discord: ${esc(u.discord)}</div>`:''}
        </div>
        ${me&&me.id!==u.id?`<button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="navigate('messages',{userId:${u.id}})">💬 Wiadomość</button>`:''}
      </div>
      ${u.bio?`<div style="padding:16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);margin-bottom:20px">${esc(u.bio)}</div>`:''}
      <div class="section-title">📋 Ogłoszenia</div>${offerCards(u.offers)}
      <div class="section-title" style="margin-top:24px">⭐ Opinie</div>
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:16px">
        ${u.reviews.length?u.reviews.map(r=>`<div class="review-item"><div class="review-author"><span class="stars">${starStr(r.rating)}</span> · ${esc(r.reviewer_name)}</div>${r.comment?`<div class="review-text">${esc(r.comment)}</div>`:''}</div>`).join(''):'<div style="color:var(--text3)">Brak opinii</div>'}
      </div>
    </div>`;}
  catch{document.getElementById('app').innerHTML='<div class="page"><div class="empty"><span class="empty-icon">⚠️</span><h3>Profil nie istnieje</h3></div></div>';}
}

// ===== VERIFY / RESET =====
async function verifyEmail(tok){
  document.getElementById('app').innerHTML='<div class="page"><div class="loading"><div class="spinner"></div><br>Weryfikacja...</div></div>';
  try{const r=await api('GET',`/auth/verify?token=${tok}`);document.getElementById('app').innerHTML=`<div class="page"><div class="empty"><span class="empty-icon">✅</span><h3>${r.message}</h3><button class="btn btn-gold" onclick="showModal('login')">Zaloguj się</button></div></div>`;}
  catch(e){document.getElementById('app').innerHTML=`<div class="page"><div class="empty"><span class="empty-icon">❌</span><h3>${e.message}</h3></div></div>`;}
}

function renderResetPassword(tok){
  document.getElementById('app').innerHTML=`<div style="max-width:420px;margin:80px auto;padding:20px">
    <div class="account-panel"><div class="panel-title">🔑 Nowe hasło</div>
    <div class="form-group"><label class="form-label">Nowe hasło *</label><input type="password" id="rp-p" placeholder="Min. 6 znaków"></div>
    <div class="form-group"><label class="form-label">Powtórz *</label><input type="password" id="rp-p2" onkeydown="if(event.key==='Enter')doReset('${tok}')"></div>
    <button class="btn btn-gold btn-full" onclick="doReset('${tok}')">💾 Zmień hasło</button></div></div>`;
}

async function doReset(tok){const p=document.getElementById('rp-p')?.value;const p2=document.getElementById('rp-p2')?.value;if(!p||p.length<6)return toast('Min. 6 znaków','error');if(p!==p2)return toast('Hasła się nie zgadzają','error');try{const r=await api('POST','/auth/reset-password',{token:tok,password:p});toast(r.message,'success');navigate('home');showModal('login');}catch(e){toast(e.message,'error');}}

// ===== MODALS =====
function showModal(type){
  const ov=document.getElementById('modal-overlay');const box=document.getElementById('modal-box');
  ov.classList.add('open');box.classList.add('open');
  const orn=(icon)=>`<div class="ornament"><div class="orn-line"></div><span class="orn-icon">${icon}</span><div class="orn-line" style="background:linear-gradient(270deg,transparent,var(--border2))"></div></div>`;
  if(type==='login'){box.innerHTML=`<div class="modal" style="position:relative"><button class="modal-close" onclick="closeModal()">✕</button>${orn('⚔️')}<div class="modal-title">Zaloguj się</div><div class="modal-sub">Witaj wojowniku!</div><div class="form-group"><label class="form-label">Email</label><input type="email" id="l-email" placeholder="twoj@email.pl"></div><div class="form-group"><label class="form-label">Hasło</label><input type="password" id="l-pass" onkeydown="if(event.key==='Enter')doLogin()"></div><button class="btn btn-gold btn-full" onclick="doLogin()">ZALOGUJ</button><div class="modal-foot"><a href="#" onclick="showModal('forgot')">Zapomniałem hasła</a></div><div class="modal-foot">Nie masz konta? <a href="#" onclick="showModal('register')">Zarejestruj się</a></div></div>`;}
  else if(type==='register'){box.innerHTML=`<div class="modal" style="position:relative"><button class="modal-close" onclick="closeModal()">✕</button>${orn('🐉')}<div class="modal-title">Rejestracja</div><div class="modal-sub">Dołącz do MT2Market</div><div class="form-group"><label class="form-label">Nazwa gracza *</label><input type="text" id="r-user" placeholder="TwojaPostac"></div><div class="form-group"><label class="form-label">Email *</label><input type="email" id="r-email" placeholder="twoj@email.pl"></div><div class="form-group"><label class="form-label">Hasło *</label><input type="password" id="r-pass" placeholder="Min. 6 znaków" onkeydown="if(event.key==='Enter')doRegister()"></div><button class="btn btn-gold btn-full" onclick="doRegister()">ZAREJESTRUJ</button><div class="modal-foot">Masz konto? <a href="#" onclick="showModal('login')">Zaloguj się</a></div></div>`;}
  else if(type==='forgot'){box.innerHTML=`<div class="modal" style="position:relative"><button class="modal-close" onclick="closeModal()">✕</button><div class="modal-title">🔑 Reset hasła</div><div class="modal-sub">Wyślemy Ci link na email</div><div class="form-group"><label class="form-label">Email</label><input type="email" id="fp-email" onkeydown="if(event.key==='Enter')doForgot()"></div><button class="btn btn-gold btn-full" onclick="doForgot()">WYŚLIJ LINK</button><div class="modal-foot"><a href="#" onclick="showModal('login')">← Wróć</a></div></div>`;}
}

function closeModal(){document.getElementById('modal-overlay')?.classList.remove('open');document.getElementById('modal-box')?.classList.remove('open');}

async function doLogin(){const email=document.getElementById('l-email')?.value;const password=document.getElementById('l-pass')?.value;try{const d=await api('POST','/auth/login',{email,password});token=d.token;me={id:d.id,username:d.username,role:d.role};localStorage.setItem('ph_token',token);localStorage.setItem('ph_me',JSON.stringify(me));updateHeaderUI();closeModal();pollMessages();toast(`⚔️ Witaj, ${d.username}!`,'success');if(d.role==='admin'||d.role==='tutor')toast(`Panel admina dostępny w menu konta`,'success');}catch(e){toast(e.message,'error');}}
async function doRegister(){const username=document.getElementById('r-user')?.value?.trim();const email=document.getElementById('r-email')?.value?.trim();const password=document.getElementById('r-pass')?.value;if(!username||!email||!password)return toast('Wypełnij wszystkie pola','error');try{const r=await api('POST','/auth/register',{username,email,password});toast(r.message,'success');closeModal();}catch(e){toast(e.message,'error');}}
async function doForgot(){const email=document.getElementById('fp-email')?.value?.trim();if(!email)return toast('Podaj email','error');try{const r=await api('POST','/auth/forgot-password',{email});toast(r.message,'success');closeModal();}catch(e){toast(e.message,'error');}}

// ===== HELPERS =====
function toast(msg,type=''){const c=document.getElementById('toast-container');const el=document.createElement('div');el.className='toast'+(type?' '+type:'');el.textContent=msg;c.appendChild(el);setTimeout(()=>el.remove(),4000);}
function fmtPrice(n){if(n==null)return'—';return Number(n).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtRating(r){return r?Number(r).toFixed(1):'—';}
function starStr(r){const n=Math.round(r||0);return'★'.repeat(n)+'☆'.repeat(5-n);}
function timeLeft(ts){const d=ts-Date.now();if(d<=0)return'Zakończona';const h=Math.floor(d/3600000);const m=Math.floor((d%3600000)/60000);const s=Math.floor((d%60000)/1000);if(h>24)return`${Math.floor(h/24)}d ${h%24}h`;if(h>0)return`${h}h ${m}m`;return`${m}m ${s}s`;}
function timeAgo(ts){const d=Date.now()-ts;if(d<60000)return'przed chwilą';if(d<3600000)return`${Math.floor(d/60000)} min temu`;if(d<86400000)return`${Math.floor(d/3600000)} godz temu`;return new Date(ts).toLocaleDateString('pl-PL');}
function safeJson(s,d){try{return JSON.parse(s);}catch{return d;}}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function catEmoji(slug){const m={postac:'🧙',bron:'⚔️',zbroja:'🛡️',helm:'⛑️',buty:'👟',tarcza:'🔰',kolczyki:'💎',bransoletka:'📿',naszyjnik:'🔮'};return m[slug]||'📦';}

function roleIcon(role){return role==='admin'?'👑':role==='tutor'?'🛡️':'🧙';}
function roleBadge(role){if(!role||role==='user')return'';return`<span class="role-badge role-badge-${role}">${role==='admin'?'👑 Admin':'🛡️ TuT'}</span>`;}
function avatarHtml(avatar,role,size=36){if(avatar)return`<img src="${avatar}" class="user-avatar" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid var(--border2);">`;return`<span style="font-size:${size*0.6}px">${roleIcon(role)}</span>`;}
