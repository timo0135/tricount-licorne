import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFamilyDto {
  @ApiProperty({ example: 'Famille Martin' })
  @IsString()
  @MinLength(1, { message: 'Donne un nom à la famille.' })
  @MaxLength(40)
  name: string;

  @ApiProperty({ type: [String], description: 'Membres du troupeau à rattacher à la famille' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Une famille compte au moins un membre.' })
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  memberIds: string[];
}

export class UpdateFamilyDto {
  @ApiPropertyOptional({ example: 'Famille Martin' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @ApiPropertyOptional({ type: [String], description: 'Liste complète des membres de la famille' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Une famille compte au moins un membre.' })
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  memberIds?: string[];
}
