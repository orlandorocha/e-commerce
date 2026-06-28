import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private available = false;
  private readonly defaultTtl: number;

  constructor(private readonly config: ConfigService) {
    this.defaultTtl = this.config.get<number>('redis.ttl', 3600);
  }

  onModuleInit(): void {
    try {
      this.client = new Redis({
        host: this.config.get<string>('redis.host'),
        port: this.config.get<number>('redis.port'),
        password: this.config.get<string>('redis.password') || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });

      this.client.on('error', (err) => {
        if (this.available) {
          this.logger.warn(`Redis indisponivel: ${err.message}`);
        }
        this.available = false;
      });

      this.client.on('ready', () => {
        this.available = true;
        this.logger.log('Conexao com Redis estabelecida');
      });

      this.client.connect().catch(() => {
        this.logger.warn(
          'Nao foi possivel conectar ao Redis. Cache desabilitado.',
        );
      });
    } catch (error) {
      this.logger.warn(`Falha ao inicializar Redis: ${String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit().catch(() => undefined);
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.available || !this.client) return null;
    try {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      await this.client.set(
        key,
        JSON.stringify(value),
        'EX',
        ttl ?? this.defaultTtl,
      );
    } catch {
      /* ignore */
    }
  }

  async del(pattern: string): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      if (pattern.includes('*')) {
        const keys = await this.client.keys(pattern);
        if (keys.length) await this.client.del(...keys);
      } else {
        await this.client.del(pattern);
      }
    } catch {
      /* ignore */
    }
  }
}
