let users = [];
let filteredUsers = [];
let viewMode = 'grid';
let elements = {};
let callbacks = {};

const $ = id => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function normalize(value) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9\s@._+/-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'MR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function searchText(user) {
  return normalize([
    user.fullName, user.givenName, user.familyName, user.primaryEmail, user.jobTitle,
    user.department, user.organisationName, user.organisationUnit, user.location,
    user.phoneNumbers, user.aliases, user.additionalEmails, user.status
  ].join(' '));
}

function sortedUnique(values) {
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

function setOptions(select, values, defaultLabel) {
  const current = select.value;
  select.innerHTML = `<option value="">${escapeHtml(defaultLabel)}</option>` + values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if (values.includes(current)) select.value = current;
}

function userComparator(sort) {
  const value = key => user => normalize(user[key]);
  if (sort === 'department') return (a, b) => value('department')(a).localeCompare(value('department')(b)) || value('fullName')(a).localeCompare(value('fullName')(b));
  if (sort === 'title') return (a, b) => value('jobTitle')(a).localeCompare(value('jobTitle')(b)) || value('fullName')(a).localeCompare(value('fullName')(b));
  if (sort === 'status') return (a, b) => value('status')(a).localeCompare(value('status')(b)) || value('fullName')(a).localeCompare(value('fullName')(b));
  return (a, b) => value('fullName')(a).localeCompare(value('fullName')(b));
}

function statusChip(user) {
  const status = user.status === 'Resigned' ? 'Resigned' : 'Active';
  return `<span class="status-chip ${status.toLowerCase()}">${status}</span>`;
}

function detailRows(user) {
  const rows = [
    ['Status', user.status],
    ['Email', user.primaryEmail, 'email'],
    ['Phone', user.phoneNumbers],
    ['Department', user.department],
    ['Organisation unit', user.organisationUnit],
    ['Location', user.location]
  ].filter(([, value]) => String(value || '').trim());
  return rows.map(([label, value, type]) => {
    const body = type === 'email'
      ? `<a href="mailto:${escapeHtml(value)}">${escapeHtml(value)}</a>`
      : escapeHtml(value);
    return `<div class="staff-detail-row"><span>${escapeHtml(label)}</span><strong>${body}</strong></div>`;
  }).join('');
}

function cardTemplate(user) {
  const department = user.department ? `<span class="department-chip">${escapeHtml(user.department)}</span>` : '';
  const phone = user.phoneNumbers ? `<div class="contact-line"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z"></path></svg><span>${escapeHtml(user.phoneNumbers)}</span></div>` : '';
  const location = user.location ? `<div class="contact-line muted-line"><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 1 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg><span>${escapeHtml(user.location)}</span></div>` : '';
  return `
    <article class="staff-card ${user.status === 'Resigned' ? 'resigned-card' : ''}" tabindex="0" data-staff-id="${escapeHtml(user.id || user.primaryEmail)}">
      <div class="staff-card-main">
        <div class="avatar">${escapeHtml(initials(user.fullName))}</div>
        <div class="staff-copy">
          <div class="staff-name-row"><h2>${escapeHtml(user.fullName || 'Unnamed staff')}</h2><div class="chip-stack">${department}${statusChip(user)}</div></div>
          <p class="staff-title">${escapeHtml(user.jobTitle || user.department || 'MRANTI Staff')}</p>
          <a class="contact-line email-line" href="mailto:${escapeHtml(user.primaryEmail)}" onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path></svg>
            <span>${escapeHtml(user.primaryEmail)}</span>
          </a>
          ${phone}
          ${location}
        </div>
      </div>
      <div class="staff-card-actions">
        <button class="card-action" type="button" data-action="email" data-email="${escapeHtml(user.primaryEmail)}">Email</button>
        <button class="card-action" type="button" data-action="copy" data-email="${escapeHtml(user.primaryEmail)}">Copy email</button>
        <button class="card-open" type="button" aria-label="Open ${escapeHtml(user.fullName)} profile"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"></path></svg></button>
      </div>
    </article>`;
}

function render() {
  const query = normalize(elements.searchInput.value);
  const department = elements.departmentFilter.value;
  const location = elements.locationFilter.value;
  const status = elements.statusFilter.value;
  const sort = elements.sortSelect.value;
  filteredUsers = users.filter(user =>
    (!department || user.department === department) &&
    (!location || user.location === location) &&
    (!status || user.status === status) &&
    (!query || searchText(user).includes(query))
  ).sort(userComparator(sort));

  elements.staffGrid.classList.toggle('list-view', viewMode === 'list');
  elements.staffGrid.innerHTML = filteredUsers.map(cardTemplate).join('');
  elements.resultCount.textContent = `${filteredUsers.length} ${filteredUsers.length === 1 ? 'person' : 'people'}`;
  elements.emptyState.hidden = filteredUsers.length > 0;
  elements.staffGrid.hidden = filteredUsers.length === 0;
}

function openUser(user) {
  if (!user) return;
  elements.drawerContent.innerHTML = `
    <div class="drawer-profile">
      <div class="drawer-avatar">${escapeHtml(initials(user.fullName))}</div>
      <h2>${escapeHtml(user.fullName || 'Unnamed staff')}</h2>
      <p>${escapeHtml(user.jobTitle || user.department || 'MRANTI Staff')}</p>
      <div class="drawer-chips">${user.department ? `<span class="department-chip">${escapeHtml(user.department)}</span>` : ''}${statusChip(user)}</div>
    </div>
    <div class="drawer-details">${detailRows(user)}</div>
    <div class="drawer-actions">
      <a class="primary-button" href="mailto:${escapeHtml(user.primaryEmail)}"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path></svg>Email ${escapeHtml((user.givenName || user.fullName || '').split(' ')[0] || 'staff')}</a>
      <button class="secondary-button" type="button" id="drawerCopyEmail">Copy email</button>
    </div>`;
  elements.drawerBackdrop.hidden = false;
  elements.staffDrawer.classList.add('open');
  elements.staffDrawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
  $('drawerCopyEmail')?.addEventListener('click', () => callbacks.copyEmail?.(user.primaryEmail));
}

function closeDrawer() {
  elements.staffDrawer.classList.remove('open');
  elements.staffDrawer.setAttribute('aria-hidden', 'true');
  elements.drawerBackdrop.hidden = true;
  document.body.classList.remove('drawer-open');
}

function userByElement(element) {
  const card = element.closest('[data-staff-id]');
  const id = card?.dataset.staffId;
  return users.find(user => String(user.id || user.primaryEmail) === String(id));
}

export function initializeDirectory(options = {}) {
  callbacks = options;
  elements = {
    searchInput: $('searchInput'), departmentFilter: $('departmentFilter'), locationFilter: $('locationFilter'), statusFilter: $('statusFilter'),
    sortSelect: $('sortSelect'), gridViewButton: $('gridViewButton'), listViewButton: $('listViewButton'),
    clearFiltersButton: $('clearFiltersButton'), emptyClearButton: $('emptyClearButton'), staffGrid: $('staffGrid'),
    resultCount: $('resultCount'), emptyState: $('emptyState'), drawerBackdrop: $('drawerBackdrop'),
    staffDrawer: $('staffDrawer'), drawerContent: $('drawerContent'), closeDrawerButton: $('closeDrawerButton')
  };

  ['input', 'change'].forEach(eventName => elements.searchInput.addEventListener(eventName, render));
  [elements.departmentFilter, elements.locationFilter, elements.statusFilter, elements.sortSelect].forEach(el => el.addEventListener('change', render));
  elements.gridViewButton.addEventListener('click', () => setView('grid'));
  elements.listViewButton.addEventListener('click', () => setView('list'));
  [elements.clearFiltersButton, elements.emptyClearButton].forEach(button => button.addEventListener('click', clearFilters));
  elements.drawerBackdrop.addEventListener('click', closeDrawer);
  elements.closeDrawerButton.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeDrawer();
    if (event.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
      event.preventDefault(); elements.searchInput.focus();
    }
  });
  elements.staffGrid.addEventListener('click', event => {
    const action = event.target.closest('[data-action]');
    if (action) {
      event.stopPropagation();
      const email = action.dataset.email || '';
      if (action.dataset.action === 'copy') callbacks.copyEmail?.(email);
      if (action.dataset.action === 'email') window.location.href = `mailto:${email}`;
      return;
    }
    openUser(userByElement(event.target));
  });
  elements.staffGrid.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('.staff-card')) {
      event.preventDefault(); openUser(userByElement(event.target));
    }
  });
}

export function setDirectoryData(data = {}) {
  users = Array.isArray(data.users) ? data.users.slice() : [];
  setOptions(elements.departmentFilter, sortedUnique(users.map(user => user.department)), 'All departments');
  setOptions(elements.locationFilter, sortedUnique(users.map(user => user.location)), 'All locations');
  render();
}

export function setView(mode) {
  viewMode = mode === 'list' ? 'list' : 'grid';
  elements.gridViewButton.classList.toggle('active', viewMode === 'grid');
  elements.listViewButton.classList.toggle('active', viewMode === 'list');
  render();
}

export function clearFilters() {
  elements.searchInput.value = '';
  elements.departmentFilter.value = '';
  elements.locationFilter.value = '';
  elements.statusFilter.value = '';
  elements.sortSelect.value = 'name';
  render();
}
