require('dotenv').config();
const express = require('express'), session = require('express-session');
const bcrypt = require('bcryptjs'), QRCode = require('qrcode');
const fs = require('fs'), path = require('path');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'db.json');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : { users: [], logs: [] };
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

// Dedicated admin account (created once, from .env)
if (!db.users.some(u => u.role === 'admin')) {
  db.users.push({
    id: uid(), role: 'admin', name: 'Administrator', profession: 'Admin', gender: '', kelas: '', nim: '',
    username: (process.env.ADMIN_USERNAME || 'admin').toLowerCase(),
    passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Admin#12345', 10),
    createdAt: new Date().toISOString()
  });
  save();
}

const HABITS = {
  activity: { no: 1, icon: '🏃', title: 'Aktivitas Fisik', desc: 'Pencatatan olahraga & langkah',
    intro: 'Pilih kegiatan yang ingin kamu lakukan hari ini, catatannya akan langsung masuk ke rekap admin.',
    fields: [
      { name: 'kegiatan', label: 'Pilih kegiatan', type: 'cards', options: ['Jalan Kaki', 'Jogging', 'Senam Ringan', 'Bersepeda'], icons: ['🚶', '🏃', '🧘', '🚴'] },
      { name: 'durasi', label: 'Pilih durasi kegiatan', type: 'radio', options: ['10 menit', '15 menit', '30 menit', '60 menit'] },
      { name: 'intensitas', label: 'Intensitas', type: 'radio', options: ['Ringan', 'Sedang', 'Berat'] },
      { name: 'langkah', label: 'Jumlah langkah (opsional)', type: 'number', optional: true }] },
  water: { no: 2, icon: '💧', title: 'Pengingat Minum', desc: 'Target hidrasi harian',
    intro: 'Catat air putih yang sudah kamu minum.',
    fields: [{ name: 'jumlah', label: 'Jumlah minum', type: 'radio', options: ['1 gelas', '2 gelas', '4 gelas', '8 gelas'] }] },
  sleep: { no: 3, icon: '🌙', title: 'Catatan Tidur', desc: 'Tidur malam, tidur siang & kualitas', uniqueBy: 'jenis',
    intro: 'Catat tidur malam atau tidur siangmu.',
    fields: [
      { name: 'jenis', label: 'Jenis tidur', type: 'cards', options: ['Tidur Malam', 'Tidur Siang'], icons: ['🌙', '☀️'] },
      { name: 'durasi_malam', label: 'Lama tidur malam', type: 'radio', options: ['Kurang dari 5 jam', '5–6 jam', '7–8 jam', 'Lebih dari 8 jam'], showIf: { field: 'jenis', value: 'Tidur Malam' } },
      { name: 'durasi_siang', label: 'Lama tidur siang', type: 'radio', options: ['Kurang dari 15 menit', '15–30 menit', '31–60 menit', 'Lebih dari 1 jam'], showIf: { field: 'jenis', value: 'Tidur Siang' } },
      { name: 'kualitas', label: 'Kualitas tidur', type: 'cards', options: ['Nyenyak', 'Cukup', 'Kurang nyenyak'], icons: ['😴', '🙂', '😵'] }] },
  meal: { no: 4, icon: '🍽️', title: 'Pola Makan', desc: 'Jadwal, porsi, buah & sayur', uniqueBy: 'waktu',
    intro: 'Catat makanmu hari ini.',
    fields: [
      { name: 'waktu', label: 'Waktu makan', type: 'cards', options: ['Sarapan', 'Makan Siang', 'Makan Malam'], icons: ['🍳', '🍛', '🍲'] },
      { name: 'status', label: 'Apakah kamu makan?', type: 'radio', options: ['Sudah makan', 'Terlewat'] },
      { name: 'porsi', label: 'Porsi', type: 'radio', options: ['Sedikit', 'Cukup', 'Banyak'], showIf: { field: 'status', value: 'Sudah makan' } },
      { name: 'buah', label: 'Ada buah?', type: 'radio', options: ['Ya', 'Tidak'], showIf: { field: 'status', value: 'Sudah makan' } },
      { name: 'sayur', label: 'Ada sayur?', type: 'radio', options: ['Ya', 'Tidak'], showIf: { field: 'status', value: 'Sudah makan' } }] },
  mental: { no: 5, icon: '🧠', title: 'Kesehatan Mental', desc: 'Suasana hati & tingkat stres',
    intro: 'Bagaimana perasaanmu hari ini?',
    fields: [
      { name: 'mood', label: 'Suasana hati', type: 'cards', options: ['Senang', 'Biasa', 'Cemas', 'Sedih'], icons: ['😊', '😐', '😟', '😢'] },
      { name: 'stres', label: 'Tingkat stres', type: 'radio', options: ['Rendah', 'Sedang', 'Tinggi'] },
      { name: 'catatan', label: 'Catatan (opsional)', type: 'text', optional: true }] },
  report: { no: 6, icon: '📋', title: 'Laporan & Bantuan', desc: 'Sampaikan keluhan atau minta bantuan',
    intro: 'Pesanmu akan langsung dibaca admin.',
    fields: [
      { name: 'jenis', label: 'Jenis pesan', type: 'cards', options: ['Laporan', 'Bantuan'], icons: ['📋', '🆘'] },
      { name: 'pesan', label: 'Pesan', type: 'text' }] }
};

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'ganti-secret-ini', resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 7 * 864e5 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const pub = u => ({ id: u.id, name: u.name, role: u.role, profession: u.profession, gender: u.gender, kelas: u.kelas, nim: u.nim, username: u.username });
const me = req => db.users.find(u => u.id === req.session.uid);
const needAuth = (req, res, next) => me(req) ? next() : res.status(401).json({ error: 'Silakan masuk dulu' });
const needAdmin = (req, res, next) => me(req).role === 'admin' ? next() : res.status(403).json({ error: 'Khusus admin' });
const fail = (res, code, error) => res.status(code).json({ error });

