import { Collection, ObjectId } from "mongodb";
import { arrayProduct, Cart, CartModel, CartProduct, CartProductModel, orderProduct, OrderProduct, OrderProductModel, orders, ordersModel, Products, ProductsModel, User, UserModel } from "./Types.ts";

export function fromModelToUser(userOG:UserModel):User {
    return {
        id: userOG._id!.toString(),
        name: userOG.name,
        email: userOG.email,
        password: userOG.password
    }
}

export function fromModelToProduct(productOG:ProductsModel):Products {
    return {
        id: productOG._id!.toString(),
        name: productOG.name,
        description: productOG.description,
        price: productOG.price,
        stock: productOG.stock
    }
}

export function fromModelToCartProducts(CartProductOG:CartProductModel):CartProduct {
    return {
        productId: CartProductOG.productId.toString(),
        cantidad: CartProductOG.quantity
    }
}

export function fromModelToCart(CartOG:CartModel):Cart {
    return {
        id: CartOG._id!.toString(),
        userId: CartOG.userId.toString(),
        products: CartOG.products.map((elem:CartProductModel) => fromModelToCartProducts(elem))
    }
}

export function fromModelToOrderProduct(OrderProductOG:OrderProductModel):OrderProduct {
    return {
        productId: OrderProductOG.productId.toString(),
        cantidad: OrderProductOG.quantity,
        precio: OrderProductOG.price
    }
}

export function fromModelToOrder(OrderOG:ordersModel):orders {
    return {
        id: OrderOG._id!.toString(),
        userId: OrderOG.userId.toString(),
        products: OrderOG.products.map((elem:OrderProductModel) => fromModelToOrderProduct(elem)),
        total: OrderOG.total,
        orderDate: OrderOG.orderDate
    }
}

function examinarProductos(carro:CartProductModel[] | OrderProductModel[],id:string):boolean {
    const existen = carro.some((elem) => elem.productId.toString() === id)
    return existen
}

export async function productOnOrder(id:string,ListaPedidos:Collection<ordersModel>):Promise<boolean> {
    const Lista:ordersModel[] = await ListaPedidos.find().toArray()
    let existen = false
    for (const elem of Lista) {
        existen = examinarProductos(elem.products, id);
        if (existen) {
            break;
        }
    }
    return existen
}

export async function productOnCart(id:string,ListaCarros:Collection<CartModel>):Promise<boolean> {

    const Lista:CartModel[] = await ListaCarros.find().toArray()
    let existen = false
    for (const elem of Lista) {
        existen = examinarProductos(elem.products, id);
        if (existen) {
            break;
        }
    }
    return existen
}

export async function productOnUserCart(idU: string,idP: string, ListaCarros:Collection<CartModel>):Promise<boolean> {
    const CarroUsuario:CartModel | null = await ListaCarros.findOne({userId: new ObjectId(idU)})
    let existen = false
    if(CarroUsuario){
    const productos:CartProductModel[] = CarroUsuario.products
    existen = examinarProductos(productos,idP)
    }
    return existen
}

export async function updateStock(id: ObjectId,quantity: number,listaProductosBD:Collection<ProductsModel>):Promise<number> {
    const prodActual = await listaProductosBD.findOne({ _id: id });
    if(prodActual){
    let nuevoStock = prodActual.stock - quantity
    let stockFaltante = 0
    if(nuevoStock < 0){
        stockFaltante = nuevoStock
        nuevoStock = 0
    }
    await listaProductosBD.updateOne({_id: id},
    {$set: {stock: nuevoStock}}
    )
    return quantity + stockFaltante
    }
    return 0
}

export async function fromCartProductstoOrderProduct(productos:CartProductModel[],listaProductosBD:Collection<ProductsModel>):Promise<OrderProductModel[]> {
    const  nuevalistaProductos:OrderProductModel[] = []
    let i = 0
    for (const elem of productos) {

        const prodActual = await listaProductosBD.findOne({ _id: elem.productId });
        if (prodActual) {
            if(prodActual.stock <= 0){
                continue
            }
            const cantidad = await updateStock(elem.productId,elem.quantity,listaProductosBD)
            nuevalistaProductos[i] = {
                productId: elem.productId,
                quantity: cantidad,
                price: prodActual.price * cantidad
            };
        }
        i++;
    }
    return nuevalistaProductos
}

export async function fromCartToOrder(Cart:CartModel,listaProductosBD:Collection<ProductsModel>,ListaPedidos:Collection<ordersModel>):Promise<ordersModel | null> {
    const productos = await fromCartProductstoOrderProduct(Cart.products,listaProductosBD)
    if(productos){
        if(productos.length !== 0){
    const prices:number[] = productos.map((elem) => elem.price)
    const {insertedId} = await ListaPedidos.insertOne({
        userId: Cart.userId,
        products: productos,
        total: prices.reduce((acc,elem) => elem + acc,0),
        orderDate:  new Date()
    })

    return{
        _id: insertedId,
        userId: Cart.userId,
        products: productos,
        total: prices.reduce((acc,elem) => elem + acc,0),
        orderDate: new Date()
    }
    }
    return null
    }
    return null
}

export async function fromProductNtoproductGet(productos:CartProduct[],lista:Collection<ProductsModel>):Promise<arrayProduct[]> {
    const array:arrayProduct[] = []
    let i = 0
    for(const elem of productos){
        const productoEsp = await lista.findOne({_id: new ObjectId(elem.productId)})
        if(productoEsp){
            const annadir:arrayProduct = {
                productId: elem.productId,
                name: productoEsp.name,
                quantity: elem.cantidad,
                price: productoEsp.price * elem.cantidad
            } 
            array[i] = annadir
        }
        i++;
    }
    return array
}

export function fromOrderNtoOrderGet(pedidos:orders[]):orderProduct[] {
    const array:orderProduct[] = []
    let i = 0
    for(const elem of pedidos){

            const annadir:orderProduct = {
                userId: elem.userId,
                products: elem.products,
                total: elem.total,
                orderDate: elem.orderDate
            } 
            array[i] = annadir
            i++;
        }
    return array
}
