// === STATE ===
let token = localStorage.getItem('m2token') || null;
let currentUser = JSON.parse(localStorage.getItem('m2user') || 'null');
let categories = [];
let servers = [];

// === INIT ===
document.addEventListener('DOMContentLoaded', async () => {
  initParticles();
  updateAuthUI();
  await Promise.all([loadCategories(), loadServers()]);
  navigate('home');
});

// === PARTICLES ===
function initParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${Math.random() * 3 + 1}px;
      height: ${Math.random() * 3 + 1}px;
      animation-duration: ${Math.random() * 15 + 8}s;
      animation-delay: ${Math.random() * 10}s;
      opacity: ${Math.random() * 0.5};
    `;
    container.appendChild(p);
  }
}

// === AUTH UI ===
function updateAuthUI() {
  const authBtns = document.getElementById('auth-buttons');
  const userMenu = document.getElementById('user-menu');
  const userDisplay = document.getElementById('username-display');
  if (currentUser && token) {
    authBtns.style.display = 'none';
    userMenu.style.display = 'flex';
    userMenu.style.alignItems = 'center';
    userMenu.style.gap = '10px';
    userDisplay.textContent = currentUser.username;
  } else {
    authBtns.style.display = 'flex';
    userMenu.style.display = 'none';
  }
}

function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('m2token');
  localStorage.removeItem('m2user');
  updateAuthUI();
  navigate('home');
  showToast('Wylogowano pomyślnie');
}

// === API ===
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Błąd serwera');
  return data;
}

// === DATA LOADING ===
async function loadCategories() {
  try { categories = await api('GET', '/categories'); } catch {}
}
async function loadServers() {
  try { servers = await api('GET', '/servers'); } catch {}
}

// === NAVIGATION ===
function navigate(page, params = {}) {
  const app = document.getElementById('app');
  closeModal();
  switch (page) {
    case 'home': renderHome(); break;
    case 'offers': renderOffers(params); break;
    case 'offer': renderOfferDetail(params.id); break;
    case 'add-offer': renderAddOffer(); break;
    case 'servers': renderServers(); break;
    default: renderHome();
  }
}

// === HOME PAGE ===
function renderHome() {
  document.getElementById('app').innerHTML = `
    <section class="hero">
      <div class="hero-badge">⚔️ MARKETPLACE DLA PRYWATNYCH SERWERÓW MT2</div>
      <h1>Kupuj i sprzedawaj<br><span>przedmioty z Metin2</span></h1>
      <p>Największy polski marketplace dla przedmiotów, kont i usług na prywatnych serwerach Metin2.</p>
      <div class="hero-search">
        <input type="text" id="hero-search" placeholder="Szukaj przedmiotu, broni, konta..." onkeydown="if(event.key==='Enter')doSearch()">
        <button onclick="doSearch()">SZUKAJ</button>
      </div>
      <div class="hero-stats">
        <div class="stat"><span class="stat-num" id="stat-offers">—</span><span class="stat-label">OGŁOSZEŃ</span></div>
        <div class="stat"><span class="stat-num">5</span><span class="stat-label">SERWERÓW</span></div>
        <div class="stat"><span class="stat-num">100%</span><span class="stat-label">BEZPIECZEŃSTWO</span></div>
      </div>
    </section>
    <div class="section-divider"></div>
    <div class="categories-section">
      <div class="section-title">⚡ Kategorie</div>
      <div class="categories-grid" id="cats-grid"></div>
    </div>
    <div class="offers-section">
      <div class="section-title">🔥 Najnowsze ogłoszenia</div>
      <div id="home-offers"><div class="loading"><div class="spinner"></div><br>Ładowanie...</div></div>
    </div>
  `;
  renderCategoryCards('cats-grid');
  loadHomeOffers();
}

function renderCategoryCards(containerId) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = categories.map(c => `
    <div class="category-card" onclick="navigate('offers',{category:'${c.slug}'})">
      <span class="cat-icon">${c.icon}</span>
      <span class="cat-name">${c.name}</span>
    </div>
  `).join('');
}

async function loadHomeOffers() {
  try {
    const data = await api('GET', '/offers?limit=8&sort=newest');
    document.getElementById('stat-offers').textContent = data.total;
    document.getElementById('home-offers').innerHTML = renderOfferCards(data.offers);
  } catch {
    document.getElementById('home-offers').innerHTML = '<div class="empty-state"><span class="empty-icon">⚔️</span><h3>Brak ogłoszeń</h3></div>';
  }
}

function doSearch() {
  const q = document.getElementById('hero-search')?.value?.trim();
  navigate('offers', q ? { search: q } : {});
}

// === OFFERS PAGE ===
async function renderOffers(params = {}) {
  document.getElementById('app').innerHTML = `
    <div style="max-width:1280px;margin:0 auto;padding:32px 20px">
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:24px;align-items:center">
        <button class="back-btn" onclick="navigate('home')">← Strona główna</button>
        <div class="section-title" style="margin:0">🗡️ Ogłoszenia</div>
      </div>
      <div style="display:grid;grid-template-columns:220px 1fr;gap:24px" id="offers-layout">
        <aside>
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:16px;margin-bottom:12px">
            <div style="font-family:var(--font-display);font-size:13px;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px">SERWER</div>
            ${servers.map(s => `<div class="filter-item" onclick="filterServer('${s.slug}')" data-srv="${s.slug}" style="padding:7px 10px;cursor:pointer;border-radius:4px;font-size:14px;color:var(--text-muted);transition:all 0.15s">${s.name} <span style="color:var(--gold);font-size:11px">${s.rates}</span></div>`).join('')}
          </div>
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:16px">
            <div style="font-family:var(--font-display);font-size:13px;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px">KATEGORIA</div>
            ${categories.map(c => `<div class="filter-item" onclick="filterCategory('${c.slug}')" data-cat="${c.slug}" style="padding:7px 10px;cursor:pointer;border-radius:4px;font-size:14px;color:var(--text-muted);transition:all 0.15s">${c.icon} ${c.name}</div>`).join('')}
          </div>
        </aside>
        <div>
          <div class="offers-toolbar">
            <span class="offers-count" id="offers-count">Ładowanie...</span>
            <div class="offers-filters">
              <input type="text" id="search-input" placeholder="Szukaj..." value="${params.search || ''}" style="width:200px;padding:7px 12px;font-size:13px" onkeydown="if(event.key==='Enter')applyFilters()">
              <select class="filter-select" id="sort-select" onchange="applyFilters()">
                <option value="newest">Najnowsze</option>
                <option value="cheapest">Najtańsze</option>
                <option value="expensive">Najdroższe</option>
                <option value="popular">Popularne</option>
              </select>
            </div>
          </div>
          <div class="offers-grid" id="offers-grid"><div class="loading"><div class="spinner"></div></div></div>
          <div id="pagination"></div>
        </div>
      </div>
    </div>
  `;
  window._offerFilters = { ...params, page: 1 };
  fetchOffers();
}

function filterServer(slug) {
  const active = window._offerFilters.server === slug;
  window._offerFilters.server = active ? null : slug;
  window._offerFilters.page = 1;
  document.querySelectorAll('[data-srv]').forEach(el => {
    el.style.color = el.dataset.srv === window._offerFilters.server ? 'var(--gold)' : 'var(--text-muted)';
    el.style.background = el.dataset.srv === window._offerFilters.server ? 'rgba(212,160,18,0.08)' : '';
  });
  fetchOffers();
}

function filterCategory(slug) {
  const active = window._offerFilters.category === slug;
  window._offerFilters.category = active ? null : slug;
  window._offerFilters.page = 1;
  document.querySelectorAll('[data-cat]').forEach(el => {
    el.style.color = el.dataset.cat === window._offerFilters.category ? 'var(--gold)' : 'var(--text-muted)';
    el.style.background = el.dataset.cat === window._offerFilters.category ? 'rgba(212,160,18,0.08)' : '';
  });
  fetchOffers();
}

function applyFilters() {
  window._offerFilters.search = document.getElementById('search-input')?.value || '';
  window._offerFilters.sort = document.getElementById('sort-select')?.value || 'newest';
  window._offerFilters.page = 1;
  fetchOffers();
}

async function fetchOffers() {
  const f = window._offerFilters || {};
  const params = new URLSearchParams();
  if (f.category) params.set('category', f.category);
  if (f.server) params.set('server', f.server);
  if (f.search) params.set('search', f.search);
  if (f.sort) params.set('sort', f.sort);
  params.set('page', f.page || 1);
  params.set('limit', 12);

  const grid = document.getElementById('offers-grid');
  if (grid) grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const data = await api('GET', '/offers?' + params.toString());
    const countEl = document.getElementById('offers-count');
    if (countEl) countEl.textContent = `${data.total} ogłoszeń`;
    if (grid) grid.innerHTML = data.offers.length ? renderOfferCards(data.offers) : '<div class="empty-state"><span class="empty-icon">🔍</span><h3>Brak ogłoszeń</h3><p>Spróbuj zmienić filtry</p></div>';
    renderPagination(data.page, data.pages);
  } catch (e) {
    if (grid) grid.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Błąd ładowania</h3></div>';
  }
}

function renderPagination(current, total) {
  const el = document.getElementById('pagination');
  if (!el || total <= 1) return;
  let html = '<div class="pagination">';
  if (current > 1) html += `<button class="page-btn" onclick="goPage(${current-1})">← Poprzednia</button>`;
  for (let i = Math.max(1, current-2); i <= Math.min(total, current+2); i++) {
    html += `<button class="page-btn ${i===current?'active':''}" onclick="goPage(${i})">${i}</button>`;
  }
  if (current < total) html += `<button class="page-btn" onclick="goPage(${current+1})">Następna →</button>`;
  html += '</div>';
  el.innerHTML = html;
}

function goPage(p) {
  window._offerFilters.page = p;
  fetchOffers();
  document.getElementById('offers-layout')?.scrollIntoView({ behavior: 'smooth' });
}

// === OFFER CARDS ===
function renderOfferCards(offers) {
  if (!offers.length) return '<div class="empty-state"><span class="empty-icon">⚔️</span><h3>Brak ogłoszeń</h3></div>';
  return `<div class="offers-grid">${offers.map(o => {
    const imgs = JSON.parse(o.images || '[]');
    const emoji = getCategoryEmoji(o.category_slug);
    return `
      <div class="offer-card" onclick="navigate('offer',{id:${o.id}})">
        <div class="offer-img">
          ${imgs[0] ? `<img src="${imgs[0]}" alt="${o.title}">` : emoji}
          ${o.server_name ? `<span class="offer-server-badge">${o.server_name}</span>` : ''}
        </div>
        <div class="offer-body">
          ${o.category_name ? `<div class="offer-category">${o.category_name}</div>` : ''}
          <div class="offer-title">${o.title}</div>
          <div class="offer-footer">
            <div class="offer-price">${Number(o.price).toFixed(2)} <span>PLN</span></div>
            <div class="offer-seller">🧙 <strong>${o.seller_name}</strong></div>
          </div>
        </div>
      </div>
    `;
  }).join('')}</div>`;
}

function getCategoryEmoji(slug) {
  const map = { bron:'⚔️', zbroja:'🛡️', helmy:'⛑️', buty:'👟', bizuteria:'💍', kamienie:'💎', 'smocze-kamienie':'🐉', yang:'💰', konta:'👤', uslugi:'🔧', inne:'📦' };
  return map[slug] || '📦';
}

// === OFFER DETAIL ===
async function renderOfferDetail(id) {
  document.getElementById('app').innerHTML = '<div class="offer-detail"><div class="loading"><div class="spinner"></div><br>Ładowanie ogłoszenia...</div></div>';
  try {
    const o = await api('GET', `/offers/${id}`);
    const imgs = JSON.parse(o.images || '[]');
    const emoji = getCategoryEmoji(o.category_slug);
    const stars = '★'.repeat(Math.round(o.seller_rating || 0)) + '☆'.repeat(5 - Math.round(o.seller_rating || 0));
    document.getElementById('app').innerHTML = `
      <div class="offer-detail">
        <button class="back-btn" onclick="navigate('offers')">← Wróć do ogłoszeń</button>
        <div class="offer-detail-grid">
          <div class="offer-detail-main">
            <div class="offer-detail-img">
              ${imgs[0] ? `<img src="${imgs[0]}" alt="${o.title}">` : emoji}
            </div>
            <h1 class="offer-detail-title">${o.title}</h1>
            <div class="offer-meta">
              ${o.category_name ? `<span class="meta-tag">📂 ${o.category_name}</span>` : ''}
              ${o.server_name ? `<span class="meta-tag">🖥️ ${o.server_name}</span>` : ''}
              <span class="meta-tag">👁️ ${o.views} wyświetleń</span>
            </div>
            ${o.description ? `<div class="offer-desc">${o.description.replace(/\n/g,'<br>')}</div>` : '<p style="color:var(--text-dim)">Brak opisu.</p>'}
          </div>
          <div class="offer-sidebar">
            <div class="sidebar-box">
              <div class="sidebar-price">${Number(o.price).toFixed(2)} PLN</div>
              <button class="btn btn-gold btn-full btn-lg" onclick="contactSeller()">💬 Kontakt ze sprzedawcą</button>
            </div>
            <div class="sidebar-box">
              <div style="font-family:var(--font-display);font-size:12px;letter-spacing:1px;color:var(--text-dim);margin-bottom:12px">SPRZEDAWCA</div>
              <div class="seller-info">
                <div class="seller-avatar">🧙</div>
                <div>
                  <div class="seller-name">${o.seller_name}</div>
                  <div class="stars">${stars}</div>
                  <div class="seller-stats">${o.total_sales || 0} transakcji • od ${new Date(o.seller_since).getFullYear()}</div>
                </div>
              </div>
            </div>
            <div class="sidebar-box" style="background:rgba(212,160,18,0.04);border-color:rgba(212,160,18,0.2)">
              <div style="font-size:13px;color:var(--text-muted);line-height:1.6">
                🔒 <strong style="color:var(--gold)">Bezpieczna transakcja</strong><br>
                Zawsze spotykaj się z kupującym w bezpiecznym miejscu w grze. Nie płać z góry nieznanym osobom.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch {
    document.getElementById('app').innerHTML = '<div class="offer-detail"><div class="empty-state"><span class="empty-icon">⚠️</span><h3>Ogłoszenie nie istnieje</h3></div></div>';
  }
}

