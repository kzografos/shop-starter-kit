import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator'

/** Query of DELETE /newsletter/unsubscribe: the address and its link token. */
export class UnsubscribeDto {
  @IsEmail()
  @IsNotEmpty()
  email: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string
}
