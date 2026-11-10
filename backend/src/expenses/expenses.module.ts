import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { GroupsModule } from '../groups/groups.module';
import { CoefficientsModule } from '../coefficients/coefficients.module';

@Module({
  imports: [GroupsModule, CoefficientsModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
