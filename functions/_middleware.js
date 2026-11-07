// Porta de entrada da conta corrente Google: usuário e senha únicos, sessão por cookie assinado.
//
// Roda no Cloudflare Pages antes de qualquer arquivo ser servido: sem sessão válida,
// nada sai daqui, nem o index.html nem os dados. Também limita o que é servido a
// index.html, dados.json, vendor/d3.min.js, img/insula-logo.webp e robots.txt: CLAUDE.md e scripts/ ficam no
// repositório mas nunca chegam a quem tem a senha.
//
// A senha não está neste arquivo, só o hash dela. Para trocar, ver CLAUDE.md.

const USER = "google";
const SALT = "11550d384e2b6fee30359e84417eea22";
const PASS_HASH = "f039cb776c4a5a6b28dbe5d4aa53865eab7a30e7d60850204b1bfd5bb89da5c2"; // sha256(SALT + ":" + senha), em hex
const SESSION_SECRET = "923649719f38500865c1c1f323e1695df75f494c3c6bfa2997aca80e126be7f7";
const SESSION_HOURS = 12;

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256(s) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

async function sign(msg) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

// Comparação em tempo constante, para não vazar informação pelo tempo de resposta.
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// A sessão inclui o hash da senha na assinatura: trocar a senha derruba todas as
// sessões abertas, sem precisar de mais nada.
async function validSession(request) {
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)cg_s=(\d+)\.([0-9a-f]{64})/);
  if (!m) return false;
  if (!(Number(m[1]) > Date.now() / 1000)) return false;
  return same(m[2], await sign(m[1] + ":" + PASS_HASH));
}

function servable(path) {
  return ["/", "/index.html", "/dados.json", "/vendor/d3.min.js", "/img/insula-logo.webp"].includes(path);
}

function safeNext(n) {
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/";
}

const esc = (s) => s.replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c]));

async function login(request) {
  const form = await request.formData();
  const user = String(form.get("usuario") || "").trim().toLowerCase();
  const pass = String(form.get("senha") || "");
  const next = safeNext(String(form.get("next") || "/"));
  const userOk = same(user, USER);
  const passOk = same(await sha256(SALT + ":" + pass), PASS_HASH);
  if (!(userOk && passOk)) {
    await new Promise((r) => setTimeout(r, 600)); // freia tentativa em série
    return page(next, true);
  }
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600);
  const token = exp + "." + (await sign(exp + ":" + PASS_HASH));
  return new Response(null, {
    status: 303,
    headers: {
      Location: next,
      "Set-Cookie": `cg_s=${token}; Path=/; Max-Age=${SESSION_HOURS * 3600}; HttpOnly; Secure; SameSite=Lax`,
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/robots.txt") return next();
  if (path === "/__login" && request.method === "POST") return login(request);
  if (!(await validSession(request))) return page(path + url.search, false);
  if (!servable(path)) {
    return new Response("Não encontrado.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "private, no-cache");
  out.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return out;
}

function page(next, error) {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Insula AI · Acesso restrito</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mulish:wght@400..800&family=Archivo:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  :root{
    --ground:#0A1020;--surface:#111931;--line:#222E4E;
    --text:#E9E5DC;--text-2:#B3BACE;--text-3:#7F889F;--amber:#D9A566;
    --display:"Mulish","Helvetica Neue",Arial,sans-serif;
    --sans:"Archivo","Helvetica Neue",Arial,sans-serif;
    --mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;
  }
  *{box-sizing:border-box}
  html,body{min-height:100%}
  body{
    margin:0;background:var(--ground);color:var(--text);
    font-family:var(--sans);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;
    display:grid;place-items:center;min-height:100vh;padding:32px 16px;
  }
  main{width:100%;max-width:380px}
  .logo{display:block;height:80px;width:auto;margin:0 0 22px}
  .k{font-family:var(--mono);font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--text-3);margin:0 0 18px}
  h1{
    font-family:var(--display);font-weight:600;letter-spacing:-.01em;
    -webkit-font-smoothing:auto;font-size:46px;line-height:1.05;margin:0 0 14px;
  }
  p{color:var(--text-2);margin:0 0 28px}
  label{display:block;font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-3);margin:0 0 7px}
  input{
    width:100%;font:inherit;color:var(--text);background:var(--surface);
    border:1px solid var(--line);border-radius:2px;padding:12px 14px;margin:0 0 18px;outline:none;
  }
  input:focus{border-color:var(--amber)}
  button{
    width:100%;font:inherit;font-weight:600;color:var(--ground);background:var(--amber);
    border:0;border-radius:2px;padding:13px 14px;margin-top:6px;cursor:pointer;
  }
  button:focus-visible{outline:2px solid var(--text);outline-offset:2px}
  .err{border-left:2px solid var(--amber);padding:2px 0 2px 12px;color:var(--text);margin:0 0 22px}
  .foot{font-size:12.5px;color:var(--text-3);margin:26px 0 0}
</style>
</head>
<body>
<main>
  <img class="logo" alt="Insula AI" width="156" height="160" src="data:image/webp;base64,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">
  <p class="k">Relatório de projetos · Confidencial</p>
  <h1>Insula AI</h1>
  <p>Relatório da Insula AI sobre os projetos produzidos para o Google em 2026. Entre com o usuário e a senha que a Insula enviou a você.</p>
  ${error ? '<p class="err" role="alert">Usuário ou senha incorretos.</p>' : ""}
  <form method="post" action="/__login">
    <input type="hidden" name="next" value="${esc(next)}">
    <label for="u">Usuário</label>
    <input id="u" name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" required${error ? "" : " autofocus"}>
    <label for="s">Senha</label>
    <input id="s" name="senha" type="password" autocomplete="current-password" required${error ? " autofocus" : ""}>
    <button type="submit">Entrar</button>
  </form>
  <p class="foot">Página da Insula AI (insula-ai.com). Esta não é uma página do Google: não use aqui sua senha de conta Google.</p>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 401,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
