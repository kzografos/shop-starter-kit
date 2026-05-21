import { IsOptional, IsInt, Min, IsString, IsArray } from 'class-validator'
import { Type, Transform } from 'class-transformer'

export class QueryProductsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  @IsArray()
  @IsString({ each: true })
  categories?: string[]

  @IsOptional()
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  @IsArray()
  @IsString({ each: true })
  brand?: string[]

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number

  @IsOptional()
  @IsString()
  animalType?: string

  @IsOptional()
  @IsString()
  sort?: string
}
