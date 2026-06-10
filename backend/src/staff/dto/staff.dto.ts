import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator'

const STAFF_ROLE_VALUES = ['ADMIN', 'ACCOUNTANT', 'STOCK_MANAGER'] as const

export class CreateStaffDto {
  @IsEmail()
  email!: string

  @IsOptional()
  @IsString()
  fullName?: string

  @IsIn(STAFF_ROLE_VALUES)
  role!: (typeof STAFF_ROLE_VALUES)[number]

  @IsString()
  @MinLength(8)
  password!: string
}

export class UpdateStaffRoleDto {
  @IsIn(STAFF_ROLE_VALUES)
  role!: (typeof STAFF_ROLE_VALUES)[number]
}

export class ResetStaffPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string
}
