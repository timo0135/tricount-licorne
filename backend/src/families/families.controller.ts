import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FamiliesService } from './families.service';
import { CreateFamilyDto, UpdateFamilyDto } from './dto/family.dto';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('families')
@ApiBearerAuth()
@Controller('groups/:groupId/families')
export class FamiliesController {
  constructor(private readonly families: FamiliesService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une famille (une seule entité pour les coefficients et les soldes)' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateFamilyDto,
  ) {
    return this.families.create(user.id, groupId, dto);
  }

  @Patch(':familyId')
  @ApiOperation({ summary: 'Renommer une famille ou changer ses membres' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Param('familyId') familyId: string,
    @Body() dto: UpdateFamilyDto,
  ) {
    return this.families.update(user.id, groupId, familyId, dto);
  }

  @Delete(':familyId')
  @ApiOperation({ summary: 'Dissoudre une famille' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Param('familyId') familyId: string,
  ) {
    return this.families.remove(user.id, groupId, familyId);
  }
}
