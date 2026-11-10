import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { BalancesModule } from '../balances/balances.module';
import { CoefficientsModule } from '../coefficients/coefficients.module';

@Module({
  imports: [BalancesModule, CoefficientsModule],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
