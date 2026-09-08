import { Transform } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
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
 * Trims before validation runs, so a whitespace-only value fails @IsNotEmpty
 * instead of slipping through as a "non-empty" string and being stored as
 * spaces. The global ValidationPipe sets transform: true, which is what makes
 * these run.
 */
const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))

/**
 * Admin product payload.
 *
 * Property names are snake_case because that is the wire format the admin client
 * sends, matching SnakeCaseInterceptor on the way out.
 *
 * Before this DTO existed the controller took Record<string, unknown> and the
 * service cast fields straight into Prisma. The global ValidationPipe was already
 * configured with whitelist + forbidNonWhitelisted, but an untyped body gives it
 * no metatype to work against, so every key was written unchecked -- a mass
 * assignment path into the ORM.
 */
export class UpsertProductDto {
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

  // The form submits '' for an untouched description, so empty is allowed here
  // and normalised to null in the service.
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description_el?: string

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description_en?: string

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'price must be a number with at most 2 decimals' })
  @Min(0)
  @Max(9999999.99)
  price: number

  // null clears the "was" price. ValidateIf lets null through while still
  // rejecting a non-null value that is not a valid amount.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999.99)
  compare_at_price?: number | null

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999.99)
  cost?: number | null

  @IsInt({ message: 'stock must be a whole number' })
  @Min(0)
  @Max(1000000)
  stock: number

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  brand?: string

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUUID('4', { message: 'category_id must be a valid category' })
  category_id?: string | null

  @IsOptional()
  @IsBoolean()
  is_active?: boolean

  // MinIO object keys produced by the uploads endpoint, or absolute URLs for
  // externally hosted images.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  images?: string[]
}
