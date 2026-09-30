import { Inject, Injectable, Logger } from '@nestjs/common'
import Redis from 'ioredis'
import { REDIS_CLIENT } from './redis.constants'

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name)

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, value, 'EX', ttlSeconds)
    } catch (err) {
      this.logger.warn(`Redis set failed for key "${key}": ${err.message}`)
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key)
    } catch (err) {
      this.logger.warn(`Redis get failed for key "${key}": ${err.message}`)
      return null
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key)
    } catch (err) {
      this.logger.warn(`Redis del failed for key "${key}": ${err.message}`)
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await this.client.exists(key)) === 1
    } catch (err) {
      this.logger.warn(`Redis exists failed for key "${key}": ${err.message}`)
      return false
    }
  }

  /**
   * Liveness probe for /health: PING with a short deadline. Unlike the cache
   * operations above this does not swallow the failure — the caller wants to
   * know. Never throws; false means "down" (error or no answer in time).
   */
  async ping(timeoutMs = 2000): Promise<boolean> {
    try {
      const reply = await Promise.race([
        this.client.ping(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs).unref()),
      ])
      return reply === 'PONG'
    } catch (err) {
      this.logger.warn(`Redis ping failed: ${err.message}`)
      return false
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const stream = this.client.scanStream({ match: pattern, count: 100 })
      const pipeline = this.client.pipeline()

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (keys: string[]) => {
          if (keys.length) keys.forEach(k => pipeline.del(k))
        })
        stream.on('end', async () => {
          await pipeline.exec()
          resolve()
        })
        stream.on('error', reject)
      })
    } catch (err) {
      this.logger.warn(`Redis delPattern failed for pattern "${pattern}": ${err.message}`)
    }
  }
}
