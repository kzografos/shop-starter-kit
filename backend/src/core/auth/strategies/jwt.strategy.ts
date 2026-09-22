import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { Request } from 'express'
import { UsersService } from '../../users/users.service'

export interface JwtPayload {
  sub: string
  email: string
  role: string
}

const extractFromCookieOrBearer = (req: Request): string | null => {
  if (req.cookies?.access_token) return req.cookies.access_token
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private users: UsersService,
  ) {
    super({
      jwtFromRequest: extractFromCookieOrBearer,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: false,
    })
  }

  async validate(payload: JwtPayload) {
    const user = await this.users.findById(payload.sub)
    if (!user) throw new UnauthorizedException()
    return user
  }
}
