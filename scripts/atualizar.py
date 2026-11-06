"""Gera dados.json (o que o site mostra) a partir das três planilhas da conta corrente Google.

Uso:
  python3 -I scripts/atualizar.py <cuentas.xlsx> <latam.xlsx> <afaturar.xlsx> \
      --origem <modifiedTime cuentas> <modifiedTime latam> <modifiedTime afaturar> \
      [--json-separados <pasta>]

Lê o dados.json atual (na raiz do repositório) para manter os textos de linhas que já existiam
(lançamento, serviço, observação, nome do projeto) e o sobrescreve. Linhas novas ganham texto
gerado. Com --json-separados, grava também movimentos.json, a_faturar.json, producao.json e
precos.json nessa pasta, no formato do dashboard no claude.ai.
"""
import argparse, datetime, json, os, re, sys
import openpyxl

ap = argparse.ArgumentParser()
ap.add_argument("cuentas"); ap.add_argument("latam"); ap.add_argument("afaturar")
ap.add_argument("--origem", nargs=3, metavar=("CUENTAS", "LATAM", "AFATURAR"), required=True)
ap.add_argument("--json-separados")
args = ap.parse_args()
cuentas, latam, afaturar = args.cuentas, args.latam, args.afaturar
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = os.path.join(RAIZ, "dados.json")
anterior = json.load(open(DADOS)) if os.path.exists(DADOS) else {}


def load_prev(name):
    return anterior.get(name.replace(".json", ""), [])

def num(v):
    if v in (None, ""):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("R$", "").replace(" ", "")
    if re.fullmatch(r"-?[\d.]+,\d+", s):
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def ident(v):
    n = num(v)
    if n is not None and n == int(n):
        return str(int(n))
    return "" if v in (None, "") else str(v).strip()


def iso(v):
    if v in (None, ""):
        return ""
    if hasattr(v, "strftime"):
        return v.strftime("%Y-%m-%d")
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", str(v).strip())
    if m:
        return f"{m[3]}-{int(m[2]):02d}-{int(m[1]):02d}"
    return str(v).strip()[:10]


def clean(v):
    return round(v, 2) if v is not None else None


def brl(v):
    s = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return "R$ " + (s[:-3] if s.endswith(",00") else s)


def table(ws, first_header):
    """Linhas abaixo do cabecalho que tem `first_header`, como dicts por nome de coluna."""
    rows = list(ws.iter_rows(values_only=True))
    for i, r in enumerate(rows):
        if any(isinstance(c, str) and c.strip() == first_header for c in r):
            hdr = [str(c).strip() if c is not None else "" for c in r]
            out = []
            for r2 in rows[i + 1:]:
                if not any(c not in (None, "") for c in r2):
                    continue
                out.append({h: r2[j] for j, h in enumerate(hdr) if h and j < len(r2)})
            return out
    raise SystemExit(f"cabecalho '{first_header}' nao encontrado em {ws.title}")


# ---------- movimentos (Cuentas, aba 2026) ----------
wb = openpyxl.load_workbook(cuentas, data_only=True)
prev = load_prev("movimentos.json")
mov = []
for r in table(wb["2026"], "Fecha pago"):
    google, insula = num(r.get("Google")), num(r.get("Insula"))
    proj = str(r.get("Proyecto") or "").strip()
    if not proj or (not google and not insula):
        continue
    bruto = num(r.get("Precio BRL"))
    if google:
        lanc = "PO " + ("Cases" if proj == "Case" else proj)
        row = {"tipo": "Crédito", "lancamento": lanc, "valor_bruto": clean(bruto if bruto is not None else google),
               "impostos": clean((bruto - google) if bruto is not None else 0), "valor": clean(google)}
        usd = num(r.get("Precio USD"))
        obs = f"USD {usd:,.0f}".replace(",", ".") if usd else ""
    else:
        row = {"tipo": "Débito", "lancamento": proj, "valor_bruto": None, "impostos": None, "valor": clean(insula)}
        obs = f"Projeto de {brl(bruto)}" if bruto and abs(bruto - insula) > 0.005 else ""
    row.update({"data": iso(r.get("Fecha pago")), "servico": str(r.get("Servicio") or "").strip(),
                "po": ident(r.get("PO")), "job": ident(r.get("Nº Job Insula")), "observacao": obs})
    old = next((p for p in prev if p["tipo"] == row["tipo"] and p["data"] == row["data"]
                and abs((p["valor"] or 0) - (row["valor"] or 0)) < 0.005
                and (p["lancamento"] == row["lancamento"] or (p["po"] and p["po"] == row["po"]) or (p["job"] and p["job"] == row["job"]))), None)
    if old:
        for k in ("lancamento", "servico", "observacao"):
            row[k] = old[k]
    mov.append(row)
mov = [{"id": str(i + 1), **{k: r[k] for k in ("data", "tipo", "lancamento", "servico", "po", "job", "valor_bruto", "impostos", "valor", "observacao")}} for i, r in enumerate(mov)]

