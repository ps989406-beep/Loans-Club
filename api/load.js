// api/load.js
export default async function handler(req, res) {
  try {
    const repo = process.env.GITHUB_REPO; // e.g. "username/Loans-Club"
    const branch = process.env.GITHUB_BRANCH || 'main';
    const path = 'data.json';
    const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
    const token = process.env.GITHUB_TOKEN;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'loanclub-demo', 'Authorization': `token ${token}` }
    });
    if (!r.ok) {
      return res.status(500).json({error: 'Could not load data.json', status: r.status, text: await r.text()});
    }
    const j = await r.json();
    const content = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'));
    // return content as JSON
    res.setHeader('Cache-Control','no-store');
    res.status(200).json(content);
  } catch (err) {
    res.status(500).json({error: String(err)});
  }
}
