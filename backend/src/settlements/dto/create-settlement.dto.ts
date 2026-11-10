import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateSettlementDto {
  @ApiProperty({ description: 'Licorne qui rembourse' })
  @IsUUID()
  fromUserId: string;

  @ApiProperty({ description: 'Licorne remboursée' })
  @IsUUID()
  toUserId: string;

  @ApiProperty({ description: 'Montant en centimes', example: 1200 })
  @IsInt()
  @Min(1)
  amountCents: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(140)
  note?: string;
}
