import { Injectable } from '@nestjs/common'
import { HealthIndicatorService } from '@nestjs/terminus'
import { RedisService } from '../redis/redis.service'

/**
 * Redis is a hard dependency: refresh tokens and password-reset tokens live
 * there, so without it nobody can stay signed in. It therefore counts as
 * "down" for the whole check, not merely degraded. The result carries a
 * plain message only — never the connection URL or the error text.
 */
@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly indicators: HealthIndicatorService,
    private readonly redis: RedisService,
  ) {}

  async isHealthy(key = 'redis') {
    const session = this.indicators.check(key)
    return (await this.redis.ping()) ? session.up() : session.down({ message: 'Redis did not answer PING' })
  }
}
