import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './update-profile.dto';
import { UploadedImage, UploadsService } from '../uploads/uploads.service';

const PUBLIC_USER = {
  id: true,
  email: true,
  name: true,
  emoji: true,
  color: true,
  avatarUrl: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private uploads: UploadsService,
  ) {}

  update(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { ...dto, name: dto.name?.trim() },
      select: PUBLIC_USER,
    });
  }

  /** Photo de profil : recadrée en carré, convertie en WebP, EXIF supprimées. */
  async setAvatar(userId: string, file?: UploadedImage) {
    const url = await this.uploads.saveImage(file, 'avatar');
    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
      select: PUBLIC_USER,
    });
    await this.uploads.remove(previous?.avatarUrl);
    return user;
  }

  async removeAvatar(userId: string) {
    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: PUBLIC_USER,
    });
    await this.uploads.remove(previous?.avatarUrl);
    return user;
  }
}
