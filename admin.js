// admin.js — admin frontend (must enter ADMIN_PASS to operate)
const ADMIN = {
  load: '/api/load',
  save: '/api/save',
};

let DB = null;
let adminPass = null;

function byId(id){ return document.getElementById(id) }
function uid(prefix='u'){ return prefix + '-' + Math.random().toString(36).slice(2,9) }

async function loadData(pass){
  adminPass = pass;
  const res = await fetch(ADMIN.load);
  if(!res.ok) throw new Error('Load failed');
  DB = await res.json();
  renderAll();
}

async function saveData(newDb){
  if(!adminPass) { alert('Admin not logged in'); return; }
  const res = await fetch(ADMIN.save, {
    method: 'POST',
    headers: {'Content-Type':'application/json','x-admin-pass': adminPass},
    body: JSON.stringify({content: newDb})
  });
  if(!res.ok){
    const t = await res.text();
    alert('Save failed: ' + t);
    throw new Error('Save failed');
  }
  DB = await res.json();
  renderAll();
}

function renderAll(){
  renderList();
}

function renderList(){
  const list = byId('admin-list');
  list.innerHTML = '';
  if(!DB || !DB.applications || DB.applications.length===0){ list.innerHTML='<div class="muted">No applications</div>'; return;}
  DB.applications.slice().reverse().forEach(app=>{
    const d = document.createElement('div');
    d.className='app-card';
    d.innerHTML = `
      <div style="display:flex;justify-content:space-between">
        <div><strong>$${app.requested} — ${app.purpose||''}</strong><div class="muted">by ${app.userName||'unknown'} (${app.userId})</div></div>
        <div><span class="status-badge ${app.status==='approved'?'status-approved':app.status==='rejected'?'status-rejected':app.status==='hold'?'status-hold':'status-pending'}">${app.status}</span></div>
      </div>
      <div class="muted" style="margin-top:8px">Created: ${new Date(app.createdAt).toLocaleString() || '-'}</div>
      <div class="muted" style="margin-top:8px">Admin comment: ${app.adminComment||'—'}</div>
    `;
    const ctrl = document.createElement('div');
    ctrl.className='row';
    ['approve','hold','reject'].forEach(action=>{
      const b=document.createElement('button');
      b.className='btn';
      b.innerText = action[0].toUpperCase()+action.slice(1);
      b.onclick = async ()=>{
        const comment = prompt('Add comment for ' + action);
        if(comment===null) return;
        app.status = action==='approve'?'approved':action==='reject'?'rejected':'hold';
        app.adminComment = comment;
        app.adminAt = new Date().toISOString();
        await saveData(DB);
      };
      ctrl.appendChild(b);
    });
    if(app.withdrawalRequested && !app.withdrawalCompleted){
      const comp = document.createElement('button');
      comp.className='btn';
      comp.innerText='Mark Withdrawal Completed';
      comp.onclick = async ()=>{
        app.withdrawalCompleted = true;
        app.withdrawalCompletedAt = new Date().toISOString();
        await saveData(DB);
      };
      ctrl.appendChild(comp);
    }
    d.appendChild(ctrl);
    list.appendChild(d);
  });
}

// export / import
function setupImportExport(){
  byId('btn-export-admin').onclick = ()=> {
    const a = document.createElement('a');
    const blob = new Blob([JSON.stringify(DB, null, 2)], {type:'application/json'});
    a.href = URL.createObjectURL(blob);
    a.download = 'loanclub-data.json';
    a.click();
  };
  byId('btn-import-admin').onclick = ()=> byId('file-import-admin').click();
  byId('file-import-admin').onchange = async (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    const txt = await f.text();
    try {
      const parsed = JSON.parse(txt);
      if(!confirm('Overwrite remote data.json with this file?')) return;
      await saveData(parsed);
      alert('Imported and saved.');
    } catch(err){ alert('Invalid JSON'); }
  };
}

document.getElementById('btn-admin-login').onclick = async ()=>{
  const pass = document.getElementById('admin-pass').value.trim();
  if(!pass){ alert('Enter admin password'); return; }
  try{
    await loadData(pass);
    document.getElementById('admin-panel').classList.remove('hidden');
    document.getElementById('btn-admin-login').disabled = true;
    document.getElementById('admin-pass').value = '';
    setupImportExport();
  } catch(err){
    alert('Login failed: ' + err.message);
  }
};

document.getElementById('btn-refresh').onclick = async ()=> {
  if(!adminPass) return alert('Not logged in');
  try { await loadData(adminPass); } catch(e){ alert('Refresh failed'); }
};
