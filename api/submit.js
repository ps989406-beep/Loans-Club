// api/submit.js
// Appends an application object to data.json and creates a user record if provided.
// Intended for demo / small production. Keep GITHUB_TOKEN secret.

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const path = 'data.json';
    const token = process.env.GITHUB_TOKEN;

    if (!token) return res.status(500).json({ error: 'Missing GITHUB_TOKEN' });
    if (!repo) return res.status(500).json({ error: 'Missing GITHUB_REPO' });

    const body = req.body;
    const application = body && body.application;
    const user = body && body.user; // optional {email, name, password, id}

    if (!application || typeof application !== 'object') return res.status(400).json({ error: 'Missing application object' });

    // 1) Get current data.json
    const getUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
    const cur = await fetch(getUrl, { headers: { 'User-Agent':'loanclub-demo', 'Authorization': `token ${token}` } });
    if (!cur.ok) {
      const txt = await cur.text();
      return res.status(500).json({ error: 'Could not get current file', status: cur.status, text: txt });
    }
    const curJson = await cur.json();
    const sha = curJson.sha;
    const content = JSON.parse(Buffer.from(curJson.content, 'base64').toString('utf8'));

    // 2) Ensure users array exists
    content.users = content.users || [];
    content.applications = content.applications || [];

    // 3) If user provided, create user if not exists (simple email uniqueness)
    if (user && user.email) {
      const email = user.email.toLowerCase();
      const exists = content.users.find(u => u.email && u.email.toLowerCase() === email);
      if (!exists) {
        const newUser = {
          id: user.id || ('u-' + Date.now() + '-' + Math.random().toString(36).slice(2,6)),
          email,
          name: user.name || '',
          role: 'user',
          password: user.password || '' // NOTE: plaintext for demo only
        };
        content.users.push(newUser);
      }
      // attach user email to application for later lookup
      application.userEmail = email;
    }

    // 4) Append application (basic normalization)
    application.createdAt = application.createdAt || new Date().toISOString();
    application.status = application.status || 'pending';
    content.applications.push(application);

    // 5) Write updated file back to GitHub
    const updatedBase64 = Buffer.from(JSON.stringify(content, null, 2)).toString('base64');
    const putUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`;
    const message = `Append application via Loan Club submit @ ${new Date().toISOString()}`;
    const putBody = { message, content: updatedBase64, sha, branch };

    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'User-Agent':'loanclub-demo', 'Authorization': `token ${token}`, 'Content-Type':'application/json' },
      body: JSON.stringify(putBody)
    });

    if (!putRes.ok) {
      const txt = await putRes.text();
      return res.status(500).json({ error: 'Failed to update file', status: putRes.status, text: txt });
    }

    // 6) return updated content
    return res.status(200).json(content);

  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
