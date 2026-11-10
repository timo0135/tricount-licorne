import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CATEGORIES } from '../../common/categories';

export class ShareDto {
  @ApiProperty({
    description: 'Entité : « u:<id utilisateur> » pour une personne seule, « f:<id famille> » pour une famille',
    example: 'u:3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90',
  })
  @Matches(/^[uf]:[0-9a-f-]{36}$/i, { message: 'Identifiant d’entité invalide' })
  partyId: string;

  @ApiProperty({
    description: 'Coefficient en points de base : 10 000 = 100 %, 2 500 = 25 %',
    example: 2500,
    minimum: 0,
    maximum: 10000,
  })
  @IsInt()
  @Min(0)
  @Max(10000)
  shareBp: number;
}

export class CategoryCoefficientsDto {
  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES as unknown as string[])
  category: string;

  @ApiProperty({ type: [ShareDto], description: 'Toutes les entités du troupeau (membres seuls et familles), total = 10 000' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ShareDto)
  shares: ShareDto[];
}

export class UpdateCoefficientsDto {
  @ApiProperty({ type: [CategoryCoefficientsDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CategoryCoefficientsDto)
  categories: CategoryCoefficientsDto[];
}
