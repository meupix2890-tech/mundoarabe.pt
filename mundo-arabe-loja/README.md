# Mundo Árabe — Loja (pronta para hospedagem)

Estrutura por pastas: **cada página tem a sua pasta com `index.html`**.

```
mundo-arabe-loja/
├── index.html          →  LOJA (página inicial)   →  /
├── admin/
│   └── index.html      →  PAINEL ADMIN            →  /admin
├── assets/
│   ├── hero-bg.jpg
│   └── logo.webp
├── config.js           →  onde apontas o backend
├── server.js           →  BACKEND (pagamentos Pageuro) — opcional
├── package.json / render.yaml / Procfile / .env.example / DEPLOY.md
```

> A **loja** é uma aplicação de página única — produto, carrinho e checkout aparecem por cima da loja (não são páginas HTML separadas). As duas páginas reais são **a loja** (`/`) e o **admin** (`/admin`).

---

## Como publicar — 2 modos

### ✅ Modo A — Host Node (recomendado, funciona 100%)
Publica a pasta inteira num host **Node** (Render, Railway, VPS, etc.). O `server.js` serve a loja, o admin **e** os pagamentos, tudo no mesmo domínio.

1. Define a variável de ambiente `PAGEURO_API_KEY` (a tua chave da Pageuro).
2. Comando de arranque: `node server.js`
3. Fica: loja em `/` · admin em `/admin` (senha `700700`).
4. `config.js` fica com `MA_API_BASE = ""` (mesmo domínio) — não mexes em nada.

Ver **DEPLOY.md** para passos detalhados (Render/Railway).

### 🌐 Modo B — Host só de ficheiros estáticos (sem Node)
Se o teu host **não corre Node** (ex.: alojamento partilhado, Netlify/Vercel estático, cPanel):

1. Sobe as pastas `index.html`, `admin/`, `assets/`, `config.js`.
2. O backend (`server.js`) tem de correr **noutro sítio** (um host Node) — é o "backend já criado".
3. Em **`config.js`**, mete o URL desse backend:
   ```js
   window.MA_API_BASE = "https://o-teu-backend.onrender.com";
   ```
   Assim a loja estática "puxa" o backend para processar os pagamentos.

> A pesquisa de **código postal** e o **admin** funcionam mesmo sem backend (o admin usa dados locais do navegador).

---

## Correr localmente (para testar)
```bash
node server.js
# loja:  http://localhost:4000
# admin: http://localhost:4000/admin   (senha 700700)
```

## Pagamentos (Pageuro)
Todo o pagamento passa pelo backend → Pageuro (MB WAY / Multibanco). Para a confirmação automática, aponta o webhook da Pageuro para `https://O_TEU_DOMINIO/api/webhook`.

⚠️ Não incluímos o `.env` (com a chave secreta). Define a `PAGEURO_API_KEY` como variável de ambiente no host, ou cria um `.env` a partir do `.env.example`.
