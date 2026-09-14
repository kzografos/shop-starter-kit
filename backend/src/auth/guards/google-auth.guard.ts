import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthGuard } from '@nestjs/passport'
import { isGoogleAuthConfigured } from '../../core/config/env.validation'

/**
 * Passport's google guard with a configuration check in front of it.
 *
 * When GOOGLE_CLIENT_ID is unset the strategy is never registered (see
 * AuthModule), and a bare AuthGuard('google') would surface as an opaque
 * "Unknown authentication strategy" 500. This turns that into an explicit 503
 * while leaving password login untouched.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super()
  }

  canActivate(context: ExecutionContext) {
    if (!isGoogleAuthConfigured(this.config)) {
      throw new ServiceUnavailableException('Google sign-in is not configured')
    }
    return super.canActivate(context)
  }
}
