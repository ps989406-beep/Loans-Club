// api/submit.js
// Appends an application object to data.json. Public endpoint (no ADMIN_PASS required).
// WARNING: public write — only allow limited operations. This implementation appends only and
// does not allow modifying existing entries. It's intended for demo/prototype use.

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const path = 'data.json';
    const token = process.env.GITHUB_TOKEN;

    const body = req.body;
    const application = body && body.application;
    if (!application || typeof application !== 'object') return res.status(400).json({ error: 'Missing application object' });

    // 1) Get current data.json
    const getUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
    const cur = await fetch(getUrl, { headers: { 'User-Agent': 'loanclub-demo', 'Authorization': `token ${token}` } });
    if (!cur.ok) {
      const txt = await cur.text();
      return res.status(500).json({ error: 'Could not get current file', status: cur.status, text: txt });
    }
    const curJson = await cur.json();
    const sha = curJson.sha;
    const content = JSON.parse(Buffer.from(curJson.content, 'base64').toString('utf8'));

    // 2) Append application (simple validation)
    application.createdAt = new Date().toISOString();
    application.status = application.status || 'pending';
    content.applications = content.applications || [];
    content.applications.push(application);

    // 3) PUT updated file
    const updatedBase64 = Buffer.from(JSON.stringify(content, null, 2)).toString('base64');
    const putUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`;
    const message = `Append application via Loan Club submit @ ${new Date().toISOString()}`;
    const putBody = { message, content: updatedBase64, sha, branch };
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'User-Agent': 'loanclub-demo', 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(putBody)
    });
    if (!putRes.ok) {
      const txt = await putRes.text();
      return res.status(500).json({ error: 'Failed to update file', status: putRes.status, text: txt });
    }
    // Return updated content
    res.status(200).json(content);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
