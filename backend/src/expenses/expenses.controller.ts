import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('expenses')
@ApiBearerAuth()
@Controller('groups/:groupId/expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @ApiQuery({ name: 'category', required: false })
  findAll(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Query('category') category?: string,
  ) {
    return this.expenses.findAll(user.id, groupId, category);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Répartition des dépenses par catégorie' })
  stats(@CurrentUser() user: AuthUser, @Param('groupId') groupId: string) {
    return this.expenses.statsByCategory(user.id, groupId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Param('id') id: string,
  ) {
    return this.expenses.findOne(user.id, groupId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Ajouter une dépense' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expenses.create(user.id, groupId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expenses.update(user.id, groupId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Param('id') id: string,
  ) {
    return this.expenses.remove(user.id, groupId, id);
  }
}
