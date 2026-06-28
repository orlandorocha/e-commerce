import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Ao usar um arquivo de configuracao do Prisma, o carregamento automatico do
// .env e desativado. Carregamos manualmente para que DATABASE_URL/DIRECT_URL
// fiquem disponiveis nos comandos `prisma generate`, `migrate` e `seed`.
loadEnv();

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
});
