#!/usr/bin/env python3
"""Copia o visual e o código da página de backlog do dashboard para o site da equipe.

O "Ver como o Google" de backlog-freela/index.html usa exatamente o mesmo CSS e as mesmas
funções que desenham a página de backlog em index.html (bkData, renderBacklog, klikeSection...).
Sempre que a página de backlog do dashboard mudar, rodar:

    python3 scripts/copiar_render.py

e fazer commit dos dois arquivos juntos.
"""
import os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DASH = os.path.join(RAIZ, "index.html")
FREELA = os.path.join(RAIZ, "backlog-freela", "index.html")

d = open(DASH, encoding="utf-8").read()
css = d[d.index("<style>") + len("<style>"):d.index("</style>")].strip("\n")
ini = d.index("  // ---------- backlog de modelos")
fim = d.index("  // Comparativo geral no dashboard")
js = d[ini:fim].rstrip() + "\n"

f = open(FREELA, encoding="utf-8").read()
def troca(texto, abre, fecha, novo):
    a = texto.index(abre) + len(abre)
    b = texto.index(fecha, a)
    return texto[:a] + "\n" + novo + "\n" + texto[b:]
f = troca(f, "/* >>> CSS copiado do dashboard por scripts/copiar_render.py: não editar aqui */", "/* <<< fim da cópia */", css)
f = troca(f, "  /* >>> JS copiado do dashboard por scripts/copiar_render.py: não editar aqui */", "  /* <<< fim da cópia */", js + "  ")
open(FREELA, "w", encoding="utf-8").write(f)
print("copiado:", len(css), "caracteres de CSS e", len(js), "de JS")
