// api/admin.js
// Vercel / Netlify-style serverless handler (Node).
// Writes changes to data.json in repository root.

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data.json'); // adjust if your data file live elsewhere

function sendJson(res, status, obj){
  res.statusCode = status;
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error:'Method not allowed' });

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const payload = body ? JSON.parse(body) : {};
      if (!payload || payload.action !== 'updateStatus') return sendJson(res, 400, { error:'Invalid action' });
      const { id, status, adminComment } = payload;
      if (!id || !status) return sendJson(res, 400, { error:'Missing id or status' });

      // load data.json
      if (!fs.existsSync(DATA_PATH)) {
        return sendJson(res, 500, { error:'data.json not found on server' });
      }
      const raw = fs.readFileSync(DATA_PATH, 'utf8');
      const data = JSON.parse(raw);

      const apps = data.applications || [];
      const idx = apps.findIndex(a => a.id === id);
      if (idx === -1) return sendJson(res, 404, { error:'Application not found' });

      // update fields
      apps[idx].status = status;
      apps[idx].adminComment = adminComment || '';
      apps[idx].adminUpdatedAt = new Date().toISOString();

      // if approved — optionally set disbursed_on or anything else here (demo)
      if (status === 'approved') apps[idx].approvedAt = new Date().toISOString();

      // write back
      data.applications = apps;
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');

      // return updated data
      return sendJson(res, 200, data);
    } catch (err) {
      console.error('admin endpoint error', err);
      return sendJson(res, 500, { error: String(err) });
    }
  });
};
