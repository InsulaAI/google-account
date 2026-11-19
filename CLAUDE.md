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
backlogs.json             backlog de modelos de IA por projeto; abre em #backlog-<id>
backlog-envios/<id>.json  formulário do último envio da equipe para cada job (nunca servido)
backlog-freela/           site da equipe para preencher o backlog (outro projeto no Cloudflare)
scripts/copiar_render.py  copia o visual da página de backlog para backlog-freela/
robots.txt
```

## De onde vêm os dados

Planilhas no drive compartilhado da Insula (as três primeiras na pasta da conta Google):

| Planilha | fileId | Abas usadas | Vira |
|---|---|---|---|
| Cuentas Proyectos Google 2026.xlsx | 1lszMOS89dOwsN9eV1W1QGMPilqe0zRVW | 2026 | `movimentos` |
| LATAM_ Projectos Google 2026.xlsx | 1UmUZaGe89dCViedMOen6f_hlwHRekyyH | Production | `producao` |
| Á Faturar Proyectos Google 2026.xlsx | 1Q0YKCn-Jf_9AMR9d8NEQqx0whOOhq1oZ | 2026 | `a_faturar` |
| Insula_IA_2027 Sintetico.xlsx | 1t0qvcGBPagsIq_BeDIVKhF_JqTJC0ziS | Ticket Google | `precos` (Filme sintético) |
| Insula_IA_2027_Elenco.xlsx | 1HkAAUr7qNf-NBF7GDaYfGZsOPiHCfmQh | Ticket Google | `precos` (Filme IA + Elenco) |

- Crédito é linha da aba 2026 com valor na coluna Google (o que entrou na conta); débito, com
  valor na coluna Insula. `valor_po` é o valor do próprio PO, usado só no gráfico de POs.
- **Preços vêm das duas tabelas Ticket Google 2027** (19/11), na pasta "Tabela de preços" do Drive
  (1xYrNIRjUdZFbKgupLGvnPxXiVfGc6feT): `Insula_IA_2027 Sintetico.xlsx` e `Insula_IA_2027_Elenco.xlsx`,
  aba Ticket Google de cada uma. A equipe sobe arquivo novo em vez de editar, então o fileId muda
  (19/11: 1t0qvcGBPagsIq_BeDIVKhF_JqTJC0ziS e 1HkAAUr7qNf-NBF7GDaYfGZsOPiHCfmQh); a rotina procura
  pelo nome dentro da pasta, fora da lixeira. Ajuste de 19/11: pacote P com 5% em tudo.
  Viram as abas "Filme sintético" e "Filme IA + Elenco" da tabela de preços (campo `tipo` em
  `precos`); só aparecem as categorias que a tabela tem (hoje Filme novo e Adaptação do filme hero).
  `atualizar.py --tabelas <sint> <elenco> --origem-tabelas
  <mt> <mt>`; sem `--tabelas`, os preços atuais são mantidos. A aba Ticket Google da LATAM (30" a
  R$ 117.420) deixou de ser usada.
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
- **Assistir no Drive:** a listagem guarda o `id` de cada arquivo; a página mostra um botão por take
  entregue (tabela cena a cena) e por tentativa descartada (numerada, na seção da cena com falha),
  ao lado dos takes que resolveram a cena. Abrem no Drive; quem assiste precisa de acesso à pasta.
  Vídeo do Drive não toca embutido em outro site (cookie de terceiros), por isso é link e não player.
- **Pontuação Klike:** `backlogs[].klike` = {pasta_url, fonte, relatorios: [{filme, titulo, versao,
  data, nota, dimensoes (10 letras, na ordem de `klike_dimensoes`), arquivo_id}]}. O botão
  "Pontuação Klike" no topo do backlog leva à seção 07, com um card por relatório (nota final e
  "Acessar relatório", que abre o PDF no Drive) e a tabela das 10 dimensões por versão. Só a
  Nespresso tem relatórios (5, pasta 1s224y5ylxKCXqBTskxwJckTy7Sm17Q2D); Samsung e ClearBlue têm
  a seção vazia, a preencher; os outros projetos não têm Klike.
- **Gerar PDF:** botão em cada página de backlog que chama a impressão do navegador com um estilo
  só para papel (fundo branco, A4, 3 páginas: capa+timeline+resumo / comparativo+cena a cena /
  cena com falha+régua). Sai só o backlog, sem nenhum valor em reais, para o Google mandar à
  engenharia. Não existe no dashboard do claude.ai, que bloqueia impressão e download.

## Site da equipe: preenchimento do backlog (`backlog-freela/`)

Freelancers e equipe preenchem o backlog de cada job num site à parte, sem nenhum valor em
reais, com os mesmos campos da página de backlog do Google. "Enviar backlog" grava direto
neste repositório e o dashboard atualiza sozinho (decisão de 19/11: formulário do Google
foi descartado por não lidar bem com cenas que se repetem nem mostrar o resultado).

- **Hospedagem:** segundo projeto no Cloudflare Pages, `insula-backlog`, ligado a este mesmo
  repositório com *Root directory* = `backlog-freela` (build vazio, saída `/`). Tem login
  próprio, diferente do dashboard: usuário `equipe`; a senha não está no repositório, só o hash
  em `backlog-freela/functions/_middleware.js` (troca igual à do dashboard, cookie `bf_s`).
  Serve só `index.html`, o logo e `robots.txt`, mais as rotas `/api/*`.
- **Gravação:** `functions/api/enviar.js` faz um commit no `main` pela API do GitHub com
  `backlogs.json` (o backlog do job trocado ou acrescentado, com `enviado_por` e `enviado_em`),
  `img/backlog-<id>-timeline.webp|png|jpg` e `backlog-envios/<id>.json` (o formulário, para
  continuar depois). Se outro commit entrar no meio, refaz em cima do main novo. Precisa da
  variável secreta **`GITHUB_TOKEN`** no projeto `insula-backlog` (token fine-grained só deste
  repositório, permissão *Contents: Read and write*). Sem ela o site abre, mas não envia.
- **Proteções:** `lib/backlog.js` refaz todo o envio campo a campo (só as chaves da página do
  Google, tamanho máximo, links só do Google Drive, IDs do Drive validados, imagem conferida
  pelos bytes). Backlogs com `bloqueado`, `sem_backlog` ou `link_direto` não aparecem e não
  podem ser gravados (Mercado Pago oficial, SuperBet, Brilhante, Clear Men). O bloco `drive`
  e os relatórios Klike já gravados são mantidos.
- **No dashboard:** backlog enviado pela equipe aparece como "Preenchido pela equipe em
  dd/mm"; `oficial` continua sendo só o que a Insula validou. Resumo e comparativo
  Google × outros são calculados das cenas e dos planos preenchidos quando não há bloco
  `drive`. Job novo, que não está em `manual.json`, entra no fim da tabela como "Novo job".
- **Desfazer um envio:** `git revert` do commit "Backlog <job>: enviado por …".
- **Mesmo visual:** o "Ver como o Google" do site usa uma cópia do CSS e das funções de
  `index.html` (`bkData`, `renderBacklog`…). Mudou a página de backlog do dashboard, rodar
  `python3 scripts/copiar_render.py` e commitar os dois arquivos juntos.
- Status e descartes de cada cena saem dos planos tentados (seção 05), não são digitados.
  Modelos vêm de lista fechada com "Outro…", para não repetir "Omini". O rascunho fica no
  navegador de quem preenche (localStorage) até o envio.
- Teste local, de dentro de `backlog-freela/`, com um GitHub falso respondendo em outra porta:
  `npx wrangler pages dev . --port 8788 --compatibility-date=2024-09-23 --binding GITHUB_TOKEN=x --binding GITHUB_API=http://127.0.0.1:8799`

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
