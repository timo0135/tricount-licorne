import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { randomColor, randomEmoji } from '../common/unicorn';

const PUBLIC_USER = {
  id: true,
  email: true,
  name: true,
  emoji: true,
  color: true,
  createdAt: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Un compte existe déjà avec cet email');

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        password: await bcrypt.hash(dto.password, 10),
        emoji: randomEmoji(),
        color: randomColor(),
      },
      select: PUBLIC_USER,
    });

    return { user, accessToken: this.sign(user.id) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const { password, updatedAt, ...safe } = user;
    return { user: safe, accessToken: this.sign(user.id) };
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: PUBLIC_USER });
  }

  private sign(userId: string) {
    return this.jwt.sign({ sub: userId });
  }
}
