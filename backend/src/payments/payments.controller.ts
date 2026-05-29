import {
  Controller, Post, Get, Query, Body, Headers, Req,
  UseGuards, RawBodyRequest, HttpCode,
} from '@nestjs/common'
import { Request } from 'express'
import { SkipThrottle } from '@nestjs/throttler'
import { PaymentsService } from './payments.service'
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { IsString } from 'class-validator'

class CreateCheckoutDto {
  @IsString() orderId: string
  @IsString() successUrl: string
  @IsString() cancelUrl: string
}

@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post('create-checkout')
  @UseGuards(OptionalJwtAuthGuard)
  createCheckout(
    @Body() dto: CreateCheckoutDto,
    @CurrentUser() user: { id: string } | undefined,
  ) {
    return this.payments.createCheckoutSession(
      dto.orderId,
      user?.id ?? null,
      dto.successUrl,
      dto.cancelUrl,
    )
  }

  @Get('verify-session')
  @UseGuards(OptionalJwtAuthGuard)
  verifySession(
    @Query('session_id') sessionId: string,
    @CurrentUser() user: { id: string } | undefined,
  ) {
    return this.payments.verifySession(sessionId, user?.id ?? null)
  }

  @Post('webhook')
  @SkipThrottle()
  @HttpCode(200)
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    return this.payments.handleWebhook(req.rawBody!, sig)
  }
}
