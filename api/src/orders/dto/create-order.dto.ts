import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Matches,
  Max,
  ValidateNested,
} from 'class-validator';
import { OrderProduct } from '../interfaces/order.interface';

/** Mismo tope que el comercio (10 dígitos enteros). */
export const MAX_PRICE = 9_999_999_999;

export class ProductDto implements OrderProduct {
  @IsString({ message: 'product.id debe ser texto' })
  @IsNotEmpty({ message: 'product.id es obligatorio' })
  id!: string;

  @IsString({ message: 'product.name debe ser texto' })
  @IsNotEmpty({ message: 'product.name es obligatorio' })
  name!: string;

  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: 'product.price debe ser un número con máximo 2 decimales' },
  )
  @IsPositive({ message: 'product.price debe ser mayor que cero' })
  @Max(MAX_PRICE, { message: 'product.price no puede superar 9.999.999.999' })
  price!: number;

  @IsString({ message: 'product.currency debe ser texto' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'product.currency debe ser un código ISO de 3 letras (ej. COP)',
  })
  currency!: string;

  @IsOptional()
  @IsUrl({}, { message: 'product.imageUrl debe ser una URL válida' })
  imageUrl?: string;
}

export class CreateOrderDto {
  @IsString({ message: 'chatId debe ser texto' })
  @IsNotEmpty({ message: 'chatId es obligatorio' })
  chatId!: string;

  @IsString({ message: 'messageId debe ser texto' })
  @IsNotEmpty({ message: 'messageId es obligatorio' })
  messageId!: string;

  @IsDefined({ message: 'product es obligatorio' })
  @IsObject({ message: 'product debe ser un objeto' })
  @ValidateNested()
  @Type(() => ProductDto)
  product!: ProductDto;
}
