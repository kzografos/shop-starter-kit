import { Controller, Post, Body, HttpCode } from '@nestjs/common'
import { NewsletterService } from './newsletter.service'
import { IsEmail } from 'class-validator'

class SubscribeDto {
  @IsEmail()
  email: string
}

@Controller('newsletter')
export class NewsletterController {
  constructor(private newsletter: NewsletterService) {}

  @Post('subscribe')
  @HttpCode(200)
  subscribe(@Body() dto: SubscribeDto) {
    return this.newsletter.subscribe(dto.email)
  }
}