function contactSeller() {
  if (!token) { showModal('login'); showToast('Zaloguj się, aby skontaktować się ze sprzedawcą'); return; }
  showToast('Funkcja wiadomości wkrótce! Na razie kontaktuj się przez Discord.');
}

// === ADD OFFER ===
function renderAddOffer() {
  if (!token) { showModal('login'); showToast('Musisz być zalogowany, aby dodać ogłoszenie'); return; }
  document.getElementById('app').innerHTML = `
    <div class="add-offer-page">
      <button class="back-btn" onclick="navigate('home')">← Wróć</button>
      <h1 class="page-title">➕ Dodaj ogłoszenie</h1>
      <p class="page-subtitle">Sprzedaj swoje przedmioty graczom z prywatnych serwerów Metin2</p>
      <div>
        <div class="form-group">
          <label class="form-label">Tytuł ogłoszenia *</label>
          <input type="text" id="f-title" placeholder="np. Smocza Broń +9 Full Opcja">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Cena (PLN) *</label>
            <input type="number" id="f-price" placeholder="9.99" min="0.01" step="0.01">
          </div>
          <div class="form-group">
            <label class="form-label">Serwer</label>
            <select id="f-server">
              <option value="">— Wybierz serwer —</option>
              ${servers.map(s => `<option value="${s.id}">${s.name} (${s.rates})</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Kategoria</label>
          <select id="f-category">
            <option value="">— Wybierz kategorię —</option>
            ${categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Opis</label>
          <textarea id="f-desc" rows="5" placeholder="Opisz dokładnie co sprzedajesz, jakie opcje ma przedmiot, jak przebiega transakcja..."></textarea>
        </div>
        <button class="btn btn-gold btn-full btn-lg" onclick="submitOffer()">⚔️ OPUBLIKUJ OGŁOSZENIE</button>
      </div>
    </div>
  `;
}

async function submitOffer() {
  const title = document.getElementById('f-title')?.value?.trim();
  const price = parseFloat(document.getElementById('f-price')?.value);
  const server_id = document.getElementById('f-server')?.value || null;
  const category_id = document.getElementById('f-category')?.value || null;
  const description = document.getElementById('f-desc')?.value?.trim();

  if (!title) return showToast('Podaj tytuł ogłoszenia', true);
  if (!price || price <= 0) return showToast('Podaj prawidłową cenę', true);

  try {
    const result = await api('POST', '/offers', { title, price, server_id, category_id, description });
    showToast('✅ Ogłoszenie dodane pomyślnie!');
    navigate('offer', { id: result.id });
  } catch (e) {
    showToast(e.message, true);
  }
}

// === SERVERS PAGE ===
function renderServers() {
  document.getElementById('app').innerHTML = `
    <div style="max-width:1280px;margin:0 auto;padding:40px 20px">
      <button class="back-btn" onclick="navigate('home')">← Wróć</button>
      <h1 class="page-title">🖥️ Prywatne Serwery</h1>
      <p style="color:var(--text-muted);margin-bottom:32px">Wybierz serwer, aby zobaczyć ogłoszenia z niego</p>
      <div class="servers-grid">
        ${servers.map(s => `
          <div class="server-card" onclick="navigate('offers',{server:'${s.slug}'})">
            <span class="server-icon">⚔️</span>
            <div class="server-name">${s.name}</div>
            <div class="server-rates">${s.rates}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// === MODALS ===
function showModal(type) {
  const overlay = document.getElementById('modal-overlay');
  const container = document.getElementById('modal-container');
  overlay.classList.add('open');
  container.classList.add('open');
  container.style.position = 'fixed';

  if (type === 'login') {
    container.innerHTML = `
      <div class="modal">
        <button class="modal-close" onclick="closeModal()">✕</button>
        <div class="ornament"><div class="ornament-line"></div><div class="ornament-icon">⚔️</div><div class="ornament-line" style="background:linear-gradient(270deg,transparent,var(--border))"></div></div>
        <div class="modal-title">Zaloguj się</div>
        <div class="modal-sub">Witaj wojowniku, wróć do walki!</div>
        <div class="form-group"><label class="form-label">Email</label><input type="email" id="l-email" placeholder="twoj@email.pl"></div>
        <div class="form-group"><label class="form-label">Hasło</label><input type="password" id="l-pass" placeholder="••••••••" onkeydown="if(event.key==='Enter')doLogin()"></div>
        <button class="btn btn-gold btn-full" onclick="doLogin()">ZALOGUJ</button>
        <div class="modal-footer">Nie masz konta? <a href="#" onclick="showModal('register')">Zarejestruj się</a></div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="modal">
        <button class="modal-close" onclick="closeModal()">✕</button>
        <div class="ornament"><div class="ornament-line"></div><div class="ornament-icon">🐉</div><div class="ornament-line" style="background:linear-gradient(270deg,transparent,var(--border))"></div></div>
        <div class="modal-title">Rejestracja</div>
        <div class="modal-sub">Dołącz do społeczności Metin2Market</div>
        <div class="form-group"><label class="form-label">Nazwa gracza</label><input type="text" id="r-user" placeholder="TwojaPostac123"></div>
        <div class="form-group"><label class="form-label">Email</label><input type="email" id="r-email" placeholder="twoj@email.pl"></div>
        <div class="form-group"><label class="form-label">Hasło</label><input type="password" id="r-pass" placeholder="Min. 6 znaków" onkeydown="if(event.key==='Enter')doRegister()"></div>
        <button class="btn btn-gold btn-full" onclick="doRegister()">ZAREJESTRUJ</button>
        <div class="modal-footer">Masz już konto? <a href="#" onclick="showModal('login')">Zaloguj się</a></div>
      </div>
    `;
  }
}

function closeModal() {
  document.getElementById('modal-overlay')?.classList.remove('open');
  document.getElementById('modal-container')?.classList.remove('open');
}

async function doLogin() {
  const email = document.getElementById('l-email')?.value;
  const password = document.getElementById('l-pass')?.value;
  try {
    const data = await api('POST', '/auth/login', { email, password });
    token = data.token;
    currentUser = { id: data.id, username: data.username };
    localStorage.setItem('m2token', token);
    localStorage.setItem('m2user', JSON.stringify(currentUser));
    updateAuthUI();
    closeModal();
    showToast(`⚔️ Witaj ${data.username}!`);
  } catch (e) {
    showToast(e.message, true);
  }
}

async function doRegister() {
  const username = document.getElementById('r-user')?.value;
  const email = document.getElementById('r-email')?.value;
  const password = document.getElementById('r-pass')?.value;
  if (!username || !email || !password) return showToast('Wypełnij wszystkie pola', true);
  if (password.length < 6) return showToast('Hasło musi mieć min. 6 znaków', true);
  try {
    const data = await api('POST', '/auth/register', { username, email, password });
    token = data.token;
    currentUser = { id: data.id, username: data.username };
    localStorage.setItem('m2token', token);
    localStorage.setItem('m2user', JSON.stringify(currentUser));
    updateAuthUI();
    closeModal();
    showToast(`🐉 Konto utworzone! Witaj ${data.username}!`);
  } catch (e) {
    showToast(e.message, true);
  }
}

// === TOAST ===
function showToast(msg, isError = false) {
  const container = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = 'toast-item' + (isError ? ' error' : '');
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
