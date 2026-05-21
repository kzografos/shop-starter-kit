import {
  ArrayMinSize, IsArray, IsEnum, IsInt, IsNotEmpty, IsObject,
  IsOptional, IsString, IsUUID, Min, ValidateIf, ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

export class OrderItemDto {
  @IsUUID()
  productId: string

  @IsInt()
  @Min(1)
  quantity: number
}

export class ShippingAddressDto {
  @IsString() @IsNotEmpty() fullName: string
  @IsString() @IsNotEmpty() address: string
  @IsString() @IsNotEmpty() city: string
  @IsString() @IsNotEmpty() postalCode: string
  @IsString() @IsNotEmpty() phone: string
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[]

  @IsEnum(['SHIPPING', 'PICKUP'])
  fulfillmentType: 'SHIPPING' | 'PICKUP'

  @IsEnum(['STRIPE', 'CASH_ON_PICKUP', 'CARD_ON_PICKUP'])
  paymentMethod: 'STRIPE' | 'CASH_ON_PICKUP' | 'CARD_ON_PICKUP'

  @ValidateIf(o => o.fulfillmentType === 'SHIPPING')
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
