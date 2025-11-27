// admin.js — admin frontend with working modal handlers
const ADMIN_API = { load: '/api/load', save: '/api/save' };
let DB = null;
let adminPass = null;

// modal admin
const modalAdmin = document.getElementById('modal-admin');
const modalAdminTitle = document.getElementById('modal-admin-title');
const modalAdminBody = document.getElementById('modal-admin-body');
const modalAdminOk = document.getElementById('modal-admin-ok');
const modalAdminCancel = document.getElementById('modal-admin-cancel');

function showAdminModal(title, html, onOk, onCancel) {
  modalAdminTitle.textContent = title || '';
  modalAdminBody.innerHTML = (typeof html === 'string') ? html : '';
  modalAdmin.classList.remove('hidden');
  modalAdminOk.focus();

  const okHandler = () => { hideAdminModal(); cleanup(); if (onOk) onOk(); };
  const cancelHandler = () => { hideAdminModal(); cleanup(); if (onCancel) onCancel(); };
  function cleanup() { modalAdminOk.removeEventListener('click', okHandler); modalAdminCancel.removeEventListener('click', cancelHandler); document.removeEventListener('keydown', escHandler); }
  function escHandler(e){ if (e.key==='Escape') cancelHandler(); }
  modalAdminOk.addEventListener('click', okHandler);
  modalAdminCancel.addEventListener('click', cancelHandler);
  document.addEventListener('keydown', escHandler);
}
function hideAdminModal(){ modalAdmin.classList.add('hidden'); }

// load & save
async function loadData(pass){
  adminPass = pass;
  const res = await fetch(ADMIN_API.load);
  if (!res.ok) throw new Error('Load failed');
  DB = await res.json();
  renderAll();
}
async function saveData(newDb){
  if (!adminPass) return alert('Not logged in');
  const res = await fetch(ADMIN_API.save, {
    method: 'POST',
    headers: {'Content-Type':'application/json','x-admin-pass': adminPass},
    body: JSON.stringify({ content: newDb })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || 'Save failed');
  }
  DB = await res.json();
  renderAll();
}

// render
function renderAll(){ renderList(); }
function renderList(){
  const list = document.getElementById('admin-list');
  list.innerHTML = '';
  if (!DB || !DB.applications || DB.applications.length===0) { list.innerHTML = '<div class="muted">No applications</div>'; return; }
  DB.applications.slice().reverse().forEach(app => {
    const d = document.createElement('div');
    d.className = 'app-card';
    const statusCls = app.status === 'approved' ? 'status-approved' : app.status === 'rejected' ? 'status-rejected' : app.status === 'hold' ? 'status-hold' : 'status-pending';
    d.innerHTML = `
      <div style="display:flex;justify-content:space-between">
        <div><strong>$${app.requested} — ${app.purpose||''}</strong><div class="muted">by ${app.userName||'unknown'}</div></div>
        <div><span class="status-badge ${statusCls}">${app.status}</span></div>
      </div>
      <div class="muted" style="margin-top:8px">Created: ${app.createdAt ? new Date(app.createdAt).toLocaleString() : '-'}</div>
      <div class="muted" style="margin-top:8px">Admin comment: ${app.adminComment||'—'}</div>
    `;
    const ctrl = document.createElement('div');
    ctrl.className = 'row';
    ['approve','hold','reject'].forEach(action => {
      const b = document.createElement('button');
      b.className = 'btn';
      b.innerText = action[0].toUpperCase() + action.slice(1);
      b.onclick = () => {
        showAdminModal(`${action[0].toUpperCase()+action.slice(1)} application`, `<p>Add a comment for this action:</p><textarea id="admin-comment" style="width:100%;min-height:80px;border-radius:8px;border:1px solid #e6eef9;padding:8px"></textarea>`, async () => {
          const comment = document.getElementById('admin-comment').value.trim();
          if (!comment) return alert('Comment is required');
          app.status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'hold';
          app.adminComment = comment;
          app.adminAt = new Date().toISOString();
          try { await saveData(DB); } catch (err) { alert('Save failed: ' + err.message); }
        });
      };
      ctrl.appendChild(b);
    });
    if (app.withdrawalRequested && !app.withdrawalCompleted) {
      const comp = document.createElement('button');
      comp.className = 'btn';
      comp.innerText = 'Mark Withdrawal Completed';
      comp.onclick = () => {
        showAdminModal('Complete withdrawal', `<p>Mark withdrawal for <strong>$${app.requested}</strong> as completed?</p>`, async () => {
          app.withdrawalCompleted = true;
          app.withdrawalCompletedAt = new Date().toISOString();
          try { await saveData(DB); } catch (err) { alert('Save failed: ' + err.message); }
        });
      };
      ctrl.appendChild(comp);
    }
    d.appendChild(ctrl);
    list.appendChild(d);
  });
}

// export/import
function setupImportExport(){
  document.getElementById('btn-export-admin').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(DB, null, 2)], {type:'application/json'}));
    a.download = 'loanclub-data.json';
    a.click();
  };
  document.getElementById('btn-import-admin').onclick = () => document.getElementById('file-import-admin').click();
  document.getElementById('file-import-admin').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const txt = await f.text();
    try {
      const parsed = JSON.parse(txt);
      showAdminModal('Confirm import', `<p>Overwrite repo data.json with uploaded file?</p>`, async () => {
        try { await saveData(parsed); alert('Imported and saved'); } catch (err) { alert('Import failed: ' + err.message); }
      });
    } catch (err) { alert('Invalid JSON'); }
  };
}

// wire login / refresh
document.getElementById('btn-admin-login').onclick = async () => {
  const pass = document.getElementById('admin-pass').value.trim();
  if (!pass) return alert('Enter admin password');
  try {
    await loadData(pass);
    document.getElementById('admin-panel').classList.remove('hidden');
    document.getElementById('btn-admin-login').disabled = true;
    document.getElementById('admin-pass').value = '';
    setupImportExport();
  } catch (err) {
    alert('Login failed: ' + (err.message || err));
  }
};
document.getElementById('btn-refresh').onclick = async () => {
  if (!adminPass) return alert('Not logged in');
  try { await loadData(adminPass); } catch (err) { alert('Refresh failed'); }
};
