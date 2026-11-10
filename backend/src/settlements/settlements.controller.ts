import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettlementsService } from './settlements.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('settlements')
@ApiBearerAuth()
@Controller('groups/:groupId/settlements')
export class SettlementsController {
  constructor(private readonly settlements: SettlementsService) {}

  @Get()
  @ApiOperation({ summary: 'Historique des remboursements' })
  findAll(@CurrentUser() user: AuthUser, @Param('groupId') groupId: string) {
    return this.settlements.findAll(user.id, groupId);
  }

  @Post()
  @ApiOperation({ summary: 'Enregistrer un remboursement' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateSettlementDto,
  ) {
    return this.settlements.create(user.id, groupId, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Param('id') id: string,
  ) {
    return this.settlements.remove(user.id, groupId, id);
  }
}