# ---------- precos (Cuentas, aba Ticket Google) ----------
ws = wb["Ticket Google"]
pacotes = [("Unitário", 1), ("P", 4), ("M", 7), ("G", 10), ("OOH 1", 13), ("OOH 2", 16)]  # coluna da Qtd (0-based)


def categoria(a):
    a = a.lower()
    if "decupagem" in a:
        return "Filme novo"
    if "formato" in a:
        return "Formato 9:16 e 1:1"
    if "redução" in a or "corte" in a:
        return "Redução ou corte do filme hero"
    if "adpata" in a or "adapta" in a:
        return "Adaptação do filme hero"
    return None


precos, cat = [], None
for r in ws.iter_rows(values_only=True):
    a = str(r[0] or "").strip()
    if any(str(c or "").strip() == "Qtd" for c in r[1:]) and categoria(a):
        cat = categoria(a)
        continue
    m = re.search(r"(\d+)\s*s\.?$", a)
    if not cat or not m:
        continue
    dur = int(m[1])
    unit = num(r[3])
    if not unit:
        continue
    for pac, qc in pacotes:
        if qc + 2 >= len(r):
            continue
        q, v = num(r[qc]), num(r[qc + 2])
        if v is None or isinstance(r[qc + 2], str) and not num(r[qc + 2]):
            continue
        q = 1 if pac == "Unitário" else int(q)
        precos.append({"id": f"{cat} · {dur}s · {pac}", "categoria": cat, "duracao_s": dur, "pacote": pac, "qtd": q,
                       "desconto": round(1 - v / (q * unit), 4), "valor_total": round(v, 2), "valor_por_peca": round(v / q, 2)})

# ---------- a_faturar (A Faturar, aba 2026) ----------
wb2 = openpyxl.load_workbook(afaturar, data_only=True)
af = []
for r in table(wb2["2026"], "ID Proyecto"):
    v = num(r.get("Precio BRL"))
    if not v:
        continue
    af.append({"id_projeto": str(r.get("ID Proyecto") or "").strip(), "cliente": str(r.get("Proyecto") or "").strip(),
               "servico": str(r.get("Servicio") or "").strip(), "po": ident(r.get("PO")), "valor": clean(v)})

# ---------- producao (LATAM, aba Production) ----------
wb3 = openpyxl.load_workbook(latam, data_only=True)
prevp = load_prev("producao.json")
prod = []
rows = list(wb3["Production"].iter_rows(values_only=True))
hi = next(i for i, r in enumerate(rows) if any(str(c or "").strip() == "Project" for c in r))
starts = [j for j, c in enumerate(rows[hi]) if str(c or "").strip() == "Project"]
for r in rows[hi + 1:]:
    for s in starts:
        proj, serv, job, val = (r[s:s + 4] + (None,) * 4)[:4]
        v = num(val)
        if not proj or not v:
            continue
        jt = str(job or "").strip()
        status = "Congelado" if jt.lower().startswith("congel") else "Cancelado" if jt.lower().startswith("cancel") else "Em andamento"
        sv = str(serv or "").strip().replace(" – ", ", ").replace("Adaptations", "adaptações").replace("(TBD)", "(a definir)").replace("Extra deliveries", "Entregas extras")
        row = {"projeto": str(proj).strip(), "servico": sv, "job": ident(job) if status == "Em andamento" else "", "valor": clean(v), "status": status}
        old = next((p for p in prevp if p["projeto"].lower() == row["projeto"].lower() and abs(p["valor"] - row["valor"]) < 0.005 and p["status"] == status), None)
        if old:
            row["projeto"], row["servico"] = old["projeto"], old["servico"]
        prod.append(row)
ordem = {"Em andamento": 0, "Congelado": 1, "Cancelado": 2}
prod.sort(key=lambda r: ordem[r["status"]])


saida = {"movimentos": mov, "a_faturar": af, "producao": prod, "precos": precos}
for nome, linhas in saida.items():
    if not linhas:
        sys.exit(f"{nome} saiu vazio: confira a planilha antes de publicar")
novo = {
    "atualizado_em": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "origem": {"cuentas": args.origem[0], "latam": args.origem[1], "afaturar": args.origem[2]},
    **saida,
}
mudou = any(anterior.get(k) != v for k, v in saida.items())
json.dump(novo, open(DADOS, "w"), ensure_ascii=False, indent=1)
if args.json_separados:
    os.makedirs(args.json_separados, exist_ok=True)
    for nome, linhas in saida.items():
        json.dump(linhas, open(os.path.join(args.json_separados, nome + ".json"), "w"), ensure_ascii=False, indent=0)
for nome, linhas in saida.items():
    print(nome, len(linhas), "linhas", "(mudou)" if anterior.get(nome) != linhas else "")
print("dados mudaram" if mudou else "dados iguais aos publicados")
