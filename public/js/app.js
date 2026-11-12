const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function api(url, opts = {}) {
  const r = await fetch(url, { method: opts.method || 'GET', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let d = {}; try { d = await r.json(); } catch {}
  if (!r.ok) throw new Error(d.error || 'Terjadi kesalahan');
  return d;
}
async function initNav({ auth = false, admin = false, guestOnly = false } = {}) {
  let user = null;
  try { user = (await api('/api/me')).user; } catch {}
  const home = user && (user.role === 'admin' ? '/admin.html' : '/dashboard.html');
  if (guestOnly && user) { location.href = home; return null; }
  if ((auth || admin) && !user) { location.href = '/login.html'; return null; }
  if (admin && user.role !== 'admin') { location.href = home; return null; }
  $('#nav').innerHTML = `<nav><a class="brand" href="${home || '/login.html'}"><img src="/img/logo.jpg" alt="" onerror="this.style.display='none'">SehatKampus UIN</a>
    <div class="nav-r">${user
      ? `<span>${user.gender === 'Perempuan' ? '👩' : user.gender === 'Laki-laki' ? '👨' : '🛡️'} Halo, ${esc(user.name)}</span><button class="btn red" id="logout">Logout</button>`
      : `<a href="/login.html" style="color:#fff;text-decoration:none">Masuk</a><a class="btn" href="/register.html">Daftar</a>`}</div></nav>`;
  if (user) $('#logout').onclick = async () => { await api('/api/logout', { method: 'POST' }); location.href = '/login.html'; };
  return user;
}
