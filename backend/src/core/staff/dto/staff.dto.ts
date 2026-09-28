import { Transform } from 'class-transformer'
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

// Roles are stored lowercase (the database values). The admin form has always
// sent them uppercase, so both casings are accepted and normalised before
// validation and persistence; the wire contract does not change. Which roles
// exist is the permission registry's answer — the owner plus every preset a
// module registered — so StaffService checks the value, not a list here.
const normalizeRole = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value

export class CreateStaffDto {
  @IsEmail()
  email!: string

  @IsOptional()
  @IsString()
  fullName?: string

  @Transform(normalizeRole)
  @IsString()
  role!: string

  @IsString()
  @MinLength(8)
  password!: string
}

export class UpdateStaffRoleDto {
  @Transform(normalizeRole)
  @IsString()
  role!: string
}

export class ResetStaffPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string
}
