const Toast = (() => {
  let container = null;

  function init() {
    if (container) return;
    container = document.createElement('div');
    container.className = 'toast-wrap';
    document.body.appendChild(container);
  }

  return {
    show(title, sub = '', icon = '✅') {
      init();
      const el = document.createElement('div');
      el.className = 'toast';
      el.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <div class="toast-text">
          <div class="toast-title"></div>
          ${sub ? '<div class="toast-sub"></div>' : ''}
        </div>`;
      el.querySelector('.toast-title').textContent = title;
      if (sub) el.querySelector('.toast-sub').textContent = sub;
      container.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    },
  };
})();

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function openSOSModal() {
  const existing = document.getElementById('sos-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'sos-modal';
  modal.className = 'modal-bg';
  modal.innerHTML = `
    <div class="modal-box" onclick="event.stopPropagation()">
      <div class="modal-icon">🚨</div>
      <div class="modal-title">Alert Sent</div>
      <div class="modal-body">
        Your location has been shared with nearby authorities.<br/>
        Coordinates: <strong id="sos-coords">Detecting…</strong><br/><br/>
        Stay calm. Move towards a lit, busy area.<br/>
        <strong>Police (100) notified.</strong>
      </div>
      <button class="modal-close" id="sos-close">I'm Safe — Close</button>
    </div>`;
  document.body.appendChild(modal);

  navigator.geolocation?.getCurrentPosition(
    position => {
      document.getElementById('sos-coords').textContent = `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
    },
    () => { document.getElementById('sos-coords').textContent = 'Location unavailable'; }
  );
  modal.addEventListener('click', () => modal.remove());
  document.getElementById('sos-close').addEventListener('click', () => modal.remove());
}

function renderHeader(user) {
  const roleBadge = user.role !== 'user'
    ? `<span style="margin-left:8px;font-size:.72rem;padding:2px 9px;border-radius:100px;
        background:${user.role === 'admin' ? '#fef3c7' : '#dbeafe'};
        color:${user.role === 'admin' ? '#b45309' : 'var(--blue)'};
        font-weight:700;text-transform:uppercase;letter-spacing:.04em;">
        ${user.role === 'admin' ? 'Government' : 'NGO'}</span>` : '';
  return `
    <div class="header-brand">
      <div class="header-mark">S</div>
      <span class="header-name">SAFARA</span>
    </div>
    <div class="header-welcome">
      Welcome, <strong>${user.name.split(' ')[0]}</strong>${roleBadge}
    </div>
    <div class="header-actions">
      <button class="header-sos" onclick="openSOSModal()">🚨 SOS</button>
      <button class="header-logout" onclick="handleLogout()">Sign out</button>
    </div>`;
}

function renderSidebar(nav, activeId, onNav) {
  window._safaraNav = onNav;
  return `
    <button class="sidebar-toggle" id="sidebar-toggle" onclick="toggleSidebar()" title="Toggle menu">☰</button>
    <div class="sidebar-divider"></div>
    ${nav.map(item => `
      <button class="nav-item${activeId === item.id ? ' active' : ''}" onclick="window._safaraNav('${item.id}')" title="${item.label}" data-nav="${item.id}">
        <span>${item.icon}</span>
        <span class="nav-item-label">${item.label}</span>
      </button>`).join('')}`;
}

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.toggle('expanded');
  document.getElementById('sidebar-toggle').textContent = sidebar.classList.contains('expanded') ? '←' : '☰';
}

function handleLogout() {
  API.logout();
}

function requireAuth() {
  const user = API.getCurrentUser();
  if (!API.isLoggedIn()) {
    API.logout();
    return null;
  }
  return user;
}
