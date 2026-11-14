import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CreateOrderDto } from '../dto/create-order.dto';
import { Order } from '../interfaces/order.interface';
import { OrdersService } from '../services/orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateOrderDto): Promise<Order> {
    return this.ordersService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Order {
    return this.ordersService.findOne(id);
  }
}
