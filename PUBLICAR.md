# Publicar gratuitamente na Cloudflare

O projeto inclui uma versão para Workers + D1, mantendo o servidor local original na porta 3000. Não precisa comprar domínio. O endereço público será o retornado pela Cloudflare após a publicação.

## 1. Conta gratuita

Crie uma conta em https://dash.cloudflare.com/sign-up e confirme o e-mail. Use Workers no plano Free; não é necessário adicionar ou comprar domínio.

## 2. Ferramenta de publicação

Abra o terminal na pasta do projeto e execute, um comando de cada vez:

```powershell
npm.cmd install --save-dev wrangler@4
npx.cmd wrangler login
```

O segundo comando abre o navegador. Entre na sua conta e autorize o Wrangler. Não compartilhe senha ou token no chat.

## 3. Banco gratuito

```powershell
npx.cmd wrangler d1 create benicio
```

Copie o `database_id` exibido e substitua somente `SUBSTITUA_PELO_ID_DO_BANCO` no arquivo `wrangler.jsonc`. Se a ferramenta já atualizou esse campo, mantenha o ID retornado. Não crie outro banco se já existir um chamado `benicio`: use `npx.cmd wrangler d1 list` para localizar o ID.

Depois crie as tabelas:

```powershell
npx.cmd wrangler d1 migrations apply benicio --remote
```

Confirme a aplicação das migrations quando solicitado. O banco começa vazio: os registros locais não são enviados automaticamente. Se já cadastrou informações ou convidados que deseja manter, faça a transferência antes de divulgar o endereço.

## 4. Senha e publicação

```powershell
npx.cmd wrangler secret put ADMIN_PASSWORD
```

Digite uma senha forte quando solicitado (não aparece na tela). Se a ferramenta pedir para criar o Worker `cha-do-benicio` que ainda não existe, confirme a criação. Em seguida:

```powershell
npx.cmd wrangler deploy
```

Se a Cloudflare pedir para definir um subdomínio `workers.dev`, escolha um nome disponível. O terminal mostrará o endereço HTTPS do convite. Use esse endereço acrescido de `/admin` para entrar no painel com a senha criada.

## 5. Antes de enviar

No painel público, cadastre data, horário, local e os mimos. Fotos e links de compra devem usar HTTPS. Faça uma confirmação em janela anônima, reserve um mimo e verifique no painel. Envie aos convidados somente o endereço principal, sem `/admin` e sem o parâmetro `familia` de uma confirmação existente.

Após alterar o código, publique novamente com `npx.cmd wrangler deploy`: o endereço permanece o mesmo e o D1 mantém os dados. Não execute testes de integração contra o banco real. Para desenvolvimento cotidiano, continue usando `npm.cmd run dev` na porta 3000.

O plano gratuito está sujeito às cotas da Cloudflare. Veja https://developers.cloudflare.com/workers/platform/limits/ e https://developers.cloudflare.com/d1/platform/pricing/ .
