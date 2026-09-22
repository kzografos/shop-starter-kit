import {
  Controller, Post, Get, Body, Res, Req,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Throttle } from '@nestjs/throttler'
import { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { GoogleAuthGuard } from './guards/google-auth.guard'
import { CurrentUser } from './decorators/current-user.decorator'
import type { GoogleProfile } from './strategies/google.strategy'

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  // ─── Google OAuth ──────────────────────────────────────────

  // Step 1: redirect the browser to Google's consent screen.
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
    // Guard handles the redirect; nothing to do here.
  }

  // Step 2: Google redirects back here. Guard populates req.user with the profile.
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    await this.auth.googleLogin(req.user as GoogleProfile, res)
    const frontend = this.config.get<string>('NUXT_URL', 'http://localhost:3000').split(',')[0].trim()
    res.redirect(`${frontend}/auth/callback`)
  }

  @Post('register')
  register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.register(dto.email, dto.password, dto.fullName, res)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto.email, dto.password, res)
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser() user: { id: string }, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(user.id, res)
  }

  @Post('refresh')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req.cookies?.refresh_token, res)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: unknown) {
    return { user }
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email)
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.resetPassword(dto.token, dto.password, res)
  }
}
