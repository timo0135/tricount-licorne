import { Module } from '@nestjs/common';
import { CoefficientsService } from './coefficients.service';
import { CoefficientsController } from './coefficients.controller';

@Module({
  controllers: [CoefficientsController],
  providers: [CoefficientsService],
  exports: [CoefficientsService],
})
export class CoefficientsModule {}
