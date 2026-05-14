import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'
import { Response } from 'express'
import { UsersService } from '../users/users.service'
import { RedisService } from '../redis/redis.service'
import { MailService } from '../mail/mail.service'
import type { JwtPayload } from './strategies/jwt.strategy'

interface RefreshPayload {
  sub: string
  jti: string
}

const REFRESH_TTL_S = 60 * 60 * 24 * 7   // 7 days
const RESET_TTL_S   = 60 * 60             // 1 hour
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private redis: RedisService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  // ─── Register ──────────────────────────────────────────────

  async register(email: string, password: string, fullName: string | undefined, res: Response) {
    const user = await this.users.create(email, password, fullName)
    return this.issueTokens(user, res)
  }

  // ─── Login ─────────────────────────────────────────────────

  async login(email: string, password: string, res: Response) {
    const user = await this.users.findByEmail(email)
    if (!user) throw new UnauthorizedException('Invalid credentials')

    const valid = await this.users.verifyPassword(user, password)
    if (!valid) throw new UnauthorizedException('Invalid credentials')

    const safe = await this.users.findById(user.id)
    return this.issueTokens(safe!, res)
  }

  // ─── Logout ────────────────────────────────────────────────

  async logout(userId: string, res: Response) {
    await this.redis.delPattern(`refresh:${userId}:*`)
    res.clearCookie('access_token', COOKIE_OPTS)
    res.clearCookie('refresh_token', COOKIE_OPTS)
    return { ok: true }
  }

  // ─── Refresh ───────────────────────────────────────────────

  async refresh(refreshToken: string | undefined, res: Response) {
    if (!refreshToken) throw new UnauthorizedException('No refresh token')

    let payload: RefreshPayload
    try {
      payload = this.jwt.verify<RefreshPayload>(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      })
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const storedKey = `refresh:${payload.sub}:${payload['jti']}`
    const exists = await this.redis.exists(storedKey)
    if (!exists) throw new UnauthorizedException('Refresh token revoked')

    // Rotate — delete old, issue new
    await this.redis.del(storedKey)
    const user = await this.users.findById(payload.sub)
    if (!user) throw new UnauthorizedException()
    return this.issueTokens(user, res)
  }

  // ─── Forgot password ───────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.users.findByEmail(email)
    // Always return 200 — don't reveal if email exists
    if (!user) return { ok: true }

    const token = randomUUID()
    await this.redis.set(`reset:${token}`, user.id, RESET_TTL_S)
    await this.mail.sendPasswordReset(email, token)
    return { ok: true }
  }

  // ─── Reset password ────────────────────────────────────────

  async resetPassword(token: string, newPassword: string, res: Response) {
    const userId = await this.redis.get(`reset:${token}`)
    if (!userId) throw new BadRequestException('Reset link expired or invalid')

    await this.users.updatePassword(userId, newPassword)
    await this.redis.del(`reset:${token}`)
    // Invalidate all sessions for this user
    await this.redis.delPattern(`refresh:${userId}:*`)
    res.clearCookie('access_token', COOKIE_OPTS)
    res.clearCookie('refresh_token', COOKIE_OPTS)
    return { ok: true }
  }

  // ─── Internal ──────────────────────────────────────────────

  private async issueTokens(
    user: { id: string; email: string; role: string },
    res: Response,
  ) {
    const jti = randomUUID()
    const accessExpires  = this.config.get('JWT_ACCESS_EXPIRES',  '15m')
    const refreshExpires = this.config.get('JWT_REFRESH_EXPIRES', '7d')

    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      { secret: this.config.getOrThrow('JWT_SECRET'), expiresIn: accessExpires },
    )

    const refreshToken = this.jwt.sign(
      { sub: user.id, jti },
      { secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), expiresIn: refreshExpires },
    )

    await this.redis.set(`refresh:${user.id}:${jti}`, '1', REFRESH_TTL_S)

    res.cookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 })
    res.cookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: REFRESH_TTL_S * 1000 })

    return { user: await this.users.findById(user.id) }
  }
}
