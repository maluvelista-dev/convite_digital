# Publicação gratuita: Vercel + Supabase

A integração Supabase/GitHub não cria as tabelas nem configura o acesso da API automaticamente. Siga as etapas abaixo. Não é necessário instalar Wrangler nem executar as migrations Cloudflare.

## 1. Criar o banco

Entre em https://supabase.com/dashboard, abra o projeto destinado ao convite ou crie um no plano Free. No menu **SQL Editor**, crie uma consulta (**New query**), cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**. O arquivo cria um schema próprio `benicio`, sem alterar tabelas de outros aplicativos. As tabelas não ficam abertas ao navegador; somente a API no servidor pode acessá-las.

O comando cria um banco vazio. Os convidados e mimos do SQLite local não são transferidos automaticamente. Antes de divulgar o endereço, transfira os cadastros que quiser manter ou cadastre os mimos e a festa pelo painel publicado.

## 2. Colocar o projeto no GitHub

Se ainda não houver repositório, crie um repositório **privado** no GitHub e use o GitHub Desktop para adicionar/publicar esta pasta. Inclua `api`, `apps`, `scripts`, `supabase`, `tests`, `package.json`, `vercel.json` e demais arquivos de código. A arte `apps/web/public/convite.jpeg` também deve ir.

Não envie `.env`, `.dev.vars`, `data`, `node_modules`, `.vercel`, `.wrangler` ou chaves. O `.gitignore` já protege esses caminhos ao usar Git. Upload manual pelo navegador não respeita `.gitignore`: nesse caso selecione somente os arquivos de código.

## 3. Importar na Vercel

No painel da Vercel, use **Add New → Project** e importe o repositório. Configure:

- **Framework Preset:** Other.
- **Root Directory:** raiz do repositório (não selecione `apps/web`).
- **Node.js:** 24.x.
- Build e diretório de saída: definidos por `vercel.json` (`node scripts/build-vercel.mjs` e `dist`).

## 4. Variáveis de ambiente

Antes de publicar, adicione estas variáveis em **Environment Variables**, no ambiente **Production**:

| Nome | Valor |
| --- | --- |
| `SUPABASE_URL` | URL do projeto, por exemplo `https://identificador.supabase.co`, disponível na conexão/configuração de API do Supabase. |
| `SUPABASE_SECRET_KEY` | Secret key do projeto Supabase (`sb_secret_...`), disponível em Settings → API Keys. Também aceita a chave legada `service_role`. Não use a publishable/anon key. |
| `ADMIN_PASSWORD` | Uma senha forte escolhida por você para o painel do convite. Não é a senha da sua conta Supabase. |

Não use prefixo `NEXT_PUBLIC_` ou `VITE_` para essas variáveis. Não cole chaves no código, GitHub, fotos ou chat. Mantenha a Data API do Supabase habilitada e o schema público disponível para a função `benicio_api`.

Clique em **Deploy**. Se adicionou variáveis depois da primeira publicação, faça **Redeploy** para aplicá-las. Se quiser testar deployments de Preview, configure as variáveis também nesse ambiente, preferencialmente com outro projeto Supabase para separar os testes dos convidados reais.

## 5. Conferir e compartilhar

Para atualizar um banco que permitia somente um mimo por família, execute `supabase/multiplos-mimos.sql` no SQL Editor e publique os arquivos atualizados `apps/api/supabase.mjs` e `apps/web/public/app.js`. A migração mantém as reservas existentes e permite reservar vários itens distintos, com cancelamento individual. Não é necessário apagar convidados ou recadastrar os mimos.

Abra o endereço `https://nome-do-projeto.vercel.app` retornado pela Vercel. Acesse `/admin` e entre com `ADMIN_PASSWORD`. Cadastre local, data, horário e mimos. Abra o convite em janela anônima, confirme uma família e teste a reserva. Verifique se ela aparece no painel. A página `/?novo=1` permite voltar ao cadastro.

Em Settings → Deployment Protection, confira se a publicação Production está acessível aos convidados sem conta Vercel. Teste em uma janela anônima ou em outro celular antes de enviar. Compartilhe somente o endereço principal, sem `/admin` nem `?familia=...`.

O computador pode ficar desligado após a publicação. Novos commits na branch de produção serão publicados no mesmo projeto/endereço. Os dados permanecem no Supabase. A versão local continua em `http://localhost:3000`, usando o SQLite original: os dois bancos são separados.

## Limites e problemas comuns

- O Supabase gratuito pode pausar após uma semana de pouca atividade. Verifique o projeto no painel e restaure se necessário antes de enviar os convites.
- Mensagem de configuração: confira as três variáveis na Vercel e faça Redeploy.
- Erro de acesso ao banco: verifique se executou todo `supabase/schema.sql`, se o projeto está ativo, se a Data API está habilitada e se usou a chave secreta correta.
- A Vercel Hobby é voltada a uso pessoal sem fins comerciais. Os planos gratuitos têm cotas de uso.
- A função de banco `public.benicio_api` não pode ser executada por usuários anônimos: isso é esperado. A Vercel usa a chave secreta no servidor.

Referências: https://vercel.com/docs/functions/runtimes/node-js, https://supabase.com/docs/guides/getting-started/api-keys e https://supabase.com/docs/guides/platform/free-project-pausing.
