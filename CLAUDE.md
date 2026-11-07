# google-account — Conta corrente Google 2026

Página única (`index.html`) com a conta corrente da Insula AI com o Google: crédito recebido,
consumo por projeto, saldo, POs aprovados e a faturar, projetos em produção (com contingência)
e a tabela de preços Ticket Google. Público: o contato do Google (Ted) e o time da Insula.

**Hospedagem:** Cloudflare Pages, publicado a cada push no `main`, atrás de login.
Um usuário e uma senha únicos, verificados por `functions/_middleware.js` antes de qualquer
arquivo sair. Usuário: `google`. A senha não está no repositório, só o hash dela.
`robots.txt` bloqueia indexação e o middleware manda `X-Robots-Tag: noindex`.

Existe também uma cópia como dashboard no claude.ai
(https://claude.ai/artifact/LuojjzVkPcUGUqbJ7PdqPU), com os mesmos dados.

## Estrutura

```
index.html                página inteira: HTML, CSS e JS inline, sem build
dados.json                os números que a página mostra (gerado, não editar à mão)
vendor/d3.min.js          d3 v7.9.0, servido daqui para não depender de CDN
functions/_middleware.js  login: tela, sessão e lista do que pode ser servido
scripts/atualizar.py      gera dados.json a partir das planilhas (nunca servido)
robots.txt
```

## De onde vêm os dados

Três planilhas no drive compartilhado da Insula (pasta da conta Google):

| Planilha | fileId | Abas usadas | Vira |
|---|---|---|---|
| Cuentas Proyectos Google 2026.xlsx | 1lszMOS89dOwsN9eV1W1QGMPilqe0zRVW | 2026, Ticket Google | `movimentos`, `precos` |
| LATAM_ Projectos Google 2026.xlsx | 1UmUZaGe89dCViedMOen6f_hlwHRekyyH | Production | `producao` |
| Á Faturar Proyectos Google 2026.xlsx | 1Q0YKCn-Jf_9AMR9d8NEQqx0whOOhq1oZ | 2026 | `a_faturar` |

- Crédito é linha da aba 2026 com valor na coluna Google; débito, com valor na coluna Insula.
  Impostos = Precio BRL menos Google.
- Contingência = projetos da aba Production com status Congelado ou Cancelado.
- A aba oculta "100% IA" (tabela de preços antiga) fica de fora.
- `dados.json.origem` guarda o modifiedTime do Drive de cada planilha na última atualização.

## Atualização automática

Uma tarefa agendada no claude.ai ("Atualizar dashboard Conta Corrente Google") roda nos dias
úteis às 9h17, 15h17 e 18h17 (Brasília). Compara o modifiedTime das planilhas com
`dados.json.origem`; se mudou, baixa as planilhas, roda `scripts/atualizar.py`, faz commit de
`dados.json` no `main` e atualiza o dashboard do claude.ai. Precisa do conector Google Drive e
deste repositório configurados na tarefa.

Manualmente:

```
python3 -I scripts/atualizar.py cuentas.xlsx latam.xlsx afaturar.xlsx \
  --origem <mt cuentas> <mt latam> <mt afaturar> --json-separados /tmp/dash
```

## Decisões

- **Sem seção de conciliação.** As planilhas divergem em R$ 135 no saldo (desconto manual na
  fórmula da aba Invoiced da LATAM). A seção que mostrava isso foi retirada a pedido da Insula
  em 03/11, porque a página vai para o Google. Não reintroduzir.
- **Sem a coluna CNPJ TRIO.**
- **Cores do Insula Synthetic Director:** fundo #0A1020, painéis #111931, texto #E9E5DC,
  âmbar #D9A566 só no que é saldo ou destaque. Títulos em Mulish 600, corpo em Archivo,
  rótulos em JetBrains Mono, como no InfoMemo.
- Tema escuro único, por escolha.

## Login

**A tela de login é da Insula, não do Google.** Título "Insula AI", sem "Google" no `<title>`,
e um aviso de que não é página do Google. Uma tela "Conta Google" pedindo senha num endereço
com "google" no nome é indistinguível de phishing (o Claude no navegador recusou ajudar por
isso, em 07/11). Pelo mesmo motivo, o projeto no Cloudflare Pages não leva "google" no nome:
`insula-conta-corrente`, e não `google-account`.


Sessão de 12 horas, em cookie HttpOnly e Secure assinado com HMAC. A assinatura inclui o hash
da senha, então **trocar a senha derruba todas as sessões abertas**. Para trocar: gerar sal e
hash novos e substituir `SALT` e `PASS_HASH` no middleware.

```
python3 -c "import secrets,hashlib;s=secrets.token_hex(16);p='NOVA-SENHA';print(s);print(hashlib.sha256(f'{s}:{p}'.encode()).hexdigest())"
```

Arquivo novo que precise ir ao ar tem que entrar em `servable()`.

Teste local com o wrangler, rodando da raiz do repositório:

```
npx wrangler pages dev . --port 8788 --compatibility-date=2024-09-23
```

Sem cookie, `/` e `/dados.json` devolvem 401 com a tela de login; com sessão, `/CLAUDE.md` e
`/scripts/atualizar.py` devolvem 404.
