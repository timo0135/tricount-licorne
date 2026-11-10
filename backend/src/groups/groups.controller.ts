import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { BalancesService } from '../balances/balances.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('groups')
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly balances: BalancesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Créer un troupeau' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto) {
    return this.groups.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Mes troupeaux' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.groups.findAllForUser(user.id);
  }

  @Post('join')
  @ApiOperation({ summary: "Rejoindre un troupeau avec un code d'invitation" })
  join(@CurrentUser() user: AuthUser, @Body() dto: JoinGroupDto) {
    return this.groups.join(user.id, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.groups.findOne(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groups.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.groups.remove(user.id, id);
  }

  @Post(':id/invite-code')
  @ApiOperation({ summary: "Régénérer le code d'invitation" })
  regenerate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.groups.regenerateInviteCode(user.id, id);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Quitter le troupeau ou en retirer une licorne' })
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') memberId: string,
  ) {
    return this.groups.removeMember(user.id, id, memberId);
  }

  @Get(':id/balances')
  @ApiOperation({ summary: 'Soldes et remboursements suggérés' })
  balancesOf(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.balances.forGroup(user.id, id);
  }
}
