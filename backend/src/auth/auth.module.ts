import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { UsersModule } from '../users/users.module'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './strategies/jwt.strategy'
import { GoogleStrategy } from './strategies/google.strategy'

// Only register the Google strategy when credentials exist, so the app boots
// fine before Google OAuth is configured. /auth/google 500s until then.
const googleProviders = process.env.GOOGLE_CLIENT_ID ? [GoogleStrategy] : []

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    UsersModule,
  ],
  providers: [AuthService, JwtStrategy, ...googleProviders],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
