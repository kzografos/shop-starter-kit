import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus'
import { PrismaService } from '../prisma/prisma.service'
import { RedisHealthIndicator } from './redis.health'

/**
 * GET /health — Terminus format: `status` is "ok" when every component is up
 * and "error" (HTTP 503) when any is down; `info` / `error` / `details` list
 * the components. Both components checked here are hard dependencies
 * (database: everything; redis: sessions), so there is no partial "degraded"
 * verdict — an outage of either means the API cannot serve users.
 */
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaIndicator: PrismaHealthIndicator,
    private prisma: PrismaService,
    private redisIndicator: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma),
      () => this.redisIndicator.isHealthy('redis'),
    ])
  }
}
