// api/submit.js
// Simple Vercel/Netlify-style serverless handler that accepts
// { application, user } and writes them into data.json (root).
//
// WARNING: This is a demo implementation. Protect this endpoint
// in production (auth/validation/encryption) before storing real PII.

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data.json'); // adjust if your data.json is elsewhere

function sendJson(res, status, payload){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

module.exports = (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const payload = body ? JSON.parse(body) : {};
      const application = payload.application;
      const user = payload.user;

      if (!application || typeof application !== 'object') {
        return sendJson(res, 400, { error: 'Missing application object' });
      }

      // Ensure data.json exists; create minimal structure if missing
      let data = { users: [], applications: [] };
      if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, 'utf8');
        try { data = JSON.parse(raw); } catch (e) { /* fall back to empty */ }
      }

      // If same application id already exists, replace it (id collision unlikely)
      const idx = (data.applications || []).findIndex(a => a.id === application.id);
      if (idx !== -1) {
        // merge to preserve any server-side fields, but prefer incoming values
        data.applications[idx] = Object.assign({}, data.applications[idx], application);
      } else {
        data.applications = data.applications || [];
        data.applications.push(application);
      }

      // If a user payload is provided, add that user if not already present
      if (user && user.email) {
        data.users = data.users || [];
        const exists = data.users.find(u => u.email && u.email.toLowerCase() === user.email.toLowerCase());
        if (!exists) {
          // Add minimal user object; keep password as provided (demo only)
          data.users.push({
            id: user.id || ('u-' + Date.now()),
            email: user.email,
            name: user.name || '',
            password: user.password || '',
            role: user.role || 'user'
          });
        } else {
          // optionally update name/password if provided (keeps existing otherwise)
          if (user.name) exists.name = user.name;
          if (user.password) exists.password = user.password;
        }
      }

      // write back data.json (pretty print)
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');

      // return updated db
      return sendJson(res, 200, data);
    } catch (err) {
      console.error('api/submit error', err);
      return sendJson(res, 500, { error: String(err) });
    }
  });
};
