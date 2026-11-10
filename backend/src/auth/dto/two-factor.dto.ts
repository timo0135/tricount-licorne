import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString, Length, MaxLength } from 'class-validator';

export class TwoFactorCodeDto {
  @ApiProperty({ example: '123456', description: 'Code à 6 chiffres, ou code de secours (k7mq-2xpw)' })
  @IsString()
  @Length(6, 16, { message: 'Code invalide.' })
  code: string;
}

export class TwoFactorLoginDto extends TwoFactorCodeDto {
  @ApiProperty({ description: 'Jeton reçu à la première étape de la connexion' })
  @IsJWT()
  challengeToken: string;
}

export class DisableTwoFactorDto extends TwoFactorCodeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(72)
  password: string;
}
