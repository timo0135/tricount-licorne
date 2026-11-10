import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CATEGORIES } from '../../common/categories';

export enum SplitModeDto {
  AUTO = 'AUTO',
  EQUAL = 'EQUAL',
  SHARES = 'SHARES',
  EXACT = 'EXACT',
}

export class ExpenseParticipantDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ description: 'Nombre de parts (mode SHARES)', example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  weight?: number;

  @ApiPropertyOptional({ description: 'Montant exact en centimes (mode EXACT)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  amountCents?: number;
}

export class CreateExpenseDto {
  @ApiProperty({ example: 'Crêpes au caramel' })
  @IsString()
  @Length(1, 80)
  title: string;

  @ApiProperty({ description: 'Montant en centimes', example: 2450 })
  @IsInt()
  @Min(1)
  amountCents: number;

  @ApiPropertyOptional({ example: '2026-08-17T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES as unknown as string[])
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;

  @ApiPropertyOptional({ description: 'Par défaut : la licorne connectée' })
  @IsOptional()
  @IsUUID()
  paidById?: string;

  @ApiPropertyOptional({
    enum: SplitModeDto,
    default: SplitModeDto.AUTO,
    description:
      'AUTO = réparti selon les coefficients du troupeau pour la catégorie choisie (par défaut)',
  })
  @IsOptional()
  @IsEnum(SplitModeDto)
  splitMode?: SplitModeDto;

  @ApiPropertyOptional({
    type: [ExpenseParticipantDto],
    description:
      'Par défaut : toutes les licornes du troupeau ayant un coefficient > 0 pour la catégorie',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseParticipantDto)
  participants?: ExpenseParticipantDto[];
}
