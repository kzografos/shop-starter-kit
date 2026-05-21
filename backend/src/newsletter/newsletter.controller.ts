import { Controller, Post, Delete, Body, Query, HttpCode } from '@nestjs/common'
import { NewsletterService } from './newsletter.service'
import { SubscribeDto } from './dto/subscribe.dto'

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
  unsubscribe(@Query('email') email: string) {
    return this.newsletter.unsubscribe(email)
  }
}
