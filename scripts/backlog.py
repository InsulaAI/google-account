"""Lê a listagem da pasta de backlog de um projeto no Drive e grava o resultado em backlogs.json.

Uso: python3 -I scripts/backlog.py <id do backlog> <listagem.json>

A listagem é o que a rotina (ou alguém) lê no Drive: {"pasta_id", "lido_em", "arquivos": [
{"caminho": ["CENA 8", "Seedance 2.0"], "nome": "arquivo.mov", "id": "<id do arquivo no Drive>"}, ...]}.
Com o id, a página mostra o botão "Assistir no Drive" de cada vídeo, com o caminho relativo à
pasta do backlog. Convenção das pastas (a mesma do backlog do Mercado Pago):
  CENA <n> / <modelo> / takes entregues
  CENA <n> / <modelo> Tentativas / tentativas descartadas, o nome do arquivo é o plano + _<código>
Nomes de modelo digitados de jeitos diferentes ("Omini 1.1", "Omnin 1.1") são juntados pela
família mais parecida. Imagens, PDFs e arquivos fora de pastas CENA são ignorados.
"""
import datetime, difflib, json, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARQ = os.path.join(RAIZ, "backlogs.json")
VIDEO = {".mov", ".mp4", ".m4v", ".webm", ".avi", ".mkv", ".mxf", ".prores"}
FAMILIAS = {  # nome canônico: é modelo do Google?
    "Omni": True, "Veo": True, "Imagen": True, "Nano Banana": True, "Gemini": True, "Flow": True,
    "Seedance": False, "Kling": False, "Runway": False, "Hailuo": False, "Wan": False, "Sora": False,
    "Luma": False, "Pika": False, "Midjourney": False, "Flux": False, "Minimax": False, "Higgsfield": False,
}


def modelo(pasta):
    """'Omnin 1.1 Tentativas' -> ('Omni 1.1', True)."""
    tent = bool(re.search(r"tentativ", pasta, re.I))
    limpo = re.sub(r"tentativas?", "", pasta, flags=re.I).strip(" -_")
    ver = re.search(r"\d+(?:\.\d+)*", limpo)
    base = re.sub(r"[\d.]+", "", limpo).strip(" -_").lower()
    nomes = {k.lower(): k for k in FAMILIAS}
    achou = difflib.get_close_matches(base, list(nomes), n=1, cutoff=0.6)
    fam = nomes[achou[0]] if achou else (re.sub(r"[\d.]+", "", limpo).strip() or limpo)
    return (f"{fam} {ver.group(0)}" if ver else fam), fam, tent


def main(bid, listagem):
    L = json.load(open(listagem))
    cenas, modelos = {}, {}
    for a in L["arquivos"]:
        cam, nome = a["caminho"], a["nome"]
        ext = os.path.splitext(nome)[1].lower()
        m = re.match(r"\s*cena\s*0*(\d+)", cam[0] if cam else "", re.I)
        if not m or len(cam) < 2 or ext not in VIDEO:
            continue
        n = f"{int(m.group(1)):02d}"
        mod, fam, tent = modelo(cam[1])
        c = cenas.setdefault(n, {"cena": n, "entregue": {}, "tentativas": {}})
        stem = os.path.splitext(nome)[0]
        fid = str(a.get("id") or "")
        if tent:
            plano = re.sub(r"_[A-Za-z0-9]{6,}$", "", stem)
            c["tentativas"].setdefault(mod, {}).setdefault(plano, []).append(fid)
        else:
            take = re.search(r"cena_?\d+[A-Z]?(?:_[A-Z])?", stem, re.I)
            nomet = take.group(0).upper() if take and take.group(0).upper().startswith("CENA_") else stem
            c["entregue"].setdefault(mod, []).append((nomet, fid))
        M = modelos.setdefault(mod, {"modelo": mod, "google": FAMILIAS.get(fam, False), "cenas_entregues": 0, "takes_entregues": 0, "tentativas_descartadas": 0, "cenas_com_falha": 0})
    out = []
    for n in sorted(cenas):
        c = cenas[n]
        ent = [{"modelo": k, "takes": [t for t, _ in sorted(v)], "videos": [{"take": t, "id": i} for t, i in sorted(v) if i]} for k, v in c["entregue"].items()]
        ten = [{"modelo": k, "planos": [{"plano": p, "tentativas": len(q), "ids": [i for i in q if i]} for p, q in sorted(v.items(), key=lambda x: -len(x[1]))]} for k, v in c["tentativas"].items()]
        for e in ent:
            modelos[e["modelo"]]["cenas_entregues"] += 1
            modelos[e["modelo"]]["takes_entregues"] += len(e["takes"])
        for t in ten:
            modelos[t["modelo"]]["tentativas_descartadas"] += sum(p["tentativas"] for p in t["planos"])
            modelos[t["modelo"]]["cenas_com_falha"] += 1
        out.append({"cena": n, "entregue": ent, "tentativas": ten})
    if not out:
        sys.exit("nenhuma cena encontrada na listagem: confira as pastas CENA <n>/<modelo>/")
    D = json.load(open(ARQ))
    b = next((x for x in D["backlogs"] if x["id"] == bid), None)
    if b is None:
        sys.exit(f"backlog '{bid}' não existe em backlogs.json")
    b["drive"] = {"pasta_id": L.get("pasta_id", ""), "lido_em": L.get("lido_em") or datetime.date.today().isoformat(),
                  "cenas": out, "modelos": sorted(modelos.values(), key=lambda m: (not m["google"], -m["cenas_entregues"]))}
    json.dump(D, open(ARQ, "w"), ensure_ascii=False, indent=1)
    for m in b["drive"]["modelos"]:
        print(f'{m["modelo"]:<14} google={m["google"]!s:<5} cenas={m["cenas_entregues"]} takes={m["takes_entregues"]} descartes={m["tentativas_descartadas"]}')


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
