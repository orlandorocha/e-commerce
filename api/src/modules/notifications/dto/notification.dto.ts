import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel } from '@prisma/client';

export class CreateNotificationDto {
  @ApiPropertyOptional({
    description: 'Destinatario. Se omitido, e tratada como notificacao geral.',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ enum: NotificationChannel, default: NotificationChannel.EMAIL })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ example: 'Pedido confirmado' })
  @IsString()
  @MaxLength(150)
  title: string;

  @ApiProperty({ example: 'Seu pedido #1001 foi confirmado.' })
  @IsString()
  message: string;
}
