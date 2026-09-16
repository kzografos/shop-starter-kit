import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { LoyaltyService } from './loyalty.service'

// The customer's own loyalty history. Path kept at /profile/loyalty (the
// frontend contract); only the owner moved from Core's ProfileController.
@Controller('profile')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private service: LoyaltyService) {}

  @Get('loyalty')
  loyalty(@CurrentUser() user: { id: string }) {
    return this.service.history(user.id)
  }
}
