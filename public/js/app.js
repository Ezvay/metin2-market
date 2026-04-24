// ===== STATE =====
let token = localStorage.getItem('ph_token') || null;
let me = JSON.parse(localStorage.getItem('ph_me') || 'null');
let categories = [];
let msgPollInterval = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  initParticles();
  updateHeaderUI();
  await loadCategories();
  handleRouteFromUrl();
  if (me) pollMessages();

  // Handle browser back/forward
  window.addEventListener('popstate', handleRouteFromUrl);
});

function handleRouteFromUrl() {
  const params = new URLSearchParams(location.search);
  const page = params.get('p') || 'home';
  const id = params.get('id');
  const token = params.get('token');

  if (page === 'verify' && token) { verifyEmail(token); return; }
  if (page === 'reset-password' && token) { navigate('reset-password', { token }); return; }
  navigate(page, id ? { id } : {}, true);
}

function setUrl(page, params = {}) {
  const p = new URLSearchParams({ p: page, ...params });
  history.pushState({}, '', '?' + p.toString());
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

// ===== CATEGORIES =====
async function loadCategories() {
  try { categories = await api('GET', '/categories'); } catch {}
}

function catEmoji(slug) {
  const m = { postac:'🧙', bron:'⚔️', zbroja:'🛡️', helm:'⛑️', buty:'👟', tarcza:'🔰', kolczyki:'💎', bransoletka:'📿', naszyjnik:'🔮' };
  return m[slug] || '📦';
}

// ===== AUTH UI =====
function updateHeaderUI() {
  const authBtns = document.getElementById('auth-buttons');
  const userNav = document.getElementById('user-nav');
  const navUsername = document.getElementById('nav-username');
  if (me && token) {
    authBtns.style.display = 'none';
    userNav.style.display = 'flex';
    navUsername.textContent = me.username;
  } else {
    authBtns.style.display = 'flex';
    userNav.style.display = 'none';
  }
}

function logout() {
  token = null; me = null;
  localStorage.removeItem('ph_token'); localStorage.removeItem('ph_me');
  if (msgPollInterval) clearInterval(msgPollInterval);
  updateHeaderUI();
  navigate('home');
  toast('Wylogowano');
}

function pollMessages() {
  const check = async () => {
    try {
      const data = await api('GET', '/messages/unread');
      const badge = document.getElementById('msg-badge');
      if (badge) {
        if (data.count > 0) { badge.textContent = data.count; badge.style.display = 'flex'; }
        else badge.style.display = 'none';
      }
    } catch {}
  };
  check();
  msgPollInterval = setInterval(check, 30000);
}

// ===== NAVIGATION =====
function navigate(page, params = {}, noHistory = false) {
  closeModal();
  if (!noHistory) setUrl(page, params);
  const app = document.getElementById('app');
  switch (page) {
    case 'home': renderHome(); break;
    case 'offers': renderOffers(params); break;
    case 'offer': renderOffer(params.id); break;
    case 'add-offer': renderAddOffer(); break;
    case 'account': renderAccount(params.tab || 'dashboard'); break;
    case 'messages': renderMessages(params.userId); break;
    case 'profile': renderProfile(params.id); break;
    case 'reset-password': renderResetPassword(params.token); break;
    default: renderHome();
  }
}

// ===== HOME =====
function renderHome() {
  document.getElementById('app').innerHTML = `
    <section class="hero">
      <div class="hero-eyebrow">⚔️ PROJEKT HARD — OFICJALNY MARKETPLACE</div>
      <h1>Kup i sprzedaj<br><span>przedmioty z Projekt Hard</span></h1>
      <p>Licytacje, sprzedaż bezpośrednia i bezpieczne transakcje z TuTorem. Tylko sprawdzeni gracze.</p>
      <div class="hero-search">
        <input id="hero-q" placeholder="Szukaj broni, zbroi, postaci..." onkeydown="if(event.key==='Enter')doSearch()">
        <button onclick="doSearch()">🔍 SZUKAJ</button>
      </div>
      <div class="hero-stats">
        <div><span class="stat-num" id="stat-count">—</span><span class="stat-label">Ogłoszeń</span></div>
        <div><span class="stat-num">🛡️</span><span class="stat-label">TuTor dostępny</span></div>
        <div><span class="stat-num">100%</span><span class="stat-label">Projekt Hard</span></div>
      </div>
    </section>
    <div class="divider"></div>
    <div class="section">
      <div class="section-title">⚡ Kategorie</div>
      <div class="cat-grid">${categories.map(c => `
        <div class="cat-card" onclick="navigate('offers',{category:'${c.slug}'})">
          <span class="cat-icon">${c.icon}</span>
          <span class="cat-name">${c.name}</span>
        </div>`).join('')}
      </div>
    </div>
    <div class="section" style="padding-top:0">
      <div class="section-title">🔥 Najnowsze ogłoszenia</div>
      <div id="home-offers"><div class="loading"><div class="spinner"></div><br>Ładowanie...</div></div>
      <div class="section-title" style="margin-top:32px">⏰ Kończące się licytacje</div>
      <div id="home-auctions"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  loadHomeOffers();
}

function doSearch() {
  const q = document.getElementById('hero-q')?.value?.trim();
  navigate('offers', q ? { search: q } : {});
}

async function loadHomeOffers() {
  try {
    const [latest, auctions] = await Promise.all([
      api('GET', '/offers?limit=8&sort=newest'),
      api('GET', '/offers?type=auction&sort=ending&limit=4')
    ]);
    document.getElementById('stat-count').textContent = latest.total;
    document.getElementById('home-offers').innerHTML = offerCards(latest.offers);
    document.getElementById('home-auctions').innerHTML = offerCards(auctions.offers);
  } catch {
    document.getElementById('home-offers').innerHTML = '<div class="empty"><span class="empty-icon">⚔️</span><h3>Brak ogłoszeń</h3></div>';
    document.getElementById('home-auctions').innerHTML = '';
  }
}

// ===== OFFERS LIST =====
let offerFilters = {};

async function renderOffers(params = {}) {
  offerFilters = { sort: 'newest', ...params };
  document.getElementById('app').innerHTML = `
    <div class="page">
      <button class="back-btn" onclick="navigate('home')">← Strona główna</button>
      <div class="offers-layout">
        <aside>
          <div class="sidebar-box">
            <div class="sidebar-label">Kategoria</div>
            ${categories.map(c => `<div class="filter-item" data-cat="${c.slug}" onclick="setFilter('category','${c.slug}')">${c.icon} ${c.name}</div>`).join('')}
          </div>
        </aside>
        <div>
          <div class="type-tabs">
            <button class="type-tab active" data-type="" onclick="setFilter('type','')">Wszystkie</button>
            <button class="type-tab" data-type="buy_now" onclick="setFilter('type','buy_now')">🛒 Kup teraz</button>
            <button class="type-tab" data-type="auction" onclick="setFilter('type','auction')">⏰ Licytacje</button>
          </div>
          <div class="offers-toolbar">
            <span class="offers-count" id="offers-count">Ładowanie...</span>
            <div class="toolbar-right">
              <input type="text" id="search-q" placeholder="Szukaj..." value="${params.search||''}" style="width:180px;padding:7px 12px;font-size:13px" onkeydown="if(event.key==='Enter')applySearch()">
              <select class="filter-select" id="sort-sel" onchange="setFilter('sort',this.value)">
                <option value="newest">Najnowsze</option>
                <option value="cheapest">Najtańsze</option>
                <option value="expensive">Najdroższe</option>
                <option value="popular">Popularne</option>
                <option value="ending">Kończące się</option>
              </select>
            </div>
          </div>
          <div id="offers-out"><div class="loading"><div class="spinner"></div></div></div>
          <div id="pager-out"></div>
        </div>
      </div>
    </div>
  `;
  if (params.category) setActiveFilter('[data-cat]', params.category);
  fetchOffers();
}

function setFilter(key, val) {
  if (key === 'type') {
    offerFilters.type = val || undefined;
    document.querySelectorAll('.type-tab').forEach(t => t.classList.toggle('active', t.dataset.type === val));
  }
  if (key === 'category') {
    const same = offerFilters.category === val;
    offerFilters.category = same ? undefined : val;
    document.querySelectorAll('[data-cat]').forEach(el => el.classList.toggle('active', el.dataset.cat === offerFilters.category));
  }
  if (key === 'sort') offerFilters.sort = val;
  offerFilters.page = 1;
  fetchOffers();
}

function applySearch() {
  offerFilters.search = document.getElementById('search-q')?.value || '';
  offerFilters.page = 1;
  fetchOffers();
}

function setActiveFilter(selector, val) {
  document.querySelectorAll(selector).forEach(el => el.classList.toggle('active', el.dataset.cat === val));
}

async function fetchOffers() {
  const f = offerFilters;
  const p = new URLSearchParams();
  if (f.category) p.set('category', f.category);
  if (f.type) p.set('type', f.type);
  if (f.search) p.set('search', f.search);
  if (f.sort) p.set('sort', f.sort);
  p.set('page', f.page || 1); p.set('limit', 12);

  const out = document.getElementById('offers-out');
  if (out) out.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', '/offers?' + p);
    const countEl = document.getElementById('offers-count');
    if (countEl) countEl.textContent = `${data.total} ogłoszeń`;
    if (out) out.innerHTML = data.offers.length ? offerCards(data.offers) : '<div class="empty"><span class="empty-icon">🔍</span><h3>Brak wyników</h3></div>';
    renderPager(data.page, data.pages);
  } catch {
    if (out) out.innerHTML = '<div class="empty"><span class="empty-icon">⚠️</span><h3>Błąd ładowania</h3></div>';
  }
}

function renderPager(cur, total) {
  const el = document.getElementById('pager-out');
  if (!el || total <= 1) return;
  let h = '<div class="pagination">';
  if (cur > 1) h += `<button class="pager" onclick="goPage(${cur-1})">←</button>`;
  for (let i = Math.max(1,cur-2); i <= Math.min(total,cur+2); i++)
    h += `<button class="pager${i===cur?' active':''}" onclick="goPage(${i})">${i}</button>`;
  if (cur < total) h += `<button class="pager" onclick="goPage(${cur+1})">→</button>`;
  el.innerHTML = h + '</div>';
}

function goPage(p) { offerFilters.page = p; fetchOffers(); window.scrollTo(0,0); }

// ===== OFFER CARDS =====
function offerCards(list) {
  if (!list?.length) return '<div class="empty"><span class="empty-icon">⚔️</span><h3>Brak ogłoszeń</h3></div>';
  return `<div class="offers-grid">${list.map(o => {
    const imgs = safeJson(o.images, []);
    const emoji = catEmoji(o.category_slug);
    const isAuction = o.type === 'auction';
    const price = isAuction ? (o.auction_current || o.auction_start) : o.price;
    const bids = o.bid_count || 0;
    const endTs = o.auction_end ? o.auction_end * 1000 : null;
    const endStr = endTs ? timeLeft(endTs) : '';
    return `
      <div class="offer-card" onclick="navigate('offer',{id:${o.id}})">
        <div class="offer-img">
          ${imgs[0] ? `<img src="${imgs[0]}" alt="${esc(o.title)}">` : emoji}
          <span class="offer-type-badge ${isAuction?'badge-auction':'badge-buy'}">${isAuction?'⏰ LICYTACJA':'🛒 KUP TERAZ'}</span>
        </div>
        <div class="offer-body">
          <div class="offer-cat">${o.category_name||''}</div>
          <div class="offer-title">${esc(o.title)}</div>
          <div class="offer-footer">
            <div>
              <div class="offer-price">${fmtPrice(price)} <small>PLN</small></div>
              ${isAuction ? `<div class="auction-end">${bids} ofert${bids===1?'a':bids<5?'y':''}${endStr?' · '+endStr:''}</div>` : ''}
            </div>
            <div class="offer-meta2">🧙 ${esc(o.seller_name)}</div>
          </div>
        </div>
      </div>`;
  }).join('')}</div>`;
}

// ===== OFFER DETAIL =====
async function renderOffer(id) {
  document.getElementById('app').innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div><br>Ładowanie...</div></div>';
  try {
    const o = await api('GET', `/offers/${id}`);
    const imgs = safeJson(o.images, []);
    const isAuction = o.type === 'auction';
    const price = isAuction ? (o.auction_current || o.auction_start) : o.price;
    const stars = starStr(o.seller_rating);
    const endTs = o.auction_end ? o.auction_end * 1000 : null;

    document.getElementById('app').innerHTML = `
      <div class="page">
        <button class="back-btn" onclick="navigate('offers')">← Wróć do ogłoszeń</button>
        <div class="detail-grid">
          <div>
            <div class="main-img" id="main-img">
              ${imgs[0] ? `<img src="${imgs[0]}" id="main-img-el">` : catEmoji(o.category_slug)}
            </div>
            ${imgs.length > 1 ? `<div class="thumb-row">${imgs.map((u,i) => `<div class="thumb${i===0?' active':''}" onclick="switchImg('${u}',this)"><img src="${u}"></div>`).join('')}</div>` : ''}
            <h1 class="detail-title" style="margin-top:18px">${esc(o.title)}</h1>
            <div class="detail-meta">
              ${o.category_name ? `<span class="meta-pill">📂 ${o.category_name}</span>` : ''}
              <span class="meta-pill">${isAuction?'⏰ Licytacja':'🛒 Kup teraz'}</span>
              <span class="meta-pill">👁️ ${o.views}</span>
            </div>
            <div class="detail-desc">${o.description ? esc(o.description).replace(/\n/g,'<br>') : '<em style="color:var(--text3)">Brak opisu.</em>'}</div>

            ${isAuction && o.bids?.length ? `
              <div style="margin-top:24px">
                <div class="sidebar-box-title">Historia licytacji</div>
                <div class="bids-list">${o.bids.map(b=>`
                  <div class="bid-item">
                    <span class="bid-user">🧙 ${esc(b.username)}</span>
                    <span class="bid-amount">${fmtPrice(b.amount)} PLN</span>
                  </div>`).join('')}
                </div>
              </div>` : ''}
          </div>

          <div>
            <div class="sidebar-box">
              <div class="sidebar-box-title">${isAuction ? 'Aktualna oferta' : 'Cena'}</div>
              <div class="price-big">${fmtPrice(price)} PLN</div>
              ${isAuction && endTs ? `<div class="auction-timer" id="auction-timer">${timeLeft(endTs)}</div>` : ''}
              ${isAuction ? `
                <div class="price-sub">Minimalna kolejna oferta: <strong>${fmtPrice((price||0)+0.01)} PLN</strong></div>
                ${me && me.id !== o.seller_id ? `
                  <div class="bid-row">
                    <input type="number" id="bid-amount" placeholder="Twoja oferta w PLN" step="0.01" min="${(price||0)+0.01}">
                    <button class="btn btn-gold" onclick="placeBid(${o.id})">Licytuj</button>
                  </div>` : (!me ? `<button class="btn btn-ghost btn-full" onclick="showModal('login')">Zaloguj się by licytować</button>` : '')}
              ` : `
                ${me && me.id !== o.seller_id ? `<button class="btn btn-gold btn-full btn-lg" onclick="buyNow(${o.id}, ${o.seller_id})">🛒 KUP TERAZ</button>` : (!me ? `<button class="btn btn-gold btn-full btn-lg" onclick="showModal('login')">🛒 Zaloguj się</button>` : '<div style="color:var(--text3);font-size:13px;text-align:center">To Twoje ogłoszenie</div>')}
              `}
            </div>

            <div class="sidebar-box">
              <div class="sidebar-box-title">Sprzedawca</div>
              <div class="seller-row">
                <div class="seller-avatar">🧙</div>
                <div>
                  <div class="seller-name"><a href="#" onclick="navigate('profile',{id:${o.seller_id}});return false;">${esc(o.seller_name)}</a></div>
                  <div class="seller-stats-row">
                    <span class="stars">${stars}</span>
                    <span>${o.total_sales||0} sprzedaży</span>
                  </div>
                </div>
              </div>
              ${me && me.id !== o.seller_id ? `<button class="btn btn-ghost btn-full btn-sm" onclick="navigate('messages',{userId:${o.seller_id}})">💬 Wyślij wiadomość</button>` : ''}
            </div>

            ${me && me.id !== o.seller_id ? `
            <div class="tutor-box">
              <div class="tutor-title">🛡️ Wynajmij TuTora — bezpieczna transakcja</div>
              <div class="tutor-desc">TuTor pośredniczy w transakcji i gwarantuje jej bezpieczeństwo.<br><strong style="color:var(--gold2)">Koszt: 20 PLN</strong> — płatne przez kupującego.</div>
              <div id="tutor-payment" style="margin-bottom:10px">
                <div style="font-size:12px;color:var(--text3);margin-bottom:6px;font-family:var(--font-d)">METODA PŁATNOŚCI:</div>
                <div class="payment-btns">
                  <div class="pay-btn" id="pay-blik" onclick="selectPayment('blik')">💳 BLIK</div>
                  <div class="pay-btn" id="pay-revolut" onclick="selectPayment('revolut')">💸 Revolut</div>
                </div>
              </div>
              <button class="btn btn-green btn-full btn-sm" onclick="requestTutor(${o.id})">🛡️ Zamów TuTora</button>
            </div>` : ''}
          </div>
        </div>
      </div>
    `;

    // Start auction timer
    if (isAuction && endTs) {
      const timerEl = document.getElementById('auction-timer');
      if (timerEl) {
        const iv = setInterval(() => {
          const tl = timeLeft(endTs);
          if (timerEl) { timerEl.textContent = tl; if (endTs - Date.now() < 3600000) timerEl.classList.add('ending'); }
          else clearInterval(iv);
        }, 1000);
      }
    }
  } catch (e) {
    document.getElementById('app').innerHTML = `<div class="page"><div class="empty"><span class="empty-icon">⚠️</span><h3>${e.message}</h3></div></div>`;
  }
}

function switchImg(url, el) {
  const main = document.getElementById('main-img');
  if (main) main.innerHTML = `<img src="${url}">`;
  document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

let selectedPayment = null;
function selectPayment(method) {
  selectedPayment = method;
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('pay-' + method)?.classList.add('selected');
}

async function requestTutor(offerId) {
  if (!me) return showModal('login');
  if (!selectedPayment) return toast('Wybierz metodę płatności', 'error');
  try {
    const r = await api('POST', '/tutor/request', { offer_id: offerId, payment_method: selectedPayment });
    toast(`${r.message} Koszt: ${r.price} PLN`, 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function placeBid(offerId) {
  if (!me) return showModal('login');
  const amount = parseFloat(document.getElementById('bid-amount')?.value);
  if (!amount || amount <= 0) return toast('Podaj kwotę', 'error');
  try {
    const r = await api('POST', `/offers/${offerId}/bid`, { amount });
    toast(r.message, 'success');
    renderOffer(offerId);
  } catch (e) { toast(e.message, 'error'); }
}

function buyNow(offerId, sellerId) {
  if (!me) return showModal('login');
  navigate('messages', { userId: sellerId, offerId });
  toast('Wiadomość do sprzedawcy — ustalcie szczegóły transakcji');
}

// ===== ADD OFFER =====
function renderAddOffer() {
  if (!me) { showModal('login'); toast('Zaloguj się, aby wystawić ogłoszenie', 'error'); return; }
  document.getElementById('app').innerHTML = `
    <div class="add-page">
      <button class="back-btn" onclick="navigate('home')">← Wróć</button>
      <h1 class="page-title">➕ Wystaw przedmiot</h1>
      <p class="page-sub">Serwer: <strong style="color:var(--gold2)">Projekt Hard</strong></p>

      <div class="form-group">
        <label class="form-label">Typ ogłoszenia *</label>
        <div class="type-select">
          <div class="type-opt selected" id="opt-buy_now" onclick="selectType('buy_now')">
            <span class="type-opt-icon">🛒</span>
            <div class="type-opt-name">Kup teraz</div>
            <div class="type-opt-desc">Stała cena</div>
          </div>
          <div class="type-opt" id="opt-auction" onclick="selectType('auction')">
            <span class="type-opt-icon">⏰</span>
            <div class="type-opt-name">Licytacja</div>
            <div class="type-opt-desc">Cena rośnie</div>
          </div>
        </div>
        <input type="hidden" id="f-type" value="buy_now">
      </div>

      <div class="form-group">
        <label class="form-label">Kategoria *</label>
        <select id="f-cat">
          <option value="">— Wybierz kategorię —</option>
          ${categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Tytuł ogłoszenia *</label>
        <input type="text" id="f-title" placeholder="np. Smocza Broń +9 Full Opcja">
      </div>

      <div id="buynow-field" class="form-group">
        <label class="form-label">Cena (PLN) *</label>
        <input type="number" id="f-price" placeholder="49.99" min="0.01" step="0.01">
      </div>

      <div id="auction-fields">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Cena startowa (PLN) *</label>
            <input type="number" id="f-start" placeholder="5.00" min="0.01" step="0.01">
          </div>
          <div class="form-group">
            <label class="form-label">Koniec aukcji *</label>
            <input type="datetime-local" id="f-end">
          </div>
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
    </div>
  `;
  // Set min datetime for auction end
  const dt = document.getElementById('f-end');
  if (dt) { const n = new Date(); n.setHours(n.getHours()+1); dt.min = n.toISOString().slice(0,16); }
}

function selectType(type) {
  document.getElementById('f-type').value = type;
  document.querySelectorAll('.type-opt').forEach(el => el.classList.remove('selected'));
  document.getElementById('opt-' + type)?.classList.add('selected');
  document.getElementById('buynow-field').style.display = type === 'buy_now' ? 'block' : 'none';
  document.getElementById('auction-fields').style.display = type === 'auction' ? 'block' : 'none';
}

function previewImages(input) {
  const prev = document.getElementById('img-preview');
  if (!prev) return;
  prev.innerHTML = '';
  Array.from(input.files).slice(0,5).forEach(f => {
    const r = new FileReader();
    r.onload = e => {
      const d = document.createElement('div'); d.className = 'img-prev-item';
      d.innerHTML = `<img src="${e.target.result}">`;
      prev.appendChild(d);
    };
    r.readAsDataURL(f);
  });
}

async function submitOffer() {
  const type = document.getElementById('f-type')?.value;
  const title = document.getElementById('f-title')?.value?.trim();
  const cat = document.getElementById('f-cat')?.value;
  const desc = document.getElementById('f-desc')?.value?.trim();
  const files = document.getElementById('f-imgs')?.files;

  if (!title) return toast('Wpisz tytuł', 'error');
  if (!cat) return toast('Wybierz kategorię', 'error');

  const fd = new FormData();
  fd.append('title', title);
  fd.append('description', desc || '');
  fd.append('category_id', cat);
  fd.append('type', type);

  if (type === 'buy_now') {
    const price = parseFloat(document.getElementById('f-price')?.value);
    if (!price || price <= 0) return toast('Podaj prawidłową cenę', 'error');
    fd.append('price', price);
  } else {
    const start = parseFloat(document.getElementById('f-start')?.value);
    const end = document.getElementById('f-end')?.value;
    if (!start || start <= 0) return toast('Podaj cenę startową', 'error');
    if (!end) return toast('Podaj datę zakończenia', 'error');
    fd.append('auction_start', start);
    fd.append('auction_end', end);
  }

  if (files) Array.from(files).slice(0,5).forEach(f => fd.append('images', f));

  try {
    const btn = document.querySelector('.add-page .btn-gold');
    if (btn) { btn.disabled = true; btn.textContent = 'Dodawanie...'; }
    const r = await api('POST', '/offers', fd, true);
    toast('Ogłoszenie dodane!', 'success');
    navigate('offer', { id: r.id });
  } catch (e) {
    toast(e.message, 'error');
    const btn = document.querySelector('.add-page .btn-gold');
    if (btn) { btn.disabled = false; btn.textContent = '⚔️ OPUBLIKUJ OGŁOSZENIE'; }
  }
}

// ===== ACCOUNT =====
async function renderAccount(tab = 'dashboard') {
  if (!me) { showModal('login'); return; }
  document.getElementById('app').innerHTML = `
    <div class="page">
      <div class="account-grid">
        <aside>
          <div class="sidebar-box">
            <div style="text-align:center;padding:8px 0 16px">
              <div style="font-size:40px;margin-bottom:8px">🧙</div>
              <div style="font-family:var(--font-d);font-size:16px;color:var(--white)">${esc(me.username)}</div>
            </div>
            ${[['dashboard','📊','Dashboard'],['offers','📋','Moje ogłoszenia'],['messages','💬','Wiadomości'],['tutor','🛡️','TuTor'],['settings','⚙️','Ustawienia'],['logout','🚪','Wyloguj']].map(([id,icon,label]) => `
              <div class="account-nav-item${tab===id?' active':''}" onclick="${id==='logout'?'logout()':'renderAccount(\''+id+'\')'}">${icon} ${label}</div>
            `).join('')}
          </div>
        </aside>
        <div id="account-content">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;
  loadAccountTab(tab);
}

async function loadAccountTab(tab) {
  const el = document.getElementById('account-content');
  if (!el) return;

  // Update active nav
  document.querySelectorAll('.account-nav-item').forEach(n => n.classList.toggle('active', n.textContent.includes(
    {dashboard:'Dashboard', offers:'ogłoszenia', messages:'Wiadomości', tutor:'TuTor', settings:'Ustawienia'}[tab] || ''
  )));

  if (tab === 'dashboard') {
    try {
      const user = await api('GET', '/auth/me');
      el.innerHTML = `
        <div class="account-panel">
          <div class="panel-title">📊 Dashboard</div>
          <div class="stat-cards">
            <div class="stat-card"><span class="stat-card-num">${user.total_sales||0}</span><span class="stat-card-label">Sprzedaży</span></div>
            <div class="stat-card"><span class="stat-card-num">${fmtRating(user.rating)}</span><span class="stat-card-label">Ocena</span></div>
            <div class="stat-card"><span class="stat-card-num">${user.rating_count||0}</span><span class="stat-card-label">Opinii</span></div>
          </div>
          <div style="padding:16px;background:var(--bg4);border-radius:var(--r);margin-bottom:16px">
            <div style="font-family:var(--font-d);font-size:12px;color:var(--text3);margin-bottom:8px">PROFIL</div>
            <p><strong style="color:var(--text2)">Login:</strong> ${esc(user.username)}</p>
            <p><strong style="color:var(--text2)">Email:</strong> ${esc(user.email)}</p>
            ${user.discord ? `<p><strong style="color:var(--text2)">Discord:</strong> ${esc(user.discord)}</p>` : ''}
            ${user.bio ? `<p style="margin-top:8px;color:var(--text)">${esc(user.bio)}</p>` : ''}
          </div>
          <button class="btn btn-gold" onclick="renderAccount('settings')">⚙️ Edytuj profil</button>
        </div>`;
    } catch { el.innerHTML = '<div class="empty">Błąd ładowania danych</div>'; }
  }

  else if (tab === 'offers') {
    try {
      const offers = await api('GET', '/offers/my/list');
      el.innerHTML = `
        <div class="account-panel">
          <div class="panel-title">📋 Moje ogłoszenia
            <button class="btn btn-gold btn-sm" style="margin-left:auto" onclick="navigate('add-offer')">+ Dodaj nowe</button>
          </div>
          ${offers.length ? offers.map(o => {
            const imgs = safeJson(o.images, []);
            return `<div class="offer-row">
              <div class="offer-row-img" onclick="navigate('offer',{id:${o.id}})" style="cursor:pointer">
                ${imgs[0] ? `<img src="${imgs[0]}">` : catEmoji(o.category_slug||'')}
              </div>
              <div class="offer-row-info" onclick="navigate('offer',{id:${o.id}})" style="cursor:pointer">
                <div class="offer-row-title">${esc(o.title)}</div>
                <div class="offer-row-meta">${o.type==='auction'?'⏰ Licytacja':'🛒 Kup teraz'} · ${o.bid_count||0} ofert · ${o.views} wyświetleń</div>
              </div>
              <div class="offer-row-price">${fmtPrice(o.type==='auction'?(o.auction_current||o.auction_start):o.price)} PLN</div>
              <span class="status-pill status-active">Aktywne</span>
              <button class="btn btn-red btn-sm" onclick="deleteOffer(${o.id})">🗑</button>
            </div>`;
          }).join('') : '<div class="empty" style="padding:30px"><span class="empty-icon">📋</span><h3>Brak ogłoszeń</h3><button class="btn btn-gold" onclick="navigate(\'add-offer\')">Dodaj pierwsze</button></div>'}
        </div>`;
    } catch { el.innerHTML = '<div class="empty">Błąd ładowania</div>'; }
  }

  else if (tab === 'messages') {
    renderMessages(null, true);
  }

  else if (tab === 'tutor') {
    try {
      const data = await api('GET', '/tutor/my');
      el.innerHTML = `
        <div class="account-panel">
          <div class="panel-title">🛡️ Zlecenia TuTora</div>
          <div style="margin-bottom:20px">
            <div style="font-family:var(--font-d);font-size:13px;color:var(--text3);margin-bottom:12px">ZŁOŻONE PRZEZE MNIE</div>
            ${data.sent.length ? data.sent.map(t => `
              <div class="offer-row">
                <div class="offer-row-info">
                  <div class="offer-row-title">${esc(t.offer_title)}</div>
                  <div class="offer-row-meta">Sprzedawca: ${esc(t.seller_name)} · ${t.payment_method?.toUpperCase()}</div>
                </div>
                <span class="status-pill status-active">${t.status}</span>
              </div>`).join('') : '<p style="color:var(--text3)">Brak zleceń</p>'}
          </div>
          <div>
            <div style="font-family:var(--font-d);font-size:13px;color:var(--text3);margin-bottom:12px">DOTYCZĄCE MOICH OGŁOSZEŃ</div>
            ${data.received.length ? data.received.map(t => `
              <div class="offer-row">
                <div class="offer-row-info">
                  <div class="offer-row-title">${esc(t.offer_title)}</div>
                  <div class="offer-row-meta">Kupujący: ${esc(t.buyer_name)} · ${t.payment_method?.toUpperCase()}</div>
                </div>
                <span class="status-pill status-active">${t.status}</span>
              </div>`).join('') : '<p style="color:var(--text3)">Brak zleceń</p>'}
          </div>
        </div>`;
    } catch { el.innerHTML = '<div class="empty">Błąd ładowania</div>'; }
  }

  else if (tab === 'settings') {
    try {
      const user = await api('GET', '/auth/me');
      el.innerHTML = `
        <div class="account-panel">
          <div class="panel-title">⚙️ Ustawienia profilu</div>
          <div class="form-group"><label class="form-label">Bio / O mnie</label>
            <textarea id="s-bio" rows="3" placeholder="Kilka słów o sobie...">${esc(user.bio||'')}</textarea></div>
          <div class="form-group"><label class="form-label">Discord</label>
            <input type="text" id="s-discord" placeholder="Twój#1234" value="${esc(user.discord||'')}"></div>
          <button class="btn btn-gold" onclick="saveSettings()">💾 Zapisz zmiany</button>
        </div>`;
    } catch {}
  }
}

async function saveSettings() {
  const bio = document.getElementById('s-bio')?.value;
  const discord = document.getElementById('s-discord')?.value;
  try {
    await api('PUT', '/auth/me', { bio, discord });
    toast('Profil zaktualizowany!', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteOffer(id) {
  if (!confirm('Usunąć ogłoszenie?')) return;
  try {
    await api('DELETE', `/offers/${id}`);
    toast('Ogłoszenie usunięte', 'success');
    loadAccountTab('offers');
  } catch (e) { toast(e.message, 'error'); }
}

// ===== MESSAGES =====
let activeConv = null;

async function renderMessages(userId, inAccount = false) {
  if (!me) { showModal('login'); return; }

  if (!inAccount) {
    document.getElementById('app').innerHTML = `
      <div class="page">
        <button class="back-btn" onclick="navigate('home')">← Wróć</button>
        <div id="msgs-container"></div>
      </div>`;
  }

  const container = inAccount
    ? document.getElementById('account-content')
    : document.getElementById('msgs-container');

  if (!container) return;

  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const convs = await api('GET', '/messages/inbox');
    activeConv = userId ? Number(userId) : (convs[0]?.other_id || null);

    container.innerHTML = `
      <div class="${inAccount?'account-panel':''}">
        ${inAccount ? '<div class="panel-title">💬 Wiadomości</div>' : ''}
        <div class="messages-grid">
          <div class="conv-list" id="conv-list">
            ${convs.length ? convs.map(c => `
              <div class="conv-item${activeConv===c.other_id?' active':''}" onclick="openConv(${c.other_id})" data-uid="${c.other_id}">
                <div class="conv-name">
                  🧙 ${esc(c.other_username)}
                  ${c.unread > 0 ? `<span class="conv-unread">${c.unread}</span>` : ''}
                </div>
                <div class="conv-preview">${esc(c.last_body||'')}</div>
              </div>`).join('') : '<div style="padding:20px;color:var(--text3);font-size:14px">Brak wiadomości</div>'}
          </div>
          <div id="chat-panel" class="chat-area">
            ${activeConv ? '' : '<div class="chat-empty">Wybierz rozmowę</div>'}
          </div>
        </div>
      </div>`;

    if (activeConv) loadConversation(activeConv);
  } catch { container.innerHTML = '<div class="empty">Błąd ładowania</div>'; }
}

async function openConv(uid) {
  activeConv = uid;
  document.querySelectorAll('.conv-item').forEach(el => el.classList.toggle('active', Number(el.dataset.uid) === uid));
  loadConversation(uid);
}

async function loadConversation(uid) {
  const panel = document.getElementById('chat-panel');
  if (!panel) return;
  panel.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', `/messages/conversation/${uid}`);
    panel.innerHTML = `
      <div class="chat-header">💬 ${esc(data.other?.username || '')}</div>
      <div class="chat-messages" id="chat-msgs">
        ${data.messages.map(m => {
          const mine = m.from_id === me.id;
          return `<div>
            <div class="msg-bubble ${mine?'mine':'theirs'}">${esc(m.body)}</div>
            <div class="msg-time" style="${mine?'text-align:right':''}">${timeAgo(m.created_at*1000)}</div>
          </div>`;
        }).join('')}
        ${!data.messages.length ? '<div style="color:var(--text3);text-align:center;padding:20px">Wyślij pierwszą wiadomość</div>' : ''}
      </div>
      <div class="chat-input-row">
        <input type="text" id="msg-input" placeholder="Napisz wiadomość..." onkeydown="if(event.key==='Enter')sendMsg(${uid})">
        <button class="btn btn-gold btn-sm" onclick="sendMsg(${uid})">Wyślij</button>
      </div>`;

    const msgs = document.getElementById('chat-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
    pollMessages();
  } catch { panel.innerHTML = '<div class="chat-empty">Błąd ładowania</div>'; }
}

async function sendMsg(toId) {
  const input = document.getElementById('msg-input');
  const body = input?.value?.trim();
  if (!body) return;
  try {
    await api('POST', '/messages/send', { to_id: toId, body });
    input.value = '';
    loadConversation(toId);
  } catch (e) { toast(e.message, 'error'); }
}

// ===== PROFILE =====
async function renderProfile(id) {
  document.getElementById('app').innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div></div></div>';
  try {
    const u = await api('GET', `/auth/user/${id}`);
    document.getElementById('app').innerHTML = `
      <div class="page">
        <button class="back-btn" onclick="history.back()">← Wróć</button>
        <div class="profile-header">
          <div class="profile-avatar">🧙</div>
          <div>
            <div class="profile-name">${esc(u.username)}</div>
            <div class="stars">${starStr(u.rating)} ${fmtRating(u.rating)} (${u.rating_count||0} opinii)</div>
            <div class="profile-since">Gracz od ${new Date(u.created_at*1000).getFullYear()} · ${u.total_sales||0} transakcji</div>
            ${u.discord ? `<div style="font-size:13px;color:var(--text2);margin-top:4px">Discord: ${esc(u.discord)}</div>` : ''}
          </div>
          ${me && me.id !== u.id ? `<button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="navigate('messages',{userId:${u.id}})">💬 Wyślij wiadomość</button>` : ''}
        </div>
        ${u.bio ? `<div style="padding:16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);margin-bottom:20px;color:var(--text)">${esc(u.bio)}</div>` : ''}
        <div class="section-title">📋 Ogłoszenia</div>
        ${offerCards(u.offers)}
        <div class="section-title" style="margin-top:28px">⭐ Opinie</div>
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:16px">
          ${u.reviews.length ? u.reviews.map(r => `
            <div class="review-item">
              <div class="review-author"><span class="stars">${starStr(r.rating)}</span> · ${esc(r.reviewer_name)}</div>
              ${r.comment ? `<div class="review-text">${esc(r.comment)}</div>` : ''}
            </div>`).join('') : '<div style="color:var(--text3)">Brak opinii</div>'}
        </div>
      </div>`;
  } catch { document.getElementById('app').innerHTML = '<div class="page"><div class="empty"><span class="empty-icon">⚠️</span><h3>Profil nie istnieje</h3></div></div>'; }
}

// ===== VERIFY & RESET =====
async function verifyEmail(token) {
  document.getElementById('app').innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div><br>Weryfikacja konta...</div></div>';
  try {
    const r = await api('GET', `/auth/verify?token=${token}`);
    document.getElementById('app').innerHTML = `<div class="page"><div class="empty"><span class="empty-icon">✅</span><h3>${r.message}</h3><button class="btn btn-gold" onclick="showModal('login')">Zaloguj się</button></div></div>`;
  } catch (e) {
    document.getElementById('app').innerHTML = `<div class="page"><div class="empty"><span class="empty-icon">❌</span><h3>${e.message}</h3></div></div>`;
  }
}

function renderResetPassword(resetToken) {
  document.getElementById('app').innerHTML = `
    <div style="max-width:420px;margin:80px auto;padding:20px">
      <div class="account-panel">
        <div class="panel-title">🔑 Nowe hasło</div>
        <div class="form-group">
          <label class="form-label">Nowe hasło *</label>
          <input type="password" id="rp-pass" placeholder="Min. 6 znaków">
        </div>
        <div class="form-group">
          <label class="form-label">Powtórz hasło *</label>
          <input type="password" id="rp-pass2" placeholder="Powtórz hasło" onkeydown="if(event.key==='Enter')doResetPassword('${resetToken}')">
        </div>
        <button class="btn btn-gold btn-full" onclick="doResetPassword('${resetToken}')">💾 Zmień hasło</button>
      </div>
    </div>`;
}

async function doResetPassword(resetToken) {
  const pass = document.getElementById('rp-pass')?.value;
  const pass2 = document.getElementById('rp-pass2')?.value;
  if (!pass || pass.length < 6) return toast('Hasło musi mieć min. 6 znaków', 'error');
  if (pass !== pass2) return toast('Hasła nie są takie same', 'error');
  try {
    const r = await api('POST', '/auth/reset-password', { token: resetToken, password: pass });
    toast(r.message, 'success');
    navigate('home');
    showModal('login');
  } catch (e) { toast(e.message, 'error'); }
}

// ===== MODALS =====
function showModal(type) {
  const ov = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  ov.classList.add('open'); box.classList.add('open');

  if (type === 'login') {
    box.innerHTML = `<div class="modal" style="position:relative">
      <button class="modal-close" onclick="closeModal()">✕</button>
      <div class="ornament"><div class="orn-line"></div><span class="orn-icon">⚔️</span><div class="orn-line" style="background:linear-gradient(270deg,transparent,var(--border2))"></div></div>
      <div class="modal-title">Zaloguj się</div>
      <div class="modal-sub">Witaj wojowniku!</div>
      <div class="form-group"><label class="form-label">Email</label><input type="email" id="l-email" placeholder="twoj@email.pl"></div>
      <div class="form-group"><label class="form-label">Hasło</label><input type="password" id="l-pass" placeholder="••••••••" onkeydown="if(event.key==='Enter')doLogin()"></div>
      <button class="btn btn-gold btn-full" onclick="doLogin()">ZALOGUJ</button>
      <div class="modal-foot"><a href="#" onclick="showModal('forgot')">Zapomniałem hasła</a></div>
      <div class="modal-foot">Nie masz konta? <a href="#" onclick="showModal('register')">Zarejestruj się</a></div>
    </div>`;
  } else if (type === 'register') {
    box.innerHTML = `<div class="modal" style="position:relative">
      <button class="modal-close" onclick="closeModal()">✕</button>
      <div class="ornament"><div class="orn-line"></div><span class="orn-icon">🐉</span><div class="orn-line" style="background:linear-gradient(270deg,transparent,var(--border2))"></div></div>
      <div class="modal-title">Rejestracja</div>
      <div class="modal-sub">Dołącz do Projekt Hard Market</div>
      <div class="form-group"><label class="form-label">Nazwa gracza *</label><input type="text" id="r-user" placeholder="Twoja postać"></div>
      <div class="form-group"><label class="form-label">Email *</label><input type="email" id="r-email" placeholder="twoj@email.pl"></div>
      <div class="form-group"><label class="form-label">Hasło *</label><input type="password" id="r-pass" placeholder="Min. 6 znaków" onkeydown="if(event.key==='Enter')doRegister()"></div>
      <button class="btn btn-gold btn-full" onclick="doRegister()">ZAREJESTRUJ</button>
      <div class="modal-foot">Masz konto? <a href="#" onclick="showModal('login')">Zaloguj się</a></div>
    </div>`;
  } else if (type === 'forgot') {
    box.innerHTML = `<div class="modal" style="position:relative">
      <button class="modal-close" onclick="closeModal()">✕</button>
      <div class="modal-title">🔑 Reset hasła</div>
      <div class="modal-sub">Wyślemy Ci link do zresetowania hasła</div>
      <div class="form-group"><label class="form-label">Email</label><input type="email" id="fp-email" placeholder="twoj@email.pl" onkeydown="if(event.key==='Enter')doForgot()"></div>
      <button class="btn btn-gold btn-full" onclick="doForgot()">WYŚLIJ LINK</button>
      <div class="modal-foot"><a href="#" onclick="showModal('login')">← Wróć do logowania</a></div>
    </div>`;
  }
}

function closeModal() {
  document.getElementById('modal-overlay')?.classList.remove('open');
  document.getElementById('modal-box')?.classList.remove('open');
}

async function doLogin() {
  const email = document.getElementById('l-email')?.value;
  const password = document.getElementById('l-pass')?.value;
  try {
    const data = await api('POST', '/auth/login', { email, password });
    token = data.token; me = { id: data.id, username: data.username };
    localStorage.setItem('ph_token', token); localStorage.setItem('ph_me', JSON.stringify(me));
    updateHeaderUI(); closeModal(); pollMessages();
    toast(`⚔️ Witaj, ${data.username}!`, 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function doRegister() {
  const username = document.getElementById('r-user')?.value?.trim();
  const email = document.getElementById('r-email')?.value?.trim();
  const password = document.getElementById('r-pass')?.value;
  if (!username || !email || !password) return toast('Wypełnij wszystkie pola', 'error');
  try {
    const r = await api('POST', '/auth/register', { username, email, password });
    toast(r.message, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function doForgot() {
  const email = document.getElementById('fp-email')?.value?.trim();
  if (!email) return toast('Podaj email', 'error');
  try {
    const r = await api('POST', '/auth/forgot-password', { email });
    toast(r.message, 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

// ===== HELPERS =====
function toast(msg, type = '') {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function fmtPrice(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtRating(r) { return r ? Number(r).toFixed(1) : '—'; }

function starStr(r) {
  const n = Math.round(r || 0);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function timeLeft(ts) {
  const diff = ts - Date.now();
  if (diff <= 0) return 'Zakończona';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 24) return `${Math.floor(h/24)}d ${h%24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'przed chwilą';
  if (diff < 3600000) return `${Math.floor(diff/60000)} min temu`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)} godz temu`;
  return new Date(ts).toLocaleDateString('pl-PL');
}

function safeJson(str, def) { try { return JSON.parse(str); } catch { return def; } }
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
