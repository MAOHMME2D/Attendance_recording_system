import { Module } from '@nestjs/common';
import { FollowupController } from './followup.controller';
import { FollowupService } from './followup.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FollowupController],
  providers: [FollowupService],
})
export class FollowupModule {}
