import { Transform } from 'class-transformer'
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator'

/**
 * Admin category payload. snake_case to match the admin client's wire format.
 *
 * Shape validation lives here; the business rules that need a database read --
 * slug uniqueness, two-level nesting, self-parenting, delete guards -- stay in
 * AdminService where they can query.
 */
/** See the note in product.dto.ts — trims before validation so '   ' fails. */
const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))

export class CreateCategoryDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'slug is required' })
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric words separated by single hyphens',
  })
  slug: string

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Greek name is required' })
  @MaxLength(300)
  name_el: string

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'English name is required' })
  @MaxLength(300)
  name_en: string

  // The client sends '' for "no parent"; both '' and null mean top level.
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUUID('4', { message: 'parent_id must be a valid category' })
  parent_id?: string | null

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sort_order?: number
}

/**
 * Update deliberately omits slug: it is locked after creation, and the service
 * has always ignored it. Declaring it here would let the client believe a slug
 * change had been accepted.
 */
export class UpdateCategoryDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Greek name is required' })
  @MaxLength(300)
  name_el: string

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'English name is required' })
  @MaxLength(300)
  name_en: string

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUUID('4', { message: 'parent_id must be a valid category' })
  parent_id?: string | null

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sort_order?: number
}
