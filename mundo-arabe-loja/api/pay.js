// Vercel Serverless Function - criar pagamento na Pageuro
const PAGEURO = 'https://api-gateway.pageuro.com/api/user/transactions';
const KEY = process.env.PAGEURO_API_KEY || '';
const cents = v => Math.round((Number(v) || 0) * 100);
const METHOD = { mbway: 'MBWAY', multibanco: 'MULTIBANCO', cartao: 'CREDIT_CARD' };
function buildPayload(o) {
  const c = o.customer || {};
    const st = ((c.cidade || 'Portugal').normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()) || 'PT';
      const addr = { street: c.addr || 'N/D', streetNumber: 'S/N', complement: '', zipCode: c.cp || '0000-000', neighborhood: c.cidade || 'N/D', city: c.cidade || 'N/D', state: st, country: 'PT' };
        return {
            amount: cents(o.total), currency: 'EUR', paymentMethod: METHOD[o.method] || 'MULTIBANCO',
                customer: { name: c.nome || 'Cliente', email: c.email || 'sem@email.pt', phone: (c.tel || '000000000').replace(/\s/g, ''), externalRef: c.email || ('c' + Date.now()), address: addr },
                    shipping: { fee: cents(o.envio), address: addr },
                        items: (o.items || []).map((it, i) => ({ title: it.nome || 'Produto', unitPrice: cents(it.preco), quantity: it.qtd || 1, tangible: true, externalRef: it.id || ('p' + i) })),
                            postbackUrl: (o.origin || '') + '/api/webhook', metadata: JSON.stringify({ loja: 'Mundo Arabe' })
                              };
                              }
                              function extract(d) {
                                d = d || {};
                                  return { id: d.id, status: (d.status || '').toString().toLowerCase(), entity: d.mbEntity || d.entity || null, reference: d.mbReference || d.reference || null, qrCode: d.qrCode || (d.pix && d.pix.qrcode) || null, checkoutUrl: d.mbwayUrl || d.payUrl || d.webUrl || d.appUrl || d.secureUrl || null };
                                  }
                                  module.exports = async (req, res) => {
                                    if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Metodo invalido' });
                                      let o = req.body;
                                        if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = {}; } }
                                          o = o || {};
                                            const payload = buildPayload(o);
                                              if (!KEY) {
                                                  return res.status(200).json({ ok: true, demo: true, id: 'demo_' + Date.now(), status: 'waiting_payment', entity: String(20000 + Math.floor(Math.random() * 79999)), reference: String(100000000 + Math.floor(Math.random() * 899999999)), amount: payload.amount });
                                                    }
                                                      try {
                                                          const r = await fetch(PAGEURO, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'User-Agent': 'MundoArabe/1.0' }, body: JSON.stringify(payload) });
                                                              const j = await r.json();
                                                                  if (r.ok) { const info = extract(j && j.data); return res.status(200).json(Object.assign({ ok: true, amount: payload.amount }, info)); }
                                                                      return res.status(r.status).json({ ok: false, message: (j && j.message) || 'Pagamento recusado', raw: j });
                                                                        } catch (e) { return res.status(502).json({ ok: false, message: 'Erro na gateway: ' + e.message }); }
                                                                        };