app.post('/api/register', (req, res) => {
  const b = req.body || {}, s = (k, n = 80) => String(b[k] || '').trim().slice(0, n);
  const name = s('name'), username = s('username', 20).toLowerCase(), password = String(b.password || '');
  const profession = ['Mahasiswa', 'Dosen', 'Staf'].includes(b.profession) ? b.profession : null;
  const gender = ['Laki-laki', 'Perempuan'].includes(b.gender) ? b.gender : null;
  if (!name || !profession || !gender) return fail(res, 400, 'Nama, profesi, dan gender wajib diisi');
  if (profession === 'Mahasiswa' && !s('kelas')) return fail(res, 400, 'Kelas wajib diisi untuk mahasiswa');
  if (!/^[a-z0-9_.]{3,20}$/.test(username)) return fail(res, 400, 'Username 3–20 karakter: huruf, angka, titik, underscore');
  if (password.length < 6) return fail(res, 400, 'Password minimal 6 karakter');
  if (db.users.some(u => u.username === username)) return fail(res, 409, 'Username sudah dipakai');
  const user = { id: uid(), role: 'user', name, profession, gender, username, nim: s('nim', 30),
    kelas: profession === 'Mahasiswa' ? s('kelas', 20) : '', passwordHash: bcrypt.hashSync(password, 10), createdAt: new Date().toISOString() };
  db.users.push(user); save();
  req.session.uid = user.id;
  res.json({ user: pub(user) });
});

const tries = {};
app.post('/api/login', (req, res) => {
  const t = tries[req.ip] = (tries[req.ip] || []).filter(x => Date.now() - x < 9e5);
  if (t.length >= 10) return fail(res, 429, 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.');
  const u = db.users.find(x => x.username === String((req.body || {}).username || '').trim().toLowerCase());
  if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.passwordHash)) { t.push(Date.now()); return fail(res, 401, 'Username atau password salah'); }
  req.session.uid = u.id;
  res.json({ user: pub(u) });
});
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/me', needAuth, (req, res) => res.json({ user: pub(me(req)) }));
app.get('/api/habits', needAuth, (req, res) => res.json(HABITS));

