import { Module } from '@nestjs/common'
import { NewsletterController } from './newsletter.controller'
import { NewsletterAdminController } from './newsletter-admin.controller'
import { NewsletterService } from './newsletter.service'

@Module({
  controllers: [NewsletterController, NewsletterAdminController],
  providers: [NewsletterService],
})
export class NewsletterModule {}
