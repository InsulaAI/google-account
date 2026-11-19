// Regras do que o site da equipe pode gravar no backlogs.json do dashboard.
//
// Tudo o que chega do navegador é refeito aqui campo a campo: só passam as chaves que a
// página de backlog do Google usa, texto com tamanho máximo, links só do Google Drive e
// IDs de arquivo do Drive validados. Nada de valor em reais existe neste fluxo.

const s = (v, max = 300) => (typeof v === "string" ? v : v == null ? "" : String(v)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
const n = (v, max = 999) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x >= 0 ? Math.min(x, max) : 0; };
const lista = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const ID_DRIVE = /^[A-Za-z0-9_-]{10,100}$/;
const idDrive = (v) => (ID_DRIVE.test(String(v || "")) ? String(v) : "");
const urlDrive = (v) => {
  const u = s(v, 400);
  return /^https:\/\/(drive|docs)\.google\.com\/[^\s"<>]*$/.test(u) ? u : "";
};
const pastaId = (u) => { const m = String(u || "").match(/\/folders\/([A-Za-z0-9_-]{10,100})/); return m ? m[1] : ""; };
const nota = (v) => (["A+", "A", "B", "C"].includes(String(v)) ? String(v) : "");
const dim = (v) => (["A+", "A", "B", "C", "–"].includes(String(v)) ? String(v) : "–");

export const slug = (t) => s(t, 80).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

// Backlogs que só a Insula mexe: o oficial do Mercado Pago, a pasta de backup da SuperBet
// e os 100% Google sem backlog.
export const bloqueado = (b) => !!(b && (b.bloqueado || b.sem_backlog || b.link_direto));

export function limpar(b) {
  b = b && typeof b === "object" ? b : {};
  const f = b.falha && typeof b.falha === "object" ? b.falha : {};
  const out = {
    projeto: s(b.projeto, 80),
    titulo: s(b.titulo, 160),
    subtitulo: s(b.subtitulo, 400),
    data: s(b.data, 40),
    modelo_principal: s(b.modelo_principal, 60),
    pasta_url: urlDrive(b.pasta_url),
    timeline_titulo: s(b.timeline_titulo, 200),
    timeline_fonte: s(b.timeline_fonte, 200),
    resumo_titulo: s(b.resumo_titulo, 200),
    resumo_nota: s(b.resumo_nota, 600),
    resumo_fonte: s(b.resumo_fonte, 200),
    cenas: lista(b.cenas, 60).map((c) => ({
      cena: s(c && c.cena, 8),
      take: s(c && c.take, 160),
      modelo_imagem: s(c && c.modelo_imagem, 80),
      modelo_video: s(c && c.modelo_video, 80),
      descartes: s(c && c.descartes, 120),
      status: s(c && c.status, 80),
      trocou: !!(c && c.trocou),
      videos: lista(c && c.videos, 12).map((v) => ({ take: s(v && v.take, 160), id: idDrive(v && v.id) })).filter((v) => v.id),
    })),
    cenas_fonte: s(b.cenas_fonte, 200),
    falha: {
      titulo: s(f.titulo, 200),
      rotulo: s(f.rotulo, 120),
      planos: lista(f.planos, 80).map((p) => ({
        plano: s(p && p.plano, 160),
        cena: s(p && p.cena, 8),
        modelo: s(p && p.modelo, 80),
        tentativas: n(p && p.tentativas),
        ids: lista(p && p.ids, 60).map(idDrive).filter(Boolean),
      })).filter((p) => p.plano || p.tentativas),
      categoria: s(f.categoria, 400),
      o_que_deu_errado: s(f.o_que_deu_errado, 2000),
      prompt: s(f.prompt, 6000),
      solucao: s(f.solucao, 600),
      fonte: s(f.fonte, 200),
    },
  };
  out.pasta_id = pastaId(out.pasta_url);
  const K = b.klike && typeof b.klike === "object" ? b.klike : null;
  if (K) {
    out.klike = {
      pasta_url: urlDrive(K.pasta_url),
      fonte: s(K.fonte, 200),
      relatorios: lista(K.relatorios, 30).map((r) => ({
        filme: s(r && r.filme, 80),
        titulo: s(r && r.titulo, 160),
        versao: s(r && r.versao, 80),
        data: /^\d{4}-\d{2}-\d{2}$/.test(String(r && r.data)) ? String(r.data) : "",
        nota: nota(r && r.nota),
        dimensoes: lista(r && r.dimensoes, 10).map(dim),
        arquivo_id: idDrive(r && r.arquivo_id),
      })).filter((r) => r.nota),
    };
  }
  return out;
}

// O que o site da equipe pode ver de um backlog já gravado (sem o bloco drive nem notas internas).
export function visivel(b) {
  const out = limpar(b);
  out.id = b.id;
  out.timeline_img = typeof b.timeline_img === "string" ? b.timeline_img : "";
  out.enviado_por = s(b.enviado_por, 80);
  out.enviado_em = s(b.enviado_em, 40);
  out.tem_drive = !!b.drive;
  return out;
}

// Imagem da timeline: aceita só WebP, PNG ou JPEG de verdade (pelos bytes), até 4 MB.
export function imagem(dataUrl) {
  const m = String(dataUrl || "").match(/^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  if (bin.length > 4 * 1024 * 1024) return null;
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const at = (i, str) => [...str].every((ch, j) => bytes[i + j] === ch.charCodeAt(0));
  let ext = "";
  if (at(0, "RIFF") && at(8, "WEBP")) ext = "webp";
  else if (bytes[0] === 0x89 && at(1, "PNG")) ext = "png";
  else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ext = "jpg";
  return ext ? { bytes, ext } : null;
}
