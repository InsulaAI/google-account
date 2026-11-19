// Leitura e escrita no repositório do dashboard (InsulaAI/google-account) pela API do GitHub.
//
// O site da equipe não guarda nada: cada envio vira um commit no `main`, que a Cloudflare
// publica no dashboard do Google em cerca de um minuto. O token fica na variável secreta
// GITHUB_TOKEN do projeto no Cloudflare Pages (nunca no repositório).

const enc = new TextEncoder();

export function cfg(env) {
  if (!env.GITHUB_TOKEN) throw new Erro(500, "O site ainda não está ligado ao dashboard (falta o GITHUB_TOKEN no Cloudflare).");
  return {
    api: (env.GITHUB_API || "https://api.github.com").replace(/\/$/, ""),
    repo: env.GITHUB_REPO || "InsulaAI/google-account",
    branch: env.GITHUB_BRANCH || "main",
    token: env.GITHUB_TOKEN,
  };
}

export class Erro extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

async function gh(c, path, opt = {}) {
  const res = await fetch(`${c.api}/repos/${c.repo}${path}`, {
    method: opt.method || "GET",
    headers: {
      Authorization: `Bearer ${c.token}`,
      Accept: opt.raw ? "application/vnd.github.raw" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "insula-backlog",
      ...(opt.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  if (opt.allow404 && res.status === 404) return null;
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    const e = new Erro(502, `GitHub respondeu ${res.status}${t ? ": " + t.slice(0, 200) : ""}`);
    e.gh = res.status;
    throw e;
  }
  if (opt.raw === "bytes") return new Uint8Array(await res.arrayBuffer());
  if (opt.raw) return res.text();
  return res.json();
}

export async function headSha(c) {
  const r = await gh(c, `/git/ref/heads/${c.branch}`);
  return r.object.sha;
}

export async function lerTexto(c, path, ref) {
  return gh(c, `/contents/${path}?ref=${encodeURIComponent(ref || c.branch)}`, { raw: true, allow404: true });
}

export async function lerBytes(c, path, ref) {
  return gh(c, `/contents/${path}?ref=${encodeURIComponent(ref || c.branch)}`, { raw: "bytes", allow404: true });
}

const b64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
export const toBase64 = b64;

// Um commit com vários arquivos de uma vez. `montar(ref)` recebe o sha do main e devolve
// { arquivos: [{path, texto}|{path, bytes}], mensagem }. Se outro commit entrar no meio
// (a rotina do dashboard, outro freelancer), tenta de novo a partir do main novo.
export async function commitar(c, montar) {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const sha = await headSha(c);
    const base = await gh(c, `/git/commits/${sha}`);
    const { arquivos, mensagem } = await montar(sha);
    const tree = [];
    for (const a of arquivos) {
      const blob = await gh(c, "/git/blobs", {
        method: "POST",
        body: a.bytes ? { content: b64(a.bytes), encoding: "base64" } : { content: b64(enc.encode(a.texto)), encoding: "base64" },
      });
      tree.push({ path: a.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const t = await gh(c, "/git/trees", { method: "POST", body: { base_tree: base.tree.sha, tree } });
    const novo = await gh(c, "/git/commits", { method: "POST", body: { message: mensagem, tree: t.sha, parents: [sha] } });
    try {
      await gh(c, `/git/refs/heads/${c.branch}`, { method: "PATCH", body: { sha: novo.sha, force: false } });
      return novo.sha;
    } catch (e) {
      if (e.gh === 422 || e.gh === 409) continue; // o main andou: refaz em cima dele
      throw e;
    }
  }
  throw new Erro(409, "Outro envio entrou ao mesmo tempo. Tente enviar de novo.");
}
