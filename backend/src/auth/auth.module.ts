import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { UsersModule } from '../users/users.module'
import { isGoogleAuthConfigured } from '../core/config/env.validation'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './strategies/jwt.strategy'
import { GoogleStrategy } from './strategies/google.strategy'
import { GoogleAuthGuard } from './guards/google-auth.guard'

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    UsersModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleAuthGuard,
    {
      // Decided at runtime from validated config, not from process.env at
      // import time. Constructing the strategy is what registers it with
      // passport; a null provider means /auth/google is served by
      // GoogleAuthGuard's 503 instead.
      provide: GoogleStrategy,
      inject: [ConfigService],
      useFactory: (config: ConfigService): GoogleStrategy | null =>
        isGoogleAuthConfigured(config) ? new GoogleStrategy(config) : null,
    },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
