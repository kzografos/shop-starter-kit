import {
  Controller, Post, Body, Headers, Req,
  UseGuards, RawBodyRequest, HttpCode,
} from '@nestjs/common'
import { Request } from 'express'
import { PaymentsService } from './payments.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { IsString, IsUrl } from 'class-validator'

class CreateCheckoutDto {
  @IsString() orderId: string
  @IsString() successUrl: string
  @IsString() cancelUrl: string
}

@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post('create-checkout')
  @UseGuards(JwtAuthGuard)
  createCheckout(
    @Body() dto: CreateCheckoutDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.payments.createCheckoutSession(
      dto.orderId,
      user.id,
      dto.successUrl,
      dto.cancelUrl,
    )
  }

  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    return this.payments.handleWebhook(req.rawBody!, sig)
  }
}
