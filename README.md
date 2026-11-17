# Chá de bebê do Benício

Para Vercel + Supabase, siga [PUBLICAR-VERCEL.md](PUBLICAR-VERCEL.md). Essa opção usa `api/index.mjs`, `apps/api/supabase.mjs` e `supabase/schema.sql`, preservando o front e o servidor local.

Para hospedar gratuitamente em Cloudflare Workers + D1, siga [PUBLICAR.md](PUBLICAR.md). A versão Cloudflare usa `apps/api/worker.mjs`, `wrangler.jsonc` e as migrations SQL, sem alterar o comando de execução local.

Monorepo com front em HTML/CSS/JavaScript (`apps/web`) e API Node.js com SQLite (`apps/api`). Requer Node.js 24 ou superior. A execução local não precisa de dependências; para rodar os testes PostgreSQL, instale as dependências de desenvolvimento com `npm.cmd ci`.

## Executar

1. Copie `.env.example` para `.env` e defina uma senha administrativa forte.
2. Execute `npm.cmd start` no Windows (ou `npm start` em outros sistemas).
3. Abra http://localhost:3000. Painel: http://localhost:3000/admin.

Sem `.env`, o terminal exibe uma senha temporária, válida até reiniciar o servidor. Para desenvolvimento com reinício automático: `npm.cmd run dev`. Testes: `npm.cmd test`.

## Como usar

Use sempre a porta 3000 para acessar as atualizações. Após confirmar, o botão **Voltar ao cadastro** abre `http://localhost:3000/?novo=1` para cadastrar outra família, preservando a confirmação anterior e o seu link. A página principal lembra a última confirmação neste navegador.

No painel, cadastre data, horário, endereço e mimos (foto por URL, nome, link de compra e quantidade máxima). Envie o link principal aos convidados. Cada confirmação representa uma família e recebe um link privado de consulta, uma sugestão fixa de fralda e a opção de reservar um mimo. Uma família pode reservar um mimo por vez; trocar libera a reserva anterior. O painel mostra o nome de quem escolheu cada mimo e os acompanhantes. Mimos com reserva não podem ser excluídos.

A arte anexada está em `apps/web/public/convite.jpeg`. Não há convidados, endereço ou produtos fictícios no banco inicial. Os detalhes da festa aparecem após a confirmação.

Os pesos informados (8/12/35/35/12) somam 102. O sistema normaliza por 102 e escolhe a cada confirmação o tamanho com maior déficit em relação à proporção desejada. A unidade é uma família, independentemente do número de acompanhantes. O tamanho já atribuído permanece fixo. Em grupos pequenos, as proporções são aproximadas.

## Persistência e publicação

O banco fica em `data/benicio.sqlite`. Faça backup da pasta `data` com o servidor parado. Não coloque essa pasta nem `.env` no controle de versão. A reserva usa transação SQLite para evitar ultrapassar o limite. Links de família são credenciais privadas: quem tiver o link pode consultar e trocar a reserva. O navegador lembra a confirmação para evitar reenvio acidental; pessoas usando outro dispositivo devem reutilizar seu link de família. O sistema não tenta identificar pessoas apenas pelo nome.

Este projeto está preparado para execução local. Para enviar um link acessível pela internet, hospede o processo Node com disco persistente, HTTPS e proxy reverso para `127.0.0.1:3000`; configure `ADMIN_PASSWORD` e `PORT`. O endereço localhost funciona somente neste computador. Em hospedagem com proxy, encaminhe `X-Forwarded-Proto: https` para cookies seguros. O painel usa cookie HttpOnly com validade de oito horas; sessões são invalidadas ao reiniciar. Fotos externas precisam estar acessíveis sem login. Antes do evento, configure todos os detalhes e teste o fluxo em um navegador separado.
