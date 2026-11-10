import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { GRADIENTS } from '../../common/unicorn';

export class CreateGroupDto {
  @ApiProperty({ example: 'Week-end à Brocéliande' })
  @IsString()
  @Length(2, 60)
  name: string;

  @ApiPropertyOptional({ example: 'Le voyage des licornes bretonnes' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: '🦄' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string;

  @ApiPropertyOptional({ enum: GRADIENTS })
  @IsOptional()
  @IsIn(GRADIENTS)
  gradient?: string;
}
