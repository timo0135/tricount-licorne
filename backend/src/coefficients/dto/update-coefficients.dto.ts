import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CATEGORIES } from '../../common/categories';

export class ShareDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

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

  @ApiProperty({ type: [ShareDto], description: 'Toutes les licornes du troupeau, total = 10 000' })
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
