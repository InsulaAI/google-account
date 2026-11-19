// GET /api/projetos — lista os backlogs que a equipe pode preencher (sem valores).
import { cfg, lerTexto, Erro } from "../../lib/github.js";
import { bloqueado } from "../../lib/backlog.js";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequestGet({ env }) {
  try {
    const c = cfg(env);
    const B = JSON.parse((await lerTexto(c, "backlogs.json")) || '{"backlogs":[]}');
    const projetos = B.backlogs.filter((b) => !bloqueado(b)).map((b) => ({ id: b.id, projeto: b.projeto, enviado_em: b.enviado_em || "", enviado_por: b.enviado_por || "" }));
    return json({ projetos, regua: B.regua || [], klike_dimensoes: B.klike_dimensoes || [] });
  } catch (e) {
    return json({ erro: e.message }, e instanceof Erro ? e.status : 500);
  }
}
