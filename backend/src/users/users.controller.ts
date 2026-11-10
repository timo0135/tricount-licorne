import { Body, Controller, Delete, Patch, Put, UploadedFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './update-profile.dto';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { ImageUpload } from '../uploads/image-upload.decorator';
import type { UploadedImage } from '../uploads/uploads.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  @ApiOperation({ summary: 'Modifier son prénom, son avatar emoji ou sa couleur' })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.update(user.id, dto);
  }

  @Put('me/avatar')
  @ImageUpload()
  @ApiOperation({ summary: 'Changer sa photo de profil' })
  setAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedImage) {
    return this.users.setAvatar(user.id, file);
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: 'Retirer sa photo de profil (retour à l’avatar emoji)' })
  removeAvatar(@CurrentUser() user: AuthUser) {
    return this.users.removeAvatar(user.id);
  }
}
