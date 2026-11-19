// GET /api/backlog?id=<id> — o que já foi enviado para um projeto, para continuar o preenchimento.
// Devolve o formulário do último envio (backlog-envios/<id>.json), o backlog como o Google vê
// e a imagem da timeline, se houver.
import { cfg, lerTexto, lerBytes, toBase64, Erro } from "../../lib/github.js";
import { bloqueado, visivel } from "../../lib/backlog.js";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const MIME = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };

export async function onRequestGet({ env, request }) {
  try {
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!/^[a-z0-9-]{2,40}$/.test(id)) throw new Erro(400, "Projeto inválido.");
    const c = cfg(env);
    const B = JSON.parse((await lerTexto(c, "backlogs.json")) || '{"backlogs":[]}');
    const b = B.backlogs.find((x) => x.id === id);
    if (!b) throw new Erro(404, "Projeto não encontrado.");
    if (bloqueado(b)) throw new Erro(403, "Este backlog é mantido pela Insula e não pode ser editado aqui.");
    const envio = await lerTexto(c, `backlog-envios/${id}.json`);
    let timeline = "";
    const m = /^img\/(backlog-[a-z0-9-]+-timeline)\.(webp|png|jpg)$/.exec(b.timeline_img || "");
    if (m) {
      const bytes = await lerBytes(c, b.timeline_img);
      if (bytes) timeline = `data:${MIME[m[2]]};base64,${toBase64(bytes)}`;
    }
    return json({ backlog: visivel(b), form: envio ? JSON.parse(envio).form || null : null, timeline });
  } catch (e) {
    return json({ erro: e.message }, e instanceof Erro ? e.status : 500);
  }
}
