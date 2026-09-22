import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'
import { FavouritesService } from './favourites.service'
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import { IsUUID } from 'class-validator'

class ToggleFavouriteDto {
  @IsUUID()
  productId: string
}

@Controller('favourites')
@UseGuards(JwtAuthGuard)
export class FavouritesController {
  constructor(private favs: FavouritesService) {}

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.favs.findByUser(user.id)
  }

  @Get('ids')
  getIds(@CurrentUser() user: { id: string }) {
    return this.favs.getIds(user.id)
  }

  @Post('toggle')
  toggle(@Body() dto: ToggleFavouriteDto, @CurrentUser() user: { id: string }) {
    return this.favs.toggle(user.id, dto.productId)
  }
}
