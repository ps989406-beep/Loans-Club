// api/submit.js
// Serverless handler that writes incoming { application, user } into data.json
// by committing to the GitHub repository using the GitHub Contents API.
//
// Required env:
//   GITHUB_TOKEN  - personal access token with repo permissions
// Optionally change OWNER / REPO / BRANCH / FILE_PATH to match your setup.

const fetch = global.fetch || require('node-fetch');

const OWNER = 'ps989406-beep';
const REPO = 'Loans-Club';
const FILE_PATH = 'data.json';
const BRANCH = 'main'; // change if your default branch is different

function jsonResponse(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) return jsonResponse(res, 500, { error: 'GITHUB_TOKEN not set on server' });

  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const payload = body ? JSON.parse(body) : {};
      const application = payload.application;
      const user = payload.user;

      if (!application || typeof application !== 'object') {
        return jsonResponse(res, 400, { error: 'Missing application object' });
      }

      // 1) GET current file (to obtain sha) - if exists read and parse, otherwise create base
      const fileUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILE_PATH)}?ref=${encodeURIComponent(BRANCH)}`;
      const getResp = await fetch(fileUrl, {
        headers: { Authorization: `token ${token}`, 'User-Agent': 'LoanClub-Server' }
      });

      let data = { users: [], applications: [] };
      let sha = null;

      if (getResp.status === 200) {
        const info = await getResp.json();
        sha = info.sha;
        const content = Buffer.from(info.content, info.encoding).toString('utf8');
        try {
          data = JSON.parse(content);
        } catch (e) {
          data = { users: [], applications: [] };
        }
      } else if (getResp.status === 404) {
        // file doesn't exist — we'll create it
        data = { users: [], applications: [] };
      } else {
        const txt = await getResp.text();
        return jsonResponse(res, 500, { error: `GitHub read failed: ${getResp.status} ${txt}` });
      }

      // 2) append or update application
      data.applications = data.applications || [];
      const existingIdx = data.applications.findIndex(a => a.id === application.id);
      if (existingIdx !== -1) {
        data.applications[existingIdx] = Object.assign({}, data.applications[existingIdx], application);
      } else {
        data.applications.push(application);
      }

      // 3) create / update user if a user payload provided
      if (user && user.email) {
        data.users = data.users || [];
        const exists = data.users.find(u => u.email && u.email.toLowerCase() === user.email.toLowerCase());
        if (!exists) {
          data.users.push({
            id: user.id || ('u-' + Date.now()),
            email: user.email,
            name: user.name || '',
            password: user.password || '',
            role: user.role || 'user'
          });
        } else {
          if (user.name) exists.name = user.name;
          if (user.password) exists.password = user.password;
        }
      }

      // 4) PUT updated file back to GitHub (contents API requires base64 content)
      const newContent = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');

      const commitBody = {
        message: existingIdx !== -1 ? `Update application ${application.id}` : `Add application ${application.id}`,
        content: newContent,
        branch: BRANCH
      };
      if (sha) commitBody.sha = sha;

      const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILE_PATH)}`;
      const putResp = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          'User-Agent': 'LoanClub-Server',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commitBody)
      });

      if (!putResp.ok) {
        const txt = await putResp.text();
        return jsonResponse(res, 500, { error: `GitHub write failed: ${putResp.status} ${txt}` });
      }

      // 5) return the updated data object (we already have it)
      return jsonResponse(res, 200, data);
    } catch (err) {
      console.error('api/submit error', err);
      return jsonResponse(res, 500, { error: String(err) });
    }
  });
};
