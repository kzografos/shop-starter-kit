import { Controller, Post, Delete, Body, Query, HttpCode } from '@nestjs/common'
import { NewsletterService } from './newsletter.service'
import { SubscribeDto } from './dto/subscribe.dto'
import { UnsubscribeDto } from './dto/unsubscribe.dto'

@Controller('newsletter')
export class NewsletterController {
  constructor(private newsletter: NewsletterService) {}

  @Post('subscribe')
  @HttpCode(200)
  subscribe(@Body() dto: SubscribeDto) {
    return this.newsletter.subscribe(dto.email)
  }

  @Delete('unsubscribe')
  @HttpCode(200)
  unsubscribe(@Query() dto: UnsubscribeDto) {
    return this.newsletter.unsubscribe(dto.email, dto.token)
  }
}
