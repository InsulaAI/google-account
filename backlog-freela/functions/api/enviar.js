// POST /api/enviar — grava o backlog preenchido no dashboard do Google.
//
// Corpo: { form, backlog, imagem, manter_imagem, enviado_por }.
// Um commit no main com: backlogs.json (o backlog do projeto trocado ou acrescentado),
// a imagem da timeline em img/ e o formulário em backlog-envios/<id>.json (para continuar
// depois). A Cloudflare publica o dashboard em seguida.
import { cfg, lerTexto, commitar, Erro } from "../../lib/github.js";
import { bloqueado, limpar, slug, imagem } from "../../lib/backlog.js";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const LIMITE = 7 * 1024 * 1024;

export async function onRequestPost({ env, request }) {
  try {
    if (Number(request.headers.get("Content-Length") || 0) > LIMITE) throw new Erro(413, "Envio grande demais. Use um print da timeline menor.");
    const txt = await request.text();
    if (txt.length > LIMITE) throw new Erro(413, "Envio grande demais. Use um print da timeline menor.");
    let body;
    try { body = JSON.parse(txt); } catch { throw new Erro(400, "Envio inválido."); }

    const quem = String(body.enviado_por || "").trim().slice(0, 80);
    if (!quem) throw new Erro(400, "Preencha o seu nome antes de enviar.");
    const novo = limpar(body.backlog);
    if (!novo.projeto) throw new Erro(400, "Escolha o projeto antes de enviar.");
    const id = /^[a-z0-9-]{2,40}$/.test(String(body.id || "")) ? String(body.id) : slug(novo.projeto);
    if (!/^[a-z0-9-]{2,40}$/.test(id)) throw new Erro(400, "Nome de projeto inválido.");
    const img = body.imagem ? imagem(body.imagem) : null;
    if (body.imagem && !img) throw new Erro(400, "A timeline precisa ser uma imagem PNG, JPG ou WebP de até 4 MB.");
    const form = body.form && typeof body.form === "object" ? body.form : {};
    const formTxt = JSON.stringify({ id, enviado_por: quem, enviado_em: new Date().toISOString(), form }, null, 1);
    if (formTxt.length > 400000) throw new Erro(413, "Formulário grande demais.");

    const c = cfg(env);
    const quando = new Date().toISOString();
    let resultado = null;
    await commitar(c, async (ref) => {
      const raw = await lerTexto(c, "backlogs.json", ref);
      const B = JSON.parse(raw || '{"backlogs":[]}');
      const i = B.backlogs.findIndex((x) => x.id === id);
      const antigo = i >= 0 ? B.backlogs[i] : null;
      if (bloqueado(antigo)) throw new Erro(403, "Este backlog é mantido pela Insula e não pode ser editado aqui.");

      const arquivos = [];
      let timeline = "";
      if (img) {
        timeline = `img/backlog-${id}-timeline.${img.ext}`;
        arquivos.push({ path: timeline, bytes: img.bytes });
      } else if (body.manter_imagem && antigo && antigo.timeline_img) timeline = antigo.timeline_img;

      const b = { id, oficial: !!(antigo && antigo.oficial), ...novo, timeline_img: timeline };
      if (antigo && antigo.drive) b.drive = antigo.drive; // a leitura da pasta do Drive continua valendo
      if (antigo && antigo.klike && (!b.klike || !b.klike.relatorios.length) && antigo.klike.relatorios && antigo.klike.relatorios.length) b.klike = antigo.klike;
      if (!b.klike && antigo && antigo.klike) b.klike = antigo.klike;
      b.enviado_por = quem;
      b.enviado_em = quando;
      if (i >= 0) B.backlogs[i] = b; else B.backlogs.push(b);

      arquivos.push({ path: "backlogs.json", texto: JSON.stringify(B, null, 1) });
      arquivos.push({ path: `backlog-envios/${id}.json`, texto: formTxt });
      resultado = { id, timeline_img: timeline };
      return { arquivos, mensagem: `Backlog ${novo.projeto}: enviado por ${quem} pelo site da equipe` };
    });
    return json({ ok: true, ...resultado, enviado_em: quando });
  } catch (e) {
    return json({ erro: e.message }, e instanceof Erro ? e.status : 500);
  }
}
