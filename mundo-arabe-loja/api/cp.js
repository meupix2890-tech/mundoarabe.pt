// Vercel Serverless Function - codigo postal (auto-preenchimento)
function getJson(u) { return fetch(u, { headers: { 'User-Agent': 'MundoArabe/1.0' } }).then(r => r.json()); }
module.exports = async (req, res) => {
  const cp = (req.query.cp || '').trim();
  if (!/^\d{4}-?\d{3}$/.test(cp)) return res.status(400).json({ ok: false });
  const norm = cp.replace(/(\d{4})-?(\d{3})/, '$1-$2');
  let localidade = '', distrito = '', concelho = '';
  try { const z = await getJson('https://api.zippopotam.us/pt/' + norm); if (z && z.places && z.places[0]) { localidade = z.places[0]['place name'] || ''; distrito = z.places[0].state || ''; } } catch (e) {}
      try { const g = await getJson('https://json.geoapi.pt/cp/' + norm); if (g && g.Concelho) { concelho = g.Concelho; if (!localidade) localidade = g.Localidade || g.Concelho; if (!distrito) distrito = g.Distrito || ''; } } catch (e) {}
      if (!localidade) return res.status(404).json({ ok: false });
  return res.status(200).json({ ok: true, cp: norm, localidade, concelho, distrito, rua: '' });
                                                                                               };
