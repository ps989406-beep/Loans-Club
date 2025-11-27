// app.js — customer frontend (professional + working modal)
const API = { load: '/api/load', submit: '/api/submit' };
let DB = null;
let currentUser = null;

// --- modal utility ---
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalOk = document.getElementById('modal-ok');
const modalCancel = document.getElementById('modal-cancel');

function showModal(title, bodyHTML, onOk, onCancel) {
  modalTitle.textContent = title || '';
  modalBody.innerHTML = (typeof bodyHTML === 'string') ? bodyHTML : '';
  modal.classList.remove('hidden');
  modalOk.focus();

  const okHandler = () => {
    hideModal();
    cleanup();
    if (typeof onOk === 'function') onOk();
  };
  const cancelHandler = () => {
    hideModal();
    cleanup();
    if (typeof onCancel === 'function') onCancel();
  };
  function cleanup() {
    modalOk.removeEventListener('click', okHandler);
    modalCancel.removeEventListener('click', cancelHandler);
    document.removeEventListener('keydown', escHandler);
  }
  function escHandler(e) { if (e.key === 'Escape') cancelHandler(); }
  modalOk.addEventListener('click', okHandler);
  modalCancel.addEventListener('click', cancelHandler);
  document.addEventListener('keydown', escHandler);
}
function hideModal() { modal.classList.add('hidden'); }

// --- data functions ---
async function loadData() {
  const res = await fetch(API.load);
  if (!res.ok) throw new Error('Unable to load data');
  DB = await res.json();
  renderAll();
}
async function submitApplication(app) {
  const res = await fetch(API.submit, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ application: app })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || 'Submit failed');
  }
  DB = await res.json();
  renderAll();
}

// helpers
function uid(p='u'){ return p + '-' + Math.random().toString(36).slice(2,9) }
function byId(id){ return document.getElementById(id) }

// render
function renderAll() {
  if (!DB) return;
  renderApplications();
}
function renderApplications() {
  const list = byId('applications-list');
  list.innerHTML = '';
  if (!currentUser) {
    list.innerHTML = '<div class="muted">Please login to view your applications.</div>';
    return;
  }
  const apps = DB.applications.filter(a => a.userId === currentUser.id);
  if (!apps.length) list.innerHTML = '<div class="muted">No applications yet.</div>';
  apps.forEach(a => {
    const d = document.createElement('div');
    d.className = 'app-card';
    const statusCls = a.status === 'approved' ? 'status-approved' : a.status === 'rejected' ? 'status-rejected' : a.status === 'hold' ? 'status-hold' : 'status-pending';
    d.innerHTML = `
      <div style="display:flex;justify-content:space-between">
        <div><strong>Requested: $${a.requested}</strong><div class="muted">Purpose: ${a.purpose||'—'}</div></div>
        <div><span class="status-badge ${statusCls}">${a.status}</span></div>
      </div>
      <div class="muted" style="margin-top:8px">Admin comment: ${a.adminComment||'—'}</div>
    `;
    if (a.status === 'approved' && !a.withdrawalRequested) {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.innerText = 'Withdraw (simulate)';
      btn.onclick = () => {
        showModal('Withdraw request', `<p>Request withdrawal for <strong>$${a.requested}</strong>?</p>`, async () => {
          a.withdrawalRequested = true;
          a.withdrawalAt = new Date().toISOString();
          // we cannot call admin save here; just notify user & rely on admin to finalize via admin panel
          alert('Withdrawal requested. Admin will process it from the admin dashboard.');
          renderAll();
        });
      };
      d.appendChild(btn);
    }
    list.appendChild(d);
  });
}

// auth & forms
function setupAuth() {
  byId('btn-start').onclick = () => { byId('hero').classList?.add?.('hidden'); byId('auth').classList.remove('hidden'); };
  let signup = false;
  byId('auth-switch').onclick = () => {
    signup = !signup;
    byId('auth-title').innerText = signup ? 'Signup' : 'Login';
    byId('auth-submit').innerText = signup ? 'Signup' : 'Login';
    byId('name').style.display = signup ? 'block' : 'none';
  };
  byId('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = byId('email').value.trim();
    const pass = byId('password').value.trim();
    const name = byId('name').value.trim() || email;
    if (signup) {
      // local signup (demo). Persist by exporting JSON and admin import for real persistence.
      if (DB.users.find(u => u.email === email)) return byId('auth-msg').innerText = 'Email exists';
      const id = uid('u');
      const u = { id, email, name, role:'user', password: pass };
      DB.users.push(u);
      currentUser = u;
      alert('Signed up locally. Export JSON to persist or ask admin to import.');
      showDashboard();
    } else {
      const found = DB.users.find(u => u.email === email && u.password === pass);
      if (!found) return byId('auth-msg').innerText = 'Wrong credentials';
      currentUser = found;
      showDashboard();
    }
  };
}
function showDashboard() {
  byId('auth').classList.add('hidden');
  byId('dashboard').classList.remove('hidden');
  byId('user-info').innerText = `${currentUser.name} (${currentUser.email})`;
}

function setupLoanForm() {
  byId('loan-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert('Please login');
    const requested = byId('loan-amount').value.trim();
    const purpose = byId('loan-purpose').value.trim();
    const term = byId('loan-term').value.trim();
    const income = byId('loan-income').value.trim();
    const app = { id: uid('app'), userId: currentUser.id, userName: currentUser.name, requested, term, purpose, income, status: 'pending' };
    try {
      await submitApplication(app);
      byId('loan-form').reset();
      showModal('Submitted', `<p>Your application for <strong>$${requested}</strong> was submitted.</p>`, () => {});
    } catch (err) {
      showModal('Error', `<p>Submit failed: ${err.message}</p>`, () => {});
    }
  };
}

// export
function setupExport() {
  byId('btn-export').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(DB, null, 2)], {type:'application/json'}));
    a.download = 'loanclub-data.json';
    a.click();
  };
}

// modal wiring done already on top

// init
(async function init(){
  setupAuth();
  setupLoanForm();
  setupExport();
  document.getElementById('btn-view-login').onclick = () => document.getElementById('auth').classList.toggle('hidden');
  // safe load
  try { await loadData(); }
  catch(e) { DB = {meta:{brand:'Loan Club'}, users:[], applications:[]}; renderAll(); }
})();
