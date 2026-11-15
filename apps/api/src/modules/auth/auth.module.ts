import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthorizationService } from './authorization.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthorizationService],
  exports: [AuthService, AuthorizationService],
})
export class AuthModule {}
