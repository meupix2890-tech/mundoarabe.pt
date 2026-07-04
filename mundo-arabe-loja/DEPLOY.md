# Deploy — Mundo Árabe

Site (loja + painel admin + gateway Pageuro) num único servidor Node. Precisa de um host **Node** (não serve num host só de ficheiros estáticos, por causa do backend de pagamentos).

## Opção A — Render (grátis, recomendado)

1. Cria conta em https://render.com
2. Sobe este projeto para um repositório GitHub (ver secção Git no fim).
3. No Render: **New → Web Service → Connect** o repositório.
   - Runtime: **Node**
   - Build Command: *(vazio)*
   - Start Command: `node server.js`
4. Em **Environment** adiciona a variável:
   - `PAGEURO_API_KEY` = a tua chave secreta da Pageuro
5. **Create Web Service.** Ficas com um URL tipo `https://mundo-arabe.onrender.com`.
   - Loja: `https://mundo-arabe.onrender.com`
   - Admin: `https://mundo-arabe.onrender.com/admin` (senha 700700)

> O `render.yaml` já está incluído — podes também usar **New → Blueprint** e o Render configura tudo sozinho (só tens de meter a `PAGEURO_API_KEY`).

## Opção B — Railway

1. Conta em https://railway.app → **New Project → Deploy from GitHub repo**.
2. Railway deteta o `package.json` e corre `npm start`.
3. Em **Variables** adiciona `PAGEURO_API_KEY`.
4. **Settings → Generate Domain** para obteres o URL público.

## Configurar o WEBHOOK na Pageuro

Depois de teres o URL público, no painel da Pageuro define o postback/webhook para:

```
https://O_TEU_DOMINIO/api/webhook
```

Assim que um pagamento é confirmado, a Pageuro avisa este endpoint e a encomenda passa a **Pago** automaticamente. (O site também já verifica o estado sozinho por polling.)

## Subir para GitHub (para as opções A/B)

```bash
cd mundo-arabe
git init
git add .
git commit -m "Loja Mundo Árabe + Pageuro"
# cria um repositório vazio no GitHub e depois:
git remote add origin https://github.com/O_TEU_USER/mundo-arabe.git
git branch -M main
git push -u origin main
```

⚠️ O `.env` (com o token) **não** vai para o GitHub — está no `.gitignore`. No host, a chave entra como **variável de ambiente** `PAGEURO_API_KEY`.

## Correr localmente

```bash
node server.js        # lê a chave do .env
# loja:  http://localhost:4000
# admin: http://localhost:4000/admin
```
