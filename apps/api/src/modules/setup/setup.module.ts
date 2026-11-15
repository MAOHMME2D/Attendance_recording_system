import { Module } from '@nestjs/common';
import { InitialSetupService } from './initial-setup.service';

@Module({
  providers: [InitialSetupService],
  exports: [InitialSetupService],
})
export class SetupModule {}
