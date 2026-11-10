import { Module } from '@nestjs/common';
import { FamiliesService } from './families.service';
import { FamiliesController } from './families.controller';
import { GroupsModule } from '../groups/groups.module';
import { CoefficientsModule } from '../coefficients/coefficients.module';

@Module({
  imports: [GroupsModule, CoefficientsModule],
  controllers: [FamiliesController],
  providers: [FamiliesService],
})
export class FamiliesModule {}
