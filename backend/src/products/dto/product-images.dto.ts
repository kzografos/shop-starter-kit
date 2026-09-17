import { ArrayUnique, IsArray, IsString, MaxLength } from 'class-validator'

/**
 * New display order for a product's images: exactly the references the
 * product holds today, in the wanted order. Index 0 becomes the primary image.
 */
export class ReorderImagesDto {
  @IsArray()
  @ArrayUnique({ message: 'images must not contain duplicates' })
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  images: string[]
}
