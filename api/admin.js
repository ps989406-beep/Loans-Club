// api/admin.js
// Admin endpoint — protected by ADMIN_KEY header (x-admin-key).
// Requires env:
//   GITHUB_TOKEN  - token with repo contents write permission
//   ADMIN_KEY     - secret key required in x-admin-key header

const fetch = global.fetch || require('node-fetch');

const OWNER = 'ps989406-beep';
const REPO = 'Loans-Club';
const FILE_PATH = 'data.json';
const BRANCH = 'main';

function jsonResponse(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

module.exports = async (req, res) => {
  // Only POST allowed
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });

  // Basic admin key check (must exist on server)
  const serverKey = process.env.ADMIN_KEY;
  if (!serverKey) {
    console.error('ADMIN_KEY not set on server');
    return jsonResponse(res, 500, { error: 'Server misconfiguration: ADMIN_KEY missing' });
  }
  const incomingKey = (req.headers['x-admin-key'] || req.headers['X-Admin-Key'] || '').toString();

  if (!incomingKey || incomingKey !== serverKey) {
    return jsonResponse(res, 401, { error: 'Unauthorized: invalid admin key' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) return jsonResponse(res, 500, { error: 'GITHUB_TOKEN not set on server' });

  // parse request body
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const payload = body ? JSON.parse(body) : {};

      // VERIFY action: key is valid (we already checked header) -> return OK with basic info
      if (payload && payload.action === 'verify') {
        return jsonResponse(res, 200, { ok: true, message: 'admin key valid' });
      }

      // Expecting updateStatus for actual admin changes
      if (!payload || payload.action !== 'updateStatus') {
        return jsonResponse(res, 400, { error: 'Invalid action. Use { action: "updateStatus", id, status, adminComment }' });
      }

      const { id, status, adminComment } = payload;
      if (!id || !status) return jsonResponse(res, 400, { error: 'Missing id or status' });

      // 1) Read current data.json from GitHub to get sha and content
      const fileUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILE_PATH)}?ref=${encodeURIComponent(BRANCH)}`;
      const getResp = await fetch(fileUrl, {
        headers: { Authorization: `token ${token}`, 'User-Agent': 'LoanClub-Admin' }
      });

      let data = { users: [], applications: [] };
      let sha = null;

      if (getResp.status === 200) {
        const info = await getResp.json();
        sha = info.sha;
        const content = Buffer.from(info.content, info.encoding).toString('utf8');
        try { data = JSON.parse(content); } catch (e) { data = { users: [], applications: [] }; }
      } else if (getResp.status === 404) {
        return jsonResponse(res, 500, { error: 'data.json not found in repository' });
      } else {
        const txt = await getResp.text();
        return jsonResponse(res, 500, { error: `GitHub read failed: ${getResp.status} ${txt}` });
      }

      data.applications = data.applications || [];
      const idx = data.applications.findIndex(a => a.id === id);
      if (idx === -1) return jsonResponse(res, 404, { error: 'Application not found' });

      // 2) Apply status/comment updates and timestamps
      data.applications[idx].status = status;
      data.applications[idx].adminComment = adminComment || '';
      data.applications[idx].adminUpdatedAt = new Date().toISOString();
      if (status === 'approved') data.applications[idx].approvedAt = new Date().toISOString();
      if (status === 'rejected') data.applications[idx].rejectedAt = new Date().toISOString();
      if (status === 'hold') data.applications[idx].holdAt = new Date().toISOString();

      data.applications[idx].adminHistory = data.applications[idx].adminHistory || [];
      data.applications[idx].adminHistory.push({
        action: status,
        comment: adminComment || '',
        at: new Date().toISOString()
      });

      // 3) Commit updated data.json back to GitHub
      const newContentBase64 = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
      const commitBody = {
        message: `Admin: ${status} ${id}`,
        content: newContentBase64,
        branch: BRANCH
      };
      if (sha) commitBody.sha = sha;

      const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILE_PATH)}`;
      const putResp = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          'User-Agent': 'LoanClub-Admin',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commitBody)
      });

      if (!putResp.ok) {
        const txt = await putResp.text();
        return jsonResponse(res, 500, { error: `GitHub write failed: ${putResp.status} ${txt}` });
      }

      return jsonResponse(res, 200, data);

    } catch (err) {
      console.error('api/admin error', err);
      return jsonResponse(res, 500, { error: String(err) });
    }
  });
};
