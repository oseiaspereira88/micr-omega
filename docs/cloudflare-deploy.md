# Guia de Deploy e Configuração no Cloudflare

Este guia descreve como colocar em produção um serviço web utilizando o Cloudflare, partindo de uma conta vazia (sem domínios ou projetos configurados). Ele cobre desde a preparação da conta até o monitoramento após o deploy.

## 1. Pré-requisitos

1. Conta ativa no [Cloudflare](https://dash.cloudflare.com/).
2. Acesso ao DNS do domínio que será utilizado (geralmente no registrador).
3. Aplicação pronta para publicação (estática ou backend) e acesso às credenciais necessárias (chaves de API, tokens, etc.).
4. Git instalado na máquina local para integrar com flows automatizados quando aplicável.

## 2. Acessando o painel e definindo a organização

1. Faça login em `dash.cloudflare.com` com sua conta.
2. No canto superior direito, selecione a **Account** que receberá os recursos. Se for a primeira vez, apenas uma conta pessoal estará disponível.
3. Opcionalmente, configure **Members** e **Roles** em *Account Home → Manage Account → Members* para permitir que outros usuários colaborem.

## 3. Adicionando um domínio ao Cloudflare

### 3.1 Registrar o domínio no Cloudflare

1. No dashboard, clique em **Add a site**.
2. Informe o domínio que será hospedado, sem protocolo (ex.: `exemplo.com`).
3. Escolha o plano desejado (Free, Pro, Business ou Enterprise). Para começar, o plano **Free** é suficiente.
4. Revise o resumo e clique em **Continue**.

### 3.2 Atualizar os registros DNS

1. Cloudflare tentará importar entradas DNS existentes. Revise-as e adicione ou edite conforme necessário:
   - **A** ou **AAAA** para apontar para IPs de servidor.
   - **CNAME** para apontar para outros hosts.
   - **MX**, **TXT** ou outros registros de e-mail/verificação.
2. Clique em **Continue** após revisar.

### 3.3 Delegar o DNS para Cloudflare

1. Cloudflare exibirá dois nameservers (ex.: `adam.ns.cloudflare.com` e `bella.ns.cloudflare.com`).
2. No painel do registrador do domínio (onde o domínio foi comprado), substitua os nameservers atuais pelos fornecidos pelo Cloudflare.
3. A propagação pode levar de minutos até 24 horas. Você pode acompanhar o status em *Overview → Pending Nameserver Update*.
4. Após a verificação, o domínio passará a ser gerenciado pelo Cloudflare e o status mostrará *Active*.

## 4. Configurando DNS e segurança

### 4.1 Revisão dos registros DNS

1. Em *DNS → Records*, crie ou atualize os registros necessários para sua aplicação.
2. Utilize o ícone de nuvem laranja para ativar o proxy do Cloudflare (recomendado para HTTP/HTTPS). A nuvem cinza (DNS Only) é adequada para serviços não-HTTP ou quando o proxy não é desejado.

### 4.2 Certificado SSL/TLS

1. Vá em *SSL/TLS → Overview*.
2. Escolha o modo **Full** ou **Full (Strict)** para conexões HTTPS de ponta a ponta (exige certificado válido no servidor de origem). Caso não haja certificado no servidor, use **Flexible** temporariamente, mas planeje migrar para **Full**.
3. Ative **Always Use HTTPS** em *SSL/TLS → Edge Certificates* para redirecionar tráfego HTTP para HTTPS.
4. Habilite **Automatic HTTPS Rewrites** para corrigir links HTTP internos.

### 4.3 Firewall e segurança adicional

1. Em *Security → WAF*, ative **Web Application Firewall** (em planos pagos) ou use regras personalizadas em *Security → WAF → Firewall Rules*.
2. Configure o **Rate Limiting** se precisar controlar requisições por IP.
3. Ajuste **Bot Management** (quando disponível) para mitigar tráfego automatizado malicioso.

## 5. Publicando a aplicação

Existem múltiplas abordagens para deploy. Abaixo estão as mais comuns com uma conta Cloudflare apenas.

### 5.1 Aplicações estáticas com Cloudflare Pages

1. Acesse *Workers & Pages → Create application*.
2. Selecione **Pages** e clique em **Connect to Git**.
3. Autorize o Cloudflare a acessar seu repositório Git (GitHub, GitLab ou Bitbucket).
4. Escolha o repositório contendo os arquivos estáticos.
5. Configure a branch de produção (ex.: `main`), a ferramenta de build (ex.: `npm run build`) e o diretório de saída (ex.: `dist`).
6. Clique em **Save and Deploy**. Cloudflare construirá e publicará a aplicação.
7. Para domínios próprios, vá em *Pages → Settings → Custom domains* e adicione o domínio ou subdomínio. Cloudflare criará automaticamente os registros DNS necessários.

### 5.2 APIs ou backends com Cloudflare Workers

1. Em *Workers & Pages*, clique em **Create application → Workers**.
2. Escolha criar um worker vazio ou com template (HTTP handler, fetch, etc.).
3. Utilize o editor online para criar o código ou faça upload via Wrangler CLI:
   ```bash
   npm install -g wrangler
   wrangler login
   wrangler init meu-worker
   wrangler deploy
   ```
4. Em *Triggers → Routes*, configure URLs (ex.: `api.exemplo.com/*`) para direcionar tráfego ao Worker.
5. Se necessário, utilize **KV Storage**, **Durable Objects** ou **Queues** em *Workers → Storage* para persistência e processamento assíncrono.

### 5.3 Integração com servidores existentes

1. Aponte registros **A** ou **CNAME** para o IP/host do seu servidor na aba *DNS*.
2. Certifique-se de que o servidor aceite conexões HTTPS (modo Full/Strict) e que os headers `CF-Connecting-IP` e `X-Forwarded-For` sejam reconhecidos se precisar do IP real do visitante.
3. Utilize **Page Rules** (em *Rules → Page Rules*) para redirecionamentos, cache customizado ou sempre online.

## 6. Performance e caching

1. Ative o **Cache** padrão para conteúdo estático. Em *Caching → Configuration*, defina o `Browser Cache TTL` e o `Edge Cache TTL` conforme sua necessidade.
2. Use **Cache Rules** (em *Rules → Cache Rules*) para cachear rotas específicas (ex.: `/assets/*`).
3. Considere habilitar **Polish** e **Auto Minify** em *Speed → Optimization* para otimização de imagens e minificação de CSS/JS/HTML.
4. Para páginas dinâmicas, utilize **Bypass Cache on Cookie** ou **Cache Everything** com precaução.

## 7. Observabilidade e logs

1. Use **Analytics → Web Traffic** para métricas de tráfego, ameaças mitigadas e performance.
2. Configure **Logs** (planos Enterprise) para enviar tráfego para destinos como Splunk, Datadog ou Google Cloud Storage.
3. Integre alertas em *Notifications* para ser informado sobre incidentes de disponibilidade ou mudanças DNS.

## 8. Automatização e infraestrutura como código

1. Utilize o [Terraform Provider da Cloudflare](https://registry.terraform.io/providers/cloudflare/cloudflare/latest) para versionar DNS, regras e Workers.
2. Armazene o estado do Terraform em backend remoto (ex.: Terraform Cloud) e configure pipelines CI/CD para aplicar mudanças com revisão.
3. Para deploys de Workers/Pages, utilize GitHub Actions ou outra automação que execute `wrangler deploy` ou builds do Pages.

## 9. Boas práticas finais

1. Habilite **2FA** na conta Cloudflare em *My Profile → Authentication*.
2. Crie **API Tokens** com permissões restritas para automações em *My Profile → API Tokens*.
3. Documente internamente os registros DNS, regras de firewall e passos de deploy.
4. Teste mudanças em subdomínios ou ambientes de staging antes de promover para produção.
5. Monitore continuamente o desempenho e ajuste as configurações conforme o crescimento do tráfego.

Seguindo estes passos, você terá uma aplicação publicada no Cloudflare, com DNS, segurança, desempenho e monitoramento configurados desde uma conta inicial sem recursos pré-configurados.
