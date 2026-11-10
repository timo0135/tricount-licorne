import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class JoinGroupDto {
  @ApiProperty({ example: 'K7XZ2M9P' })
  @IsString()
  @Length(4, 16)
  inviteCode: string;
}
