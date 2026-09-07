import { initializeAuth, onUserChanged, signIn, signOut } from './auth.js';
import { fetchDirectory, getCachedDirectory, clearDirectoryCache } from './api.js';
import { initializeDirectory, setDirectoryData } from './directory.js';

const $ = id => document.getElementById(id);
let firstAuthenticatedLoad = true;
let refreshInProgress = false;

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'MR';
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function setLoginError(message = '') {
  $('loginError').textContent = message;
  $('loginError').classList.toggle('show', Boolean(message));
}

function showLogin() {
  $('loginScreen').style.display = 'grid';
  $('loginScreen').setAttribute('aria-hidden', 'false');
  $('appScreen').hidden = true;
}

function showApp(user) {
  $('loginScreen').style.display = 'none';
  $('loginScreen').setAttribute('aria-hidden', 'true');
  $('appScreen').hidden = false;
  $('userName').textContent = user.displayName || user.email || 'MRANTI Staff';
  $('userEmail').textContent = user.email || '';
  $('menuName').textContent = user.displayName || 'MRANTI Staff';
  $('menuEmail').textContent = user.email || '';
  const photo = $('userPhoto');
  const initial = $('userInitial');
  if (user.photoURL) {
    photo.src = user.photoURL;
    photo.hidden = false;
    initial.hidden = true;
  } else {
    photo.hidden = true;
    initial.hidden = false;
    initial.textContent = initials(user.displayName || user.email);
  }
}

function setLoading(loading) {
  $('skeletonGrid').hidden = !loading;
  $('staffGrid').classList.toggle('loading-hidden', loading);
  if (loading && !$('skeletonGrid').children.length) {
    $('skeletonGrid').innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton-card"><span class="skeleton-avatar"></span><span class="skeleton-line wide"></span><span class="skeleton-line"></span><span class="skeleton-line short"></span></div>').join('');
  }
  $('refreshButton').classList.toggle('spinning', loading && refreshInProgress);
}

function showBanner(message = '', type = 'info') {
  const banner = $('statusBanner');
  banner.textContent = message;
  banner.className = `status-banner ${type}`;
  banner.hidden = !message;
}

function updateSummary(data) {
  const users = Array.isArray(data?.users) ? data.users : [];
  const departments = Array.isArray(data?.departments) ? data.departments : [...new Set(users.map(user => user.department).filter(Boolean))];
  const active = Number.isFinite(Number(data?.activeUsers)) ? Number(data.activeUsers) : users.filter(user => user.status !== 'Resigned').length;
  const resigned = Number.isFinite(Number(data?.resignedUsers)) ? Number(data.resignedUsers) : users.filter(user => user.status === 'Resigned').length;
  $('activeCount').textContent = active;
  $('resignedCount').textContent = resigned;
  $('departmentCount').textContent = departments.length;
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

async function copyEmail(email) {
  if (!email) return;
  try { await navigator.clipboard.writeText(email); showToast('Email copied'); }
  catch { showToast(email); }
}

async function loadDirectory({ force = false } = {}) {
  if (refreshInProgress) return;
  const cached = getCachedDirectory();
  if (!force && cached?.data) {
    setDirectoryData(cached.data);
    updateSummary(cached.data);
    setLoading(false);
    if (cached.fresh) return;
    showBanner('Showing recently cached directory while refreshing…', 'info');
  } else {
    setLoading(true);
  }

  refreshInProgress = true;
  $('refreshButton').classList.add('spinning');
  try {
    const data = await fetchDirectory();
    setDirectoryData(data);
    updateSummary(data);
    showBanner('');
  } catch (error) {
    if (cached?.data) showBanner(`Live refresh failed. Showing the last loaded directory. ${error.message}`, 'warning');
    else {
      showBanner(error.message || 'Unable to load the Staff Directory.', 'error');
      setDirectoryData({ users: [] });
      updateSummary({ users: [] });
    }
  } finally {
    refreshInProgress = false;
    $('refreshButton').classList.remove('spinning');
    setLoading(false);
  }
}

function bindShell() {
  initializeDirectory({ copyEmail });
  $('signInButton').addEventListener('click', async () => {
    setLoginError('');
    $('signInButton').disabled = true;
    try { await signIn(); }
    catch (error) { setLoginError(error.message || 'Unable to sign in.'); }
    finally { $('signInButton').disabled = false; }
  });
  $('signOutButton').addEventListener('click', async () => { clearDirectoryCache(); await signOut(); });
  $('refreshButton').addEventListener('click', () => loadDirectory({ force: true }));
  $('userButton').addEventListener('click', event => {
    event.stopPropagation();
    const menu = $('userMenu');
    menu.hidden = !menu.hidden;
    $('userButton').setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.user-area')) {
      $('userMenu').hidden = true;
      $('userButton').setAttribute('aria-expanded', 'false');
    }
  });
}

try {
  initializeAuth();
  bindShell();
  onUserChanged((user, error) => {
    if (error) { showLogin(); setLoginError(error.message); return; }
    if (!user) { showLogin(); firstAuthenticatedLoad = true; return; }
    setLoginError('');
    showApp(user);
    if (firstAuthenticatedLoad) {
      firstAuthenticatedLoad = false;
      loadDirectory();
    }
  });
} catch (error) {
  showLogin();
  setLoginError(error.message || 'The Staff Directory could not start.');
}
