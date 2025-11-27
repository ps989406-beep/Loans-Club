// app.js — minimal logic for demo (frontend)
const API = {
  load: '/api/load',
  save: '/api/save' // POST full JSON, requires x-admin-pass header
};

let DB = null;
let currentUser = null;

async function loadData() {
  const res = await fetch(API.load);
  if (!res.ok) throw new Error('Load failed');
  DB = await res.json();
  renderAll();
}

async function saveData(newDb) {
  // Ask admin pass each save to protect repo writes
  const adminPass = prompt('Enter admin password to save (required for write)');
  if (!adminPass) { alert('Save cancelled (no admin password)'); return; }
  const res = await fetch(API.save, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-admin-pass': adminPass},
    body: JSON.stringify({content: newDb})
  });
  if (!res.ok) {
    const txt = await res.text();
    alert('Save failed: ' + txt);
    throw new Error('Save failed');
  }
  DB = await res.json();
  renderAll();
}

// Utilities
function uid(prefix='u'){ return prefix + '-' + Math.random().toString(36).slice(2,9) }
function byId(id){ return document.getElementById(id) }

// Render
function renderAll(){
  if(!DB) return;
  byId('dash-title').innerText = 'Your Applications';
  renderApplications();
  renderAdminList();
}

function renderApplications(){
  const list = byId('applications-list');
  list.innerHTML = '';
  if(!currentUser){
    list.innerHTML = '<div class="muted">Login to see your applications.</div>';
    return;
  }
  const apps = DB.applications.filter(a => a.userId === currentUser.id);
  if(apps.length===0) list.innerHTML = '<div class="muted">No applications yet.</div>';
  apps.forEach(a => {
    const div = document.createElement('div');
    div.className = 'app-card';
    const statusCls = {
      pending:'status-pending',
      approved:'status-approved',
      rejected:'status-rejected',
      hold:'status-hold'
    }[a.status] || 'status-pending';
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between">
        <div><strong>Requested: $${a.requested}</strong><div class="muted">Purpose: ${a.purpose || '—'}</div></div>
        <div><span class="status-badge ${statusCls}">${a.status || 'pending'}</span></div>
      </div>
      <div class="muted" style="margin-top:8px">Admin comment: ${a.adminComment || '—'}</div>
    `;
    if(a.status==='approved' && !a.withdrawalRequested){
      const wbtn = document.createElement('button');
      wbtn.className='btn';
      wbtn.innerText='Withdraw to bank (simulate)';
      wbtn.onclick = async () => {
        a.withdrawalRequested = true;
        a.withdrawalAt = new Date().toISOString();
        await saveData(DB);
      };
      div.appendChild(wbtn);
    }
    list.appendChild(div);
  });
}

function renderAdminList(){
  const list = byId('admin-list');
  if(!list) return;
  list.innerHTML = '';
  DB.applications.slice().reverse().forEach(a=>{
    const div = document.createElement('div');
    div.className = 'app-card';
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between">
        <div><strong>$${a.requested} — ${a.purpose || ''}</strong>
          <div class="muted">by ${a.userName || 'unknown'}</div></div>
        <div><span class="status-badge ${a.status==='approved'?'status-approved':a.status==='rejected'?'status-rejected':a.status==='hold'?'status-hold':'status-pending'}">${a.status}</span></div>
      </div>
      <div class="muted" style="margin-top:8px">Comment: ${a.adminComment || '—'}</div>
    `;
    const btns = document.createElement('div');
    btns.className='row';
    ['approve','hold','reject'].forEach(action=>{
      const b = document.createElement('button');
      b.className='btn';
      b.innerText = action[0].toUpperCase() + action.slice(1);
      b.onclick = async ()=>{
        const comment = prompt('Add comment for ' + action);
        if(comment===null) return;
        a.status = action==='approve'?'approved':action==='reject'?'rejected':'hold';
        a.adminComment = comment;
        a.adminAt = new Date().toISOString();
        await saveData(DB);
      };
      btns.appendChild(b);
    });
    // Withdrawal control for admin
    if(a.withdrawalRequested && a.withdrawalCompleted !== true){
      const comp = document.createElement('button');
      comp.className='btn';
      comp.innerText='Mark Withdrawal Completed';
      comp.onclick = async ()=>{
        a.withdrawalCompleted = true;
        a.withdrawalCompletedAt = new Date().toISOString();
        await saveData(DB);
      };
      btns.appendChild(comp);
    }
    div.appendChild(btns);
    list.appendChild(div);
  });
}

