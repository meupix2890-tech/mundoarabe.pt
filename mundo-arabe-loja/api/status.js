// Vercel Serverless Function - estado da transacao (polling)
const KEY = process.env.PAGEURO_API_KEY || '';
module.exports = async (req, res) => {
  const id = req.query.id;
    if (!id) return res.status(400).json({ status: 'unknown' });
      if (!KEY) return res.status(200).json({ status: 'waiting_payment', demo: true });
        try {
            const r = await fetch('https://api-gateway.pageuro.com/api/user/transactions/' + encodeURIComponent(id) + '/summary', { headers: { 'x-api-key': KEY, 'User-Agent': 'MundoArabe/1.0' } });
                const j = await r.json();
                    const d = (j && j.data) || {};
                        return res.status(200).json({ status: (d.status || '').toString().toLowerCase() || 'waiting_payment', paidAt: d.paidAt || null });
                          } catch (e) { return res.status(502).json({ status: 'unknown', message: e.message }); }
                          };
