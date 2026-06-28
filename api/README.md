# E-commerce Backend (NestJS + Prisma + PostgreSQL + Redis)

API REST completa para uma plataforma de e-commerce, construída com **NestJS 10**, **Prisma 6**, **PostgreSQL** e **Redis**. Inclui autenticação JWT (access + refresh), controle de acesso por papéis/permissões, catálogo de produtos, carrinho, checkout transacional, cupons, controle de estoque e dashboard administrativo.

## Stack

- **NestJS 10** — framework modular
- **Prisma 6** — ORM e migrations
- **PostgreSQL** — banco relacional (Neon em produção, Postgres local via Docker)
- **Redis (ioredis)** — cache resiliente (a app continua funcionando se o Redis cair)
- **JWT (Passport)** — autenticação com access + refresh tokens
- **Swagger** — documentação interativa em `/api/docs`
- **class-validator / class-transformer** — validação de DTOs
- **Helmet, Throttler, CORS** — segurança

## Estrutura

```
api/
├── prisma/
│   ├── schema.prisma      # Modelagem completa de todos os domínios
│   └── seed.ts            # Seed (admin, permissões, categorias, marcas, produtos)
├── src/
│   ├── common/            # Guards, decorators, filtros, interceptors, DTOs e utils
│   ├── config/            # Configuração tipada (env)
│   ├── database/          # PrismaService + módulo global
│   ├── modules/
│   │   ├── auth/          # Login, registro, refresh, recuperação/alteração de senha, perfil
│   │   ├── users/         # CRUD de usuários (admin)
│   │   ├── customers/     # Endereços, lista de desejos/favoritos
│   │   ├── categories/    # Categorias hierárquicas
│   │   ├── brands/        # Marcas
│   │   ├── suppliers/     # Fornecedores
│   │   ├── products/      # Produtos, imagens, variações + controle de estoque
│   │   ├── cart/          # Carrinho (usuário logado e visitante via session-id)
│   │   ├── coupons/       # Cupons de desconto + validação
│   │   ├── orders/        # Checkout transacional + gestão de status
│   │   ├── dashboard/     # Métricas administrativas
│   │   ├── cache/         # Serviço Redis
│   │   └── audit/         # Log de auditoria
│   └── main.ts            # Bootstrap (Swagger, segurança, validação global)
└── docker-compose.yml     # Postgres + Redis + API
```

## Setup local

### 1. Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste os valores:

```bash
cp .env.example .env
```

As variáveis essenciais são `DATABASE_URL`, `DIRECT_URL`, os segredos JWT e a conexão Redis.
Neste projeto, `DATABASE_URL`/`DIRECT_URL` já apontam para o banco **Neon** provisionado.

### 2. Instalar dependências

```bash
npm install
```

### 3. Banco de dados

Gerar o client e aplicar as migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Popular dados iniciais (admin, permissões, catálogo de exemplo):

```bash
npm run seed
```

### 4. Rodar a API

```bash
npm run start:dev
```

A API sobe em `http://localhost:3001/api` e a documentação Swagger em `http://localhost:3001/api/docs`.

## Rodando com Docker

O `docker-compose.yml` sobe Postgres, Redis e a API juntos (com migrations aplicadas automaticamente):

```bash
docker compose up --build
```

> Para usar o Postgres do Docker em vez do Neon, ajuste `DATABASE_URL`/`DIRECT_URL` para apontar para o serviço `postgres`.

## Credenciais do seed

| Papel   | E-mail            | Senha       |
|---------|-------------------|-------------|
| Admin   | admin@loja.com    | Admin@123   |
| Cliente | cliente@loja.com  | Cliente@123 |

## Principais grupos de endpoints

| Prefixo              | Descrição                                              |
|----------------------|--------------------------------------------------------|
| `POST /api/auth/*`   | Registro, login, refresh, logout, perfil, senhas       |
| `GET/POST /api/users`| Gestão de usuários (admin)                             |
| `/api/customers/*`   | Endereços e lista de desejos do cliente autenticado    |
| `/api/categories`    | Categorias (árvore hierárquica)                        |
| `/api/brands`        | Marcas                                                 |
| `/api/suppliers`     | Fornecedores (admin)                                   |
| `/api/products`      | Catálogo + `/stock` para movimentações de estoque      |
| `/api/cart`          | Carrinho (logado ou visitante via header `x-session-id`)|
| `/api/coupons`       | Cupons + `POST /api/coupons/validate`                  |
| `/api/orders`        | Checkout, histórico do cliente e gestão de status      |
| `/api/dashboard`     | Métricas administrativas                               |

## Segurança

- Senhas com hash **bcrypt**.
- **Access token** (curta duração) + **refresh token** (persistido e revogável).
- **RolesGuard** + decorator `@Roles()` para autorização por papel (`ADMIN`, `GERENTE`, `CLIENTE`).
- Rate limiting global via **Throttler** e headers de segurança via **Helmet**.
- Validação e sanitização de toda entrada via **class-validator** (whitelist + forbidNonWhitelisted).

## Scripts úteis

| Comando                 | Ação                                  |
|-------------------------|---------------------------------------|
| `npm run start:dev`     | Servidor em modo watch                |
| `npm run build`         | Build de produção                     |
| `npm run prisma:migrate`| Criar/aplicar migrations (dev)        |
| `npm run prisma:deploy` | Aplicar migrations (produção)         |
| `npm run prisma:studio` | Prisma Studio (GUI do banco)          |
| `npm run seed`          | Popular dados iniciais                |

## Troubleshooting

### `prisma generate` falha com `unable to get local issuer certificate`

Isso ocorre em redes corporativas com inspeção de SSL (proxy que substitui o
certificado). O Node não reconhece a CA raiz interna ao baixar os engines do
Prisma. Escolha **uma** das opções:

**Opção A — Apontar o Node para a CA corporativa (recomendado e seguro)**

1. Exporte o certificado raiz da sua empresa em formato `.pem` (peça ao time de
   TI ou exporte pelo navegador).
2. Defina a variável de ambiente apontando para o arquivo e gere o client:

   ```powershell
   # Windows (PowerShell)
   $env:NODE_EXTRA_CA_CERTS="C:\caminho\para\corp-root-ca.pem"
   npx prisma generate
   ```

   ```bash
   # macOS / Linux
   export NODE_EXTRA_CA_CERTS=/caminho/para/corp-root-ca.pem
   npx prisma generate
   ```

   Para tornar permanente no Windows, adicione `NODE_EXTRA_CA_CERTS` nas
   variáveis de ambiente do usuário.

**Opção B — Desabilitar a verificação TLS temporariamente (inseguro)**

Use apenas em máquina de desenvolvimento, nunca em produção:

```powershell
# Windows (PowerShell)
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"
npx prisma generate
```

```bash
# macOS / Linux
NODE_TLS_REJECT_UNAUTHORIZED=0 npx prisma generate
```

Depois que os engines forem baixados uma vez, ficam em cache e o
`prisma generate` não tenta baixar novamente.