app.post('/api/logs', needAuth, (req, res) => {
  const h = HABITS[(req.body || {}).type];
  if (!h) return fail(res, 400, 'Jenis catatan tidak dikenal');
  const data = {};
  const inp = req.body.data || {};
  for (const f of h.fields) {
    if (f.showIf && inp[f.showIf.field] !== f.showIf.value) { data[f.name] = ''; continue; }
    let v = String(inp[f.name] || '').trim();
    if (f.type === 'text') v = v.slice(0, 500);
    else if (f.type === 'number') { if (v && !/^\d{1,6}$/.test(v)) return fail(res, 400, 'Angka tidak valid: ' + f.label); }
    else if (v && !f.options.includes(v)) return fail(res, 400, 'Pilihan tidak valid');
    if (!v && !f.optional) return fail(res, 400, 'Lengkapi: ' + f.label);
    data[f.name] = v;
  }
  // One entry per meal (or sleep type) per day: re-saving the same one updates it, other entries stay untouched
  const prev = h.uniqueBy && db.logs.find(l => l.userId === me(req).id && l.type === req.body.type && l.date === today() && l.data[h.uniqueBy] === data[h.uniqueBy]);
  if (prev) { prev.data = data; prev.createdAt = new Date().toISOString(); }
  else db.logs.push({ id: uid(), userId: me(req).id, type: req.body.type, data, date: today(), createdAt: new Date().toISOString() });
  save();
  res.json({ ok: true });
});
app.get('/api/logs/today', needAuth, (req, res) => {
  const mine = db.logs.filter(l => l.userId === me(req).id && l.date === today());
  res.json({ done: [...new Set(mine.map(l => l.type))], entries: mine.map(l => ({ type: l.type, data: l.data })) });
});

const since = () => new Date(Date.now() - 6 * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
function insights(logs) {
  const n = v => parseInt(v) || 0, by = t => logs.filter(l => l.type === t);
  const act = by('activity'), meal = by('meal'), sleep = by('sleep');
  const minutes = act.reduce((s, l) => s + n(l.data.durasi), 0);
  const eaten = meal.filter(l => l.data.status !== 'Terlewat');
  const skipped = meal.length - eaten.length;
  const skippedB = meal.filter(l => l.data.status === 'Terlewat' && l.data.waktu === 'Sarapan').length;
  const fruit = eaten.filter(l => l.data.buah === 'Ya').length;
  const nights = sleep.filter(l => l.data.jenis === 'Tidur Malam');
  const shortNights = nights.filter(l => /^(Kurang|5)/.test(l.data.durasi_malam || '')).length;
  const tips = [];
  if (!logs.length) tips.push('Belum ada catatan 7 hari terakhir. Mulai dari satu kebiasaan hari ini.');
  else {
    tips.push(minutes >= 150 ? `Olahraga ${minutes} menit dalam 7 hari: target 150 menit per minggu tercapai.` : `Olahraga ${minutes} menit dalam 7 hari. Targetkan 150 menit per minggu.`);
    if (skippedB) tips.push(`Sarapan terlewat ${skippedB} kali. Coba siapkan sarapan sederhana.`);
    else if (skipped) tips.push(`${skipped} waktu makan terlewat minggu ini.`);
    if (eaten.length && fruit * 2 < eaten.length) tips.push(`Buah hanya ada di ${fruit} dari ${eaten.length} waktu makan. Coba tambahkan buah.`);
    if (shortNights) tips.push(`Tidur malam kurang dari 7 jam sebanyak ${shortNights} kali. Usahakan 7–8 jam.`);
  }
  return { stats: { minutes, skipped, fruit, eaten: eaten.length, naps: sleep.length - nights.length, nights: nights.length }, tips };
}
app.get('/api/insights', needAuth, (req, res) => res.json(insights(db.logs.filter(l => l.userId === me(req).id && l.date >= since()))));

app.get('/api/admin/overview', needAuth, needAdmin, (req, res) => {
  const users = db.users.filter(u => u.role !== 'admin').map(u => ({
    ...pub(u), createdAt: u.createdAt, logCount: db.logs.filter(l => l.userId === u.id).length }));
  const logs = db.logs.slice(-300).reverse().map(l => ({
    ...l, name: (db.users.find(u => u.id === l.userId) || {}).name || '-', habit: HABITS[l.type].title }));
  res.json({ users, logs, todayLogs: db.logs.filter(l => l.date === today()).length,
    insights: insights(db.logs.filter(l => l.date >= since())).stats });
});
app.delete('/api/admin/users/:id', needAuth, needAdmin, (req, res) => {
  const i = db.users.findIndex(u => u.id === req.params.id && u.role !== 'admin');
  if (i < 0) return fail(res, 404, 'Pengguna tidak ditemukan');
  db.users.splice(i, 1);
  db.logs = db.logs.filter(l => l.userId !== req.params.id);
  save(); res.json({ ok: true });
});

// QR code that points to wherever this app is hosted
app.get('/qr.png', async (req, res) => {
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  res.type('png').send(await QRCode.toBuffer(base, { width: 600, margin: 2 }));
});

app.listen(PORT, () => console.log(`SehatKampus berjalan di http://localhost:${PORT}`));
