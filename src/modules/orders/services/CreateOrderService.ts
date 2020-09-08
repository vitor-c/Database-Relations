import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('ordersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('productsRepository')
    private productsRepository: IProductsRepository,
    @inject('customersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Usuario não encontrado');
    }

    const existenProdutcs = await this.productsRepository.findAllById(products);

    if (!existenProdutcs.length) {
      throw new AppError('ids de produtos não encontrados');
    }
    const existenProdutcsIds = existenProdutcs.map(product => product.id);

    const checkInexistentProduct = products.filter(
      product => !existenProdutcsIds.includes(product.id),
    );

    if (checkInexistentProduct.length) {
      throw new AppError(
        `Produto não encontrado ${checkInexistentProduct[0].id}`,
      );
    }

    const findProductsWithNoQuantityAvaliable = products.filter(
      product =>
        existenProdutcs.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );
    if (findProductsWithNoQuantityAvaliable.length) {
      throw new AppError(
        `A quantidade ${findProductsWithNoQuantityAvaliable[0].quantity} induficiente para ${findProductsWithNoQuantityAvaliable[0].id}`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existenProdutcs.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    });

    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        existenProdutcs.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));
    await this.productsRepository.updateQuantity(orderedProductsQuantity);
    return order;
  }
}

export default CreateOrderService;