// Auth UI
function setupAuth() {
  byId('btn-start').onclick = () => {
    byId('hero').classList.add('hidden');
    byId('auth').classList.remove('hidden');
  };
  let signup=false;
  byId('auth-switch').onclick = ()=>{
    signup = !signup;
    byId('auth-title').innerText = signup ? 'Signup' : 'Login';
    byId('auth-submit').innerText = signup ? 'Signup' : 'Login';
    byId('name').style.display = signup ? 'block' : 'none';
  };
  byId('auth-form').onsubmit = async (ev)=>{
    ev.preventDefault();
    const email = byId('email').value.trim();
    const password = byId('password').value.trim();
    const name = byId('name').value.trim();
    if(signup){
      const exists = DB.users.find(u => u.email === email);
      if(exists){ byId('auth-msg').innerText = 'Email already exists'; return; }
      const id = uid('u');
      const user = {id, email, name: name||email, role:'user', password};
      DB.users.push(user);
      await saveData(DB);
      currentUser = user;
      showDashboard();
    } else {
      const found = DB.users.find(u => u.email===email && u.password===password);
      if(!found){ byId('auth-msg').innerText='Wrong credentials'; return; }
      currentUser = found;
      showDashboard();
    }
  };
}

function showDashboard(){
  byId('auth').classList.add('hidden');
  byId('dashboard').classList.remove('hidden');
  byId('user-info').innerText = `Signed in as ${currentUser.name} (${currentUser.email})`;
}

// Loan form
function setupLoanForm(){
  byId('loan-form').onsubmit = async ev => {
    ev.preventDefault();
    if(!currentUser){ alert('Login first'); return; }
    const requested = byId('loan-amount').value.trim();
    const purpose = byId('loan-purpose').value.trim();
    const term = byId('loan-term').value.trim();
    const income = byId('loan-income').value.trim();
    const app = {
      id: uid('app'),
      userId: currentUser.id,
      userName: currentUser.name,
      requested,
      term, purpose, income,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    DB.applications.push(app);
    await saveData(DB);
    byId('loan-form').reset();
    alert('Application submitted');
  };
}

// Export / import
function setupExportImport(){
  byId('btn-export').onclick = () => {
    const a = document.createElement('a');
    const blob = new Blob([JSON.stringify(DB, null, 2)], {type:'application/json'});
    a.href = URL.createObjectURL(blob);
    a.download = 'loanclub-data.json';
    a.click();
  };
  byId('btn-import').onclick = ()=> byId('file-import').click();
  byId('file-import').onchange = async (e)=>{
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

// init
(async function(){
  setupAuth();
  setupLoanForm();
  setupExportImport();
  byId('btn-view-admin').onclick = ()=> {
    document.getElementById('admin').classList.toggle('hidden');
    document.getElementById('dashboard').classList.toggle('hidden');
  };
  byId('btn-view-login').onclick = ()=> {
    document.getElementById('auth').classList.toggle('hidden');
  };
  byId('btn-demo-import').onclick = async ()=> {
    if(!DB || !DB.users) {
      DB = {meta:{brand:'Loan Club'}, users:[], applications:[]};
      DB.users.push({id:'admin-1', email:'admin@loanclub.local', name:'Admin', role:'admin', password:'Admin@123'});
      try { await saveData(DB); alert('Demo data created and saved.'); } catch(e){ alert('Demo created locally but save failed (check admin pass)'); }
    }
  };
  try {
    await loadData();
  } catch(e){
    // fallback to local demo DB when load fails
    DB = {meta:{brand:'Loan Club'}, users:[{id:'admin-1',email:'admin@loanclub.local',name:'Admin',role:'admin',password:'Admin@123'}], applications:[]};
    renderAll();
  }
})();
