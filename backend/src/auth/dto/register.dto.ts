import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'sophie@licorne.fr' })
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @ApiProperty({ example: 'Sophie' })
  @IsString()
  @MinLength(2, { message: 'Le prénom doit faire au moins 2 caractères' })
  @MaxLength(40)
  name: string;

  @ApiProperty({ example: 'motdepasse123' })
  @IsString()
  @MinLength(10, { message: 'Le mot de passe doit faire au moins 10 caractères.' })
  @MaxLength(72)
  password: string;
}
