import { Transform } from 'class-transformer'
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator'

// Roles are stored lowercase (the database values). The admin form has always
// sent them uppercase, so both casings are accepted and normalised before
// validation and persistence; the wire contract does not change.
const STAFF_ROLE_VALUES = ['admin', 'accountant', 'stock_manager'] as const

const normalizeRole = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value

export class CreateStaffDto {
  @IsEmail()
  email!: string

  @IsOptional()
  @IsString()
  fullName?: string

  @Transform(normalizeRole)
  @IsIn(STAFF_ROLE_VALUES)
  role!: (typeof STAFF_ROLE_VALUES)[number]

  @IsString()
  @MinLength(8)
  password!: string
}

export class UpdateStaffRoleDto {
  @Transform(normalizeRole)
  @IsIn(STAFF_ROLE_VALUES)
  role!: (typeof STAFF_ROLE_VALUES)[number]
}

export class ResetStaffPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string
}
