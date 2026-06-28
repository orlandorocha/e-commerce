import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conexao com o banco de dados estabelecida');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Helper para limpar o banco em ambiente de testes.
   */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    const modelNames = Object.keys(this).filter(
      (key) => !key.startsWith('_') && !key.startsWith('$'),
    );
    return this.$transaction(
      modelNames.map((modelName) => (this as any)[modelName].deleteMany()),
    ) as unknown as Promise<void>;
  }
}
