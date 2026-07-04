// Mundo Árabe — servidor + processamento de pagamentos 100% via Pageuro
// Correr:  PAGEURO_API_KEY=xxxx node server.js
// Sem chave => MODO DEMO (referências fictícias, "paga" ao fim de 8s; não cobra).
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Carrega variáveis do ficheiro .env (se existir) — evita escrever o token no terminal
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  });
} catch (e) {}

const PORT = process.env.PORT || 4000;
const KEY = process.env.PAGEURO_API_KEY || '';
const DIR = __dirname;
const API = 'https://api-gateway.pageuro.com';
const STORE = path.join(DIR, 'payments.json');

const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon' };

function send(res, code, body, type){ res.writeHead(code, {'Content-Type': type||'application/json','Access-Control-Allow-Origin':'*'}); res.end(typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body)); }
// GET JSON genérico (para APIs externas) com timeout
function httpsJson(u, timeout){
  return new Promise((resolve, reject) => {
    const req = https.get(u, {headers:{'User-Agent':'MundoArabe/1.0'}}, r => {
      let b=''; r.on('data',c=>b+=c); r.on('end',()=>{ try{ resolve(JSON.parse(b)); }catch(e){ reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(timeout||6000, ()=>{ req.destroy(); reject(new Error('timeout')); });
  });
}
const cents = v => Math.round((Number(v)||0)*100);
const METHOD = { mbway:'MBWAY', multibanco:'MULTIBANCO', cartao:'CREDIT_CARD' };

// ---- pequena "base de dados" de pagamentos (para webhook + estado) ----
function loadStore(){ try{ return JSON.parse(fs.readFileSync(STORE,'utf8')); }catch(e){ return {}; } }
function saveStore(s){ try{ fs.writeFileSync(STORE, JSON.stringify(s,null,2)); }catch(e){} }
function setPayment(id, data){ if(!id) return; const s=loadStore(); s[id]=Object.assign({}, s[id], data, {updatedAt:new Date().toISOString()}); saveStore(s); }
function getPayment(id){ return loadStore()[id]; }

// ---- chamada genérica à Pageuro (chave secreta só aqui, no servidor) ----
function pageuro(method, pathname, payload){
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const req = https.request(API + pathname, {
      method,
      headers: Object.assign(
        { 'Content-Type':'application/json', 'x-api-key':KEY, 'User-Agent':'MundoArabe/1.0' },
        data ? { 'Content-Length': Buffer.byteLength(data) } : {}
      )
    }, r => { let b=''; r.on('data',c=>b+=c); r.on('end',()=>{ let j; try{ j=JSON.parse(b); }catch(e){ j={raw:b}; } resolve({status:r.statusCode, body:j}); }); });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function buildPayload(o){
  const c = o.customer || {};
  const st = ((c.cidade||'Portugal').normalize('NFD').replace(/[^A-Za-z]/g,'').slice(0,2).toUpperCase()) || 'PT';
  const addr = { street:c.addr||'N/D', streetNumber:'S/N', complement:'', zipCode:c.cp||'0000-000', neighborhood:c.cidade||'N/D', city:c.cidade||'N/D', state:st, country:'PT' };
  return {
    amount: cents(o.total),
    currency: 'EUR',
    paymentMethod: METHOD[o.method] || 'MULTIBANCO',
    customer: { name:c.nome||'Cliente', email:c.email||'sem@email.pt', phone:(c.tel||'000000000').replace(/\s/g,''), externalRef:c.email||('c'+Date.now()), address:addr },
    shipping: { fee: cents(o.envio), address: addr },
    items: (o.items||[]).map((it,i)=>({ title:it.nome||'Produto', unitPrice:cents(it.preco), quantity:it.qtd||1, tangible:true, externalRef:it.id||('p'+i) })),
    postbackUrl: (o.origin || ('http://localhost:'+PORT)) + '/api/webhook',
    metadata: JSON.stringify({ loja:'Mundo Árabe' })
  };
}

// extrai referência/entidade Multibanco da resposta (campo não documentado -> tentamos vários)
function extract(d){
  d = d || {};
  const mb = d.multibanco || d.mb || {};
  return {
    id: d.id,
    status: (d.status||'').toString().toLowerCase(),
    entity: d.mbEntity || d.entity || d.entidade || mb.entity || mb.entidade || null,
    reference: d.mbReference || d.reference || d.referencia || mb.reference || mb.referencia || null,
    qrCode: d.qrCode || (d.pix && d.pix.qrcode) || null,
    checkoutUrl: d.mbwayUrl || d.payUrl || d.webUrl || d.appUrl || d.secureUrl || d.checkoutUrl || d.url || (d.pix && d.pix.url) || null,
    raw: d
  };
}

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);

  // ---- Criar pagamento ----
  if (req.method === 'POST' && u.pathname === '/api/pay') {
    let body=''; req.on('data',c=>body+=c); req.on('end', async () => {
      let o; try{ o=JSON.parse(body||'{}'); }catch(e){ return send(res,400,{ok:false,message:'JSON inválido'}); }
      const payload = buildPayload(o);

      if (!KEY) { // DEMO
        const id='demo_'+Date.now();
        setPayment(id, {status:'waiting_payment', created:Date.now(), demo:true, order:o.orderNum||null});
        return send(res,200,{ ok:true, demo:true, id, status:'waiting_payment', entity:String(20000+Math.floor(Math.random()*79999)), reference:String(100000000+Math.floor(Math.random()*899999999)), amount:payload.amount });
      }
      try {
        const r = await pageuro('POST','/api/user/transactions', payload);
        console.log('[Pageuro] '+payload.paymentMethod+' → HTTP '+r.status);
        if (r.status>=200 && r.status<300) {
          const info = extract(r.body && r.body.data);
          setPayment(info.id, {status:info.status||'waiting_payment', method:payload.paymentMethod, amount:payload.amount, order:o.orderNum||null});
          return send(res,200, Object.assign({ok:true, amount:payload.amount}, info));
        }
        send(res, r.status, {ok:false, message:(r.body&&r.body.message)||'Pagamento recusado pela gateway', raw:r.body});
      } catch(e){ send(res,502,{ok:false, message:'Erro a contactar a gateway: '+e.message}); }
    });
    return;
  }

  // ---- Estado da transação (polling) ----
  if (req.method === 'GET' && u.pathname === '/api/status') {
    const id = u.query.id; if(!id) return send(res,400,{status:'unknown',message:'id em falta'});
    const local = getPayment(id) || {};
    if (!KEY) { // DEMO: "paga" 8s depois (ou logo, se o webhook já confirmou)
      if (local.status==='paid') return send(res,200,{status:'paid', paidAt:local.paidAt||null, demo:true});
      const paid = local.created && (Date.now()-local.created>8000);
      if(paid && local.status!=='paid'){ setPayment(id,{status:'paid',paidAt:new Date().toISOString()}); }
      return send(res,200,{status: paid?'paid':'waiting_payment', demo:true});
    }
    // se o webhook já confirmou, responde logo
    if (local.status==='paid') return send(res,200,{status:'paid', paidAt:local.paidAt||null});
    (async()=>{
      try{
        const r = await pageuro('GET','/api/user/transactions/'+encodeURIComponent(id)+'/summary');
        const d = (r.body && r.body.data) || {};
        const st = (d.status||'').toString().toLowerCase();
        if(st) setPayment(id,{status:st, paidAt:d.paidAt||null});
        send(res,200,{status:st||'waiting_payment', paidAt:d.paidAt||null});
      }catch(e){ send(res,502,{status:'unknown', message:e.message}); }
    })();
    return;
  }

  // ---- Webhook (confirmação automática da Pageuro) ----
  if (req.method === 'POST' && u.pathname === '/api/webhook') {
    let body=''; req.on('data',c=>body+=c); req.on('end', () => {
      let tx={}; try{ const j=JSON.parse(body||'{}'); tx=j.data||j.transaction||j; }catch(e){}
      const id = tx.id || tx.transactionId;
      const status = (tx.status||'').toString().toLowerCase();
      if (id && status) setPayment(id, {status, paidAt:tx.paidAt||null, webhook:true});
      try{ fs.appendFileSync(path.join(DIR,'webhooks.log'), new Date().toISOString()+' '+body+'\n'); }catch(e){}
      console.log('[Webhook] id='+id+' status='+status);
      send(res,200,{ok:true});
    });
    return;
  }

  // ---- Código postal (auto-preenchimento) ----
  if (req.method === 'GET' && u.pathname === '/api/cp') {
    const cp = (u.query.cp||'').trim();
    if (!/^\d{4}-?\d{3}$/.test(cp)) return send(res,400,{ok:false,message:'Código postal inválido'});
    const norm = cp.replace(/(\d{4})-?(\d{3})/,'$1-$2');
    (async()=>{
      let localidade='', distrito='', concelho='', rua='';
      // 1) Zippopotam (sem chave, sem limite) → localidade + distrito
      try{
        const z = await httpsJson('https://api.zippopotam.us/pt/'+norm, 6000);
        if (z && z.places && z.places[0]) { localidade = z.places[0]['place name']||''; distrito = z.places[0].state||''; }
      }catch(e){}
      // 2) GeoAPI (best-effort) → rua + concelho (pode ter limite; ignoramos se falhar)
      try{
        const g = await httpsJson('https://json.geoapi.pt/cp/'+norm, 5000);
        if (g && g.Concelho) { concelho = g.Concelho; if(!localidade) localidade = g.Localidade||g.Concelho; if(!distrito) distrito = g.Distrito||''; rua = (g.partes && g.partes[0] && (g.partes[0]['Artéria']||g.partes[0]['Arteria'])) || ''; }
      }catch(e){}
      if (!localidade) return send(res,404,{ok:false,message:'Código postal não encontrado'});
      send(res,200,{ ok:true, cp:norm, localidade, concelho, distrito, rua });
    })();
    return;
  }

  if (req.method === 'OPTIONS') { return send(res,204,''); }

  // ---- Ficheiros estáticos ----
  let p = decodeURIComponent(u.pathname);
  if (p==='/'||p==='') p='/index.html';
  if (p==='/admin' || p==='/admin/') p='/admin/index.html';
  const file = path.normalize(path.join(DIR, p));
  if (!file.startsWith(DIR)) return send(res,403,'Forbidden','text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res,404,'Não encontrado','text/plain');
    send(res,200,data, MIME[path.extname(file)]||'application/octet-stream');
  });
});

server.listen(PORT, () => {
  console.log('Mundo Árabe → http://localhost:'+PORT+'  (loja + /admin)');
  console.log(KEY ? '✓ Pageuro ATIVO — todo o pagamento passa pela gateway' : '⚠ MODO DEMO — define PAGEURO_API_KEY para cobrar a sério');
});
