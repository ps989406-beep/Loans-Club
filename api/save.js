// api/save.js (protected by ADMIN_PASS env var)
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    // AUTH CHECK: require ADMIN_PASS header
    const ADMIN_PASS = process.env.ADMIN_PASS || '';
    const provided = (req.headers['x-admin-pass'] || req.headers['x-admin-password'] || '').toString();
    if (!ADMIN_PASS || provided !== ADMIN_PASS) {
      return res.status(401).json({ error: 'Unauthorized: missing or invalid admin pass' });
    }

    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const path = 'data.json';
    const token = process.env.GITHUB_TOKEN;

    const body = req.body;
    const newContentObj = body.content;
    if (!newContentObj) return res.status(400).json({ error: 'Missing content in body' });

    // 1) Get current file to obtain SHA
    const getUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
    const cur = await fetch(getUrl, { headers: { 'User-Agent': 'loanclub-demo', 'Authorization': `token ${token}` } });
    if (!cur.ok) {
      const txt = await cur.text();
      return res.status(500).json({ error: 'Could not get current file', status: cur.status, text: txt });
    }
    const curJson = await cur.json();
    const sha = curJson.sha;

    // 2) Create commit payload
    const updatedBase64 = Buffer.from(JSON.stringify(newContentObj, null, 2)).toString('base64');
    const putUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`;
    const message = `Update data.json via Loan Club UI @ ${new Date().toISOString()}`;
    const putBody = {
      message,
      content: updatedBase64,
      sha,
      branch
    };
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'User-Agent': 'loanclub-demo', 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(putBody)
    });
    if (!putRes.ok) {
      const txt = await putRes.text();
      return res.status(500).json({ error: 'Failed to update file', status: putRes.status, text: txt });
    }
    // Return the new content as confirmation
    return res.status(200).json(newContentObj);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
