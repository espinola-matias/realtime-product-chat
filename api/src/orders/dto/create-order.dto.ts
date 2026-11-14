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
  ValidateNested,
} from 'class-validator';
import { OrderProduct } from '../interfaces/order.interface';

export class ProductDto implements OrderProduct {
  @IsString({ message: 'product.id debe ser texto' })
  @IsNotEmpty({ message: 'product.id es obligatorio' })
  id!: string;

  @IsString({ message: 'product.name debe ser texto' })
  @IsNotEmpty({ message: 'product.name es obligatorio' })
  name!: string;

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'product.price debe ser un número' },
  )
  @IsPositive({ message: 'product.price debe ser mayor que cero' })
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
