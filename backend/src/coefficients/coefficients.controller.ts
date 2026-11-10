import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoefficientsService } from './coefficients.service';
import { UpdateCoefficientsDto } from './dto/update-coefficients.dto';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('coefficients')
@ApiBearerAuth()
@Controller('groups/:groupId/coefficients')
export class CoefficientsController {
  constructor(private readonly coefficients: CoefficientsService) {}

  @Get()
  @ApiOperation({ summary: 'Matrice des coefficients (licornes × catégories)' })
  matrix(@CurrentUser() user: AuthUser, @Param('groupId') groupId: string) {
    return this.coefficients.matrix(user.id, groupId);
  }

  @Put()
  @ApiOperation({ summary: 'Enregistrer les coefficients (total 100 % par catégorie)' })
  replace(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateCoefficientsDto,
  ) {
    return this.coefficients.replace(user.id, groupId, dto);
  }

  @Post('apply')
  @ApiOperation({ summary: 'Recalculer les dépenses automatiques avec les coefficients actuels' })
  apply(@CurrentUser() user: AuthUser, @Param('groupId') groupId: string) {
    return this.coefficients.applyToExistingExpenses(user.id, groupId);
  }
}
