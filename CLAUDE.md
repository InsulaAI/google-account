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
manual.json               valores informados pela equipe que ainda não estão nas planilhas (editar à mão)
vendor/d3.min.js          d3 v7.9.0, servido daqui para não depender de CDN
img/insula-logo.webp      logo da Insula (versão "SEM BG" da pasta INSULA AI no Drive), 234×240
functions/_middleware.js  login: tela, sessão e lista do que pode ser servido
scripts/atualizar.py      gera dados.json a partir das planilhas (nunca servido)
backlogs.json             backlog de modelos de IA por projeto (editar à mão); abre em #backlog-<id>
robots.txt
```

## De onde vêm os dados

Três planilhas no drive compartilhado da Insula (pasta da conta Google):

| Planilha | fileId | Abas usadas | Vira |
|---|---|---|---|
| Cuentas Proyectos Google 2026.xlsx | 1lszMOS89dOwsN9eV1W1QGMPilqe0zRVW | 2026 | `movimentos` |
| LATAM_ Projectos Google 2026.xlsx | 1UmUZaGe89dCViedMOen6f_hlwHRekyyH | Production, Ticket Google | `producao`, `precos` |
| Á Faturar Proyectos Google 2026.xlsx | 1Q0YKCn-Jf_9AMR9d8NEQqx0whOOhq1oZ | 2026 | `a_faturar` |

- Crédito é linha da aba 2026 com valor na coluna Google (o que entrou na conta); débito, com
  valor na coluna Insula. `valor_po` é o valor do próprio PO, usado só no gráfico de POs.
- **Preços vêm da aba Ticket Google da LATAM**, atualizada em 03/11 (30" a R$ 117.420, sem
  pacotes OOH). A cópia da aba na Cuentas ficou com a tabela antiga (30" a R$ 97.850) e não é usada.
- **Contingência = verba que sai do saldo do Google para um projeto** (definição da equipe em
  12/11). Ex.: os R$ 160.445 da SuperBet. Não confundir com projeto congelado: a aba Production
  da LATAM mostra em andamento, congelado e cancelado; congelado não entra em conta nenhuma e
  cancelado aparece à parte.

## manual.json

Valores que a equipe informa antes de existirem PO ou NF na planilha (12/11: contingências de
Mercado Pago e Nespresso, faturamento previsto de SuperBet e Mercado Pago, contrato da ClearBlue;
18/11: Samsung, novo funding de R$ 374.073 do Programa de Preparação para Mídia, contrato n489359).

- `debitos`: entram no extrato como débito do saldo Google, marcados "informado, sem NF". Um débito
  daqui é ignorado assim que a aba 2026 da Cuentas tiver um débito com o mesmo valor, para não contar
  duas vezes.
- `observacoes`: troca a observação de um débito da planilha, pelo nome do lançamento.
- `nomes`: troca o nome de um lançamento da planilha (ex.: "Clear" → "Clear Men").
- `producao_status`: troca a situação de um projeto da aba Production (ex.: Madeira Madeira →
  Cancelado, 18/11).
- `pos_status`: situação de um PO da Á Faturar (PO → {status, nota}), ex.: Unilever "Aguardando
  Google" (18/11). Continua somado no total a faturar.
- `pos_cancelados`: POs da Á Faturar que foram cancelados (PO → motivo). Continuam na tabela,
  riscados, e saem do total a faturar e do gráfico de POs.
- `projetos`: a seção "Projetos: faturamento e contingência". `faturamento_status`: `previsto`
  (NF ainda vai sair), `a_receber` (faturado, aguardando pagamento) ou `pago`. Situação
  "Encerrado" vai para o fim da lista, esmaecida. Aprovado = faturamento + contingência
  + aporte; saldo = aprovado − executado. O script calcula os dois.
- `projetos[].backlog_url`: endereço (https) da página de backlog de modelos de IA do projeto,
  aberto pelo botão da tabela "Backlog Modelos". Vazio = botão desativado com "link em breve".
- A rotina nunca edita este arquivo; ele muda quando a equipe manda valores novos.
- A aba oculta "100% IA" (tabela de preços antiga) fica de fora.
- `dados.json.origem` guarda o modifiedTime do Drive de cada planilha na última atualização.

## Backlog de modelos

Exigência do Google: que modelo de imagem e vídeo foi usado em cada cena, quantas tentativas e
onde o modelo principal falhou. A tabela "Backlog Modelos" (abaixo de "Detalhe por projeto") tem
um botão por projeto que abre `#backlog-<id>`, uma página dentro do próprio `index.html` com as
mesmas seções do PDF oficial: timeline, resumo, cena a cena, cena com falha e régua F1–F9.

- Os dados ficam em `backlogs.json`. Situação em 18/11:
  - **Mercado Pago**: oficial (PDF de nov/2026), pasta 1J6J4_Y2K3sQSXodtvSSkPsio7dKPYBCp.
  - **SuperBet**: interrompido (R$ 239.816,70 executados), sem backlog completo. O botão abre
    direto a pasta de backup 1-16NwhtfLepCRZ-yFlR6TjlobFOEP12_ (`link_direto`).
  - **Brilhante e Clear Men**: 100% Google, sem backlog (`sem_backlog`, `so_google`).
  - **ClearBlue, Nespresso e Samsung**: página com o modelo vazio, "[a preencher]" em cinza e itálico.
- **Leitura das pastas:** `scripts/backlog.py <id> <listagem.json>` grava o bloco `drive` do
  projeto a partir da listagem da pasta (exemplo em `backlog/listagem-mercado-pago.json`).
  Convenção: `CENA <n>/<modelo>/` = takes entregues; `CENA <n>/<modelo> Tentativas/` = descartes,
  com o plano no nome do arquivo antes de `_<código>`. Nomes de modelo com erro de digitação
  ("Omini", "Omnin") são juntados pela família mais parecida. Google = Omni, Veo, Imagen, Nano
  Banana, Gemini, Flow.
- Com o bloco `drive`, a página monta timeline, cena a cena, descartes, status e o comparativo
  "Google × outros" sozinha; os textos à mão (título, modelo de imagem, categoria de falha,
  prompt) continuam valendo. O card "Modelo do Google × outros modelos" no dashboard soma todos
  os projetos.
- `pasta_url`: o botão "Saiba mais" abre a pasta do backlog no Drive. Quem abre precisa ter
  acesso à pasta no Drive; a senha do site não dá esse acesso.
- Os números do resumo (7/8, 1, 10) são calculados das cenas e dos planos, não digitados.

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
- **Sem impostos.** Retirados a pedido da equipe em 12/11: o crédito aparece pelo valor que
  entrou; nem valor bruto nem imposto vão para a página ou para `dados.json`.
- **Cores do Insula Synthetic Director:** fundo #0A1020, painéis #111931, texto #E9E5DC,
  âmbar #D9A566 só no que é saldo ou destaque. Títulos em Mulish 600, corpo em Archivo,
  rótulos em JetBrains Mono, como no InfoMemo.
- Tema escuro único, por escolha.
- **Logo da Insula** no topo da página e na tela de login (lá embutido no middleware em
  base64, porque a tela de login sai antes da sessão e não pode carregar arquivo).

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
