import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common'
import { UsersService } from '../users/users.service'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { IsOptional, IsString, MaxLength } from 'class-validator'

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string
}

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private users: UsersService,
    private prisma: PrismaService,
  ) {}

  @Get()
  me(@CurrentUser() user: unknown) {
    return user
  }

  @Patch()
  update(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.users.updateProfile(user.id, dto)
  }

  @Get('loyalty')
  loyalty(@CurrentUser() user: { id: string }) {
    return this.prisma.loyaltyTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
  }
}
