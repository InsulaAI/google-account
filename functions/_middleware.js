// Porta de entrada da conta corrente Google: usuário e senha únicos, sessão por cookie assinado.
//
// Roda no Cloudflare Pages antes de qualquer arquivo ser servido: sem sessão válida,
// nada sai daqui, nem o index.html nem os dados. Também limita o que é servido a
// index.html, dados.json, vendor/d3.min.js e robots.txt: CLAUDE.md e scripts/ ficam no
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
  return ["/", "/index.html", "/dados.json", "/vendor/d3.min.js"].includes(path);
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
