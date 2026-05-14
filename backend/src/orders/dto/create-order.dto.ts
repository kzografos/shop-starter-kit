import {
  IsArray, IsEnum, IsInt, IsNumber, IsObject,
  IsOptional, IsString, IsUUID, Min, ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

export class OrderItemDto {
  @IsUUID()
  productId: string

  @IsInt()
  @Min(1)
  quantity: number

  @IsNumber()
  @Min(0)
  unitPrice: number
}

export class ShippingAddressDto {
  @IsString() fullName: string
  @IsString() address: string
  @IsString() city: string
  @IsString() postalCode: string
  @IsString() phone: string
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[]

  @IsEnum(['SHIPPING', 'PICKUP'])
  fulfillmentType: 'SHIPPING' | 'PICKUP'

  @IsEnum(['STRIPE', 'CASH_ON_PICKUP', 'CARD_ON_PICKUP'])
  paymentMethod: 'STRIPE' | 'CASH_ON_PICKUP' | 'CARD_ON_PICKUP'

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto

  @IsOptional()
  @IsInt()
  @Min(0)
  loyaltyPointsToRedeem?: number

  @IsOptional()
  @IsString()
  notes?: string
}
