import {ObjectId} from "mongodb"

export type UserModel = {
    _id?: ObjectId,
    name: string,
    email: string,
    password: string
}

export type User = {
    id: string,
    name: string,
    email: string,
    password: string
}

export type ProductsModel = {
    _id?: ObjectId,
    name: string,
    description?: string,
    price: number,
    stock: number
}

export type Products = {
    id: string,
    name: string,
    description?: string,
    price: number,
    stock: number 
}

export type CartProductModel = {
    productId: ObjectId,
    quantity: number
}

export type CartProduct = {
    productId: string,
    cantidad: number
}

export type CartModel = {
    _id?: ObjectId,
    userId: ObjectId,
    products: CartProductModel[]
}

export type Cart = {
    id: string,
    userId: string,
    products: CartProduct[]
}

export type OrderProductModel = {
    productId: ObjectId,
    quantity: number,
    price: number
}

export type OrderProduct = {
    productId: string,
    cantidad: number,
    precio: number
}

export type ordersModel = {
    _id?: ObjectId,
    userId: ObjectId,
    products: OrderProductModel[],
    total: number,
    orderDate: Date
}

export type orders = {
    id: string,
    userId: string,
    products: OrderProduct[],
    total: number,
    orderDate: Date
}

export type arrayProduct = {
    productId: string,
    name: string,
    quantity: number,
    price: number
}

export type orderProduct = {
    userId: string,
    products: OrderProduct[],
    total: number,
    orderDate: Date
}