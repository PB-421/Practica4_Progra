import { MongoClient, ObjectId} from "mongodb";
import { UserModel,ProductsModel,ordersModel,CartModel} from "./Types.ts";
import { fromModelToProduct, fromModelToUser, productOnCart, productOnOrder, fromModelToCart, productOnUserCart,fromCartToOrder,fromModelToOrder, fromProductNtoproductGet, fromOrderNtoOrderGet } from "./Utils.ts";

const MONGO_URL=Deno.env.get("MONGO_URL")
if(!MONGO_URL){
  console.error("MONGO_URL is not set");
  Deno.exit(1);
}

const cliente= new MongoClient(MONGO_URL)
await cliente.connect();
const db =cliente.db("practica4")
const userscollection=db.collection<UserModel>("Users")
const productscollection=db.collection<ProductsModel>("Products")
const orderscollection=db.collection<ordersModel>("Orders")
const cartscollection=db.collection<CartModel>("Carts")

const handler=async(req:Request):Promise<Response>=>{
  const url=new URL(req.url);
  const metodo=req.method;
  const path=url.pathname;

  if(metodo==="POST"){
    if(path=="/users"){
      const user=await req.json()
      if(!user.name||!user.email||!user.password){
        return new Response("Bad request",{status:400})
      }
      const email=await userscollection.find({email:user.email}).toArray()
      console.log(email)
      if(email.length !== 0){
        return new Response("Email already exists")
      }
      const {insertedId} = await userscollection.insertOne({
        name: user.name,
        email: user.email,
        password: user.password
      })
      return new Response(JSON.stringify({
        id: insertedId,
        name: user.name,
        email: user.email
      }))
    }
    if(path=="/products"){
      if(!req.body) return new Response("Bad Request",{status: 400})
      const payload=await req.json()
      if(!payload.name||!payload.price||!payload.stock){
        return new Response("Bad request",{status:400})
      }
        const {insertedId} = await productscollection.insertOne({
          name: payload.name,
          description: payload.description,
          price: payload.price,
          stock: payload.stock
        })
        return new Response(JSON.stringify({
          id: insertedId,
          name: payload.name,
          description: payload.description,
          price: payload.price,
          stock: payload.stock
        }))
    }
    if(path=="/carts/products"){
      const id=url.searchParams.get("userId")
      if(!req.body) return new Response("Bad request",{status:400})
      const payload=await req.json()
        if(!payload.productId||!payload.quantity){
          return new Response("Bad request",{status:400})
        }
      if(!id){
        return new Response("ID not detected",{status:400})
      }
      if(!ObjectId.isValid(id)){
        return new Response("Id not valid",{status:400})
      }
      if(!await userscollection.findOne({_id: new ObjectId(id)})){
        return new Response("User not found",{status:404})
      }
      let idc=await cartscollection.findOne({userId:new ObjectId(id)})
      if(!idc){
        console.log("Carrito nuevo creado")
        const {insertedId}=await cartscollection.insertOne({
          userId: new ObjectId(id),
          products: []
        })
        idc = await cartscollection.findOne({_id:insertedId})
      }
        if(!ObjectId.isValid(id)){
          return new Response("Product Id not valid",{status:400})
        }
        const pm=await productscollection.findOne({_id: new ObjectId(payload.productId)})
        if(!pm){
          return new Response("Product not found",{status:404})
        } else if(pm.stock <= 0){
          return new Response("There is no stock of this product",{status:404})
        }

        if(!await productOnUserCart(id,payload.productId,cartscollection)){
          await cartscollection.updateOne(
            {userId:new ObjectId(id)},
            {$push:{products:{productId: new ObjectId(payload.productId), quantity: payload.quantity}}}
          )
          return new Response(JSON.stringify({
            userId: id,
            products: [{
              productId: new ObjectId(payload.productId),
              name: pm.name,
              quantity: payload.quantity,
              price: pm.price * payload.quantity
          }]
          }))
        }
        else{
          await cartscollection.updateOne(
            {userId:new ObjectId(id),"products.productId": new ObjectId(payload.productId)},
            {$inc:{ "products.$.quantity": payload.quantity}}//incrementa un valor ya existente
          )
          const carro = await cartscollection.findOne({userId:new ObjectId(id)})
          let cantidad = 0
          if(carro){
            const productsF = carro.products
            const cantidadA = productsF.map((elem) => elem.quantity)
            cantidad = cantidadA[0]
          }
          return new Response(JSON.stringify({
            userId: pm._id.toString(),
            products: [{
              productId: new ObjectId(payload.productId),
              name: pm.name,
              quantity: cantidad,
              price: pm.price * cantidad
          }]
          }))
        }
    }
    if(path === "/orders"){
      const id=url.searchParams.get("userId")
      if(!id){
        return new Response("Bad request",{status:400})
      }
      if(!ObjectId.isValid(id)){
        return new Response("Id not valid",{status:400})
      }
      if(! await userscollection.findOne({_id: new ObjectId(id)})){
        return new Response("User not found",{status:404})
      }
      const CarroUsuario=await cartscollection.findOne({userId:new ObjectId(id)})
      if(!CarroUsuario){
        return new Response("This user doesnt have any cart",{status:404})
      } else if(CarroUsuario.products.length === 0){
        return new Response("User cart is empty")
      }
      const introducido = await fromCartToOrder(CarroUsuario,productscollection,orderscollection)
      if(introducido){
      return new Response(JSON.stringify({
        orderId: introducido._id,
        userId: introducido.userId,
        products: introducido.products,
        total: introducido.total,
        orderDate: introducido.orderDate
      }))
      } else {
        return new Response("There is no stock of any of your current cart products")
      }
    }
    return new Response("path not found",{status:404})
  }
  if(metodo==="GET"){
    if(path=="/users"){
      const users=await userscollection.find().toArray()
      const userM=users.map((u)=>fromModelToUser(u))
      const userF = userM.map(({password,...rest}) => rest)
      return new Response(JSON.stringify(userF))
      
    }
    if(path=="/products"){
      const products= await productscollection.find().toArray()
      const p=products.map((p)=>fromModelToProduct(p))
      return new Response(JSON.stringify(p))
    }
    if(path=="/carts"){
      const id=url.searchParams.get("userId")
      if(!id){
        return new Response("Bad request",{status:400})
      }
      if(!ObjectId.isValid(id)){
        return new Response("ID not valid",{status:404})
      }
      if(!await userscollection.findOne({_id: new ObjectId(id)})){
        return new Response("User not found",{status:404})
      }
      const cartdb=await cartscollection.findOne({userId:new ObjectId(id)})
      if(!cartdb){
        return new Response("This user doesn't have any cart ",{status:404})
      }
      const cart= fromModelToCart(cartdb)

      return new Response(JSON.stringify({
        userId: cart.userId,
        products: await fromProductNtoproductGet(cart.products,productscollection)
      }))

    }
    if(path=="/orders"){
      const id=url.searchParams.get("userId")
      if(!id){
        return new Response("Bad request",{status:400})
      }
      if(!ObjectId.isValid(id)){
        return new Response("ID not valid",{status:404})
      }
      const orderdb=await orderscollection.find({userId:new ObjectId(id)}).toArray()
      if(orderdb.length === 0){
        return new Response("This user doesn't have any orders ",{status:404})
      }
      const order=orderdb.map((elem) => fromModelToOrder(elem))
      return new Response(JSON.stringify(fromOrderNtoOrderGet(order)))
    }
    return new Response("path not found",{status:404})
  }
  if(metodo==="PUT"){
    if(path.startsWith("/products/")){
      const ruta=path.split('/')
      const id = ruta[ruta.length-1].replaceAll("%20", " ")
      if(!id){
        return new Response("ID not detected",{status:404})
      }
      if(id.length !== 24){
        return new Response("ID not valid",{status:404})
      }
      if(!req.body){
        return new Response("Bad request",{status:400})
      }
      let prodaux= await productscollection.findOne({_id:new ObjectId(id)})

      if(!prodaux){
        return new Response("Product not found",{status:404})
      }
      const body=await req.json()
      const set = {
        name: body.name ?? prodaux.name, 
        description: body.description ?? prodaux.description,
        price:body.price ?? prodaux.price,
        stock:body.stock ?? prodaux.stock
      }

      
      const{modifiedCount}=await productscollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: set }
      )
      if(modifiedCount===0){
        return new Response("product not found",{status:404})
      }
      prodaux = await productscollection.findOne({_id:new ObjectId(id)})
      if(prodaux){
      return new Response(JSON.stringify({
        id: new ObjectId(id),
        name: prodaux.name,
        description: prodaux.description,
        price: prodaux.price,
        stock: prodaux.stock
      }));
      }
    }
    return new Response("path not found",{status:404})
  }
  if(metodo ==="DELETE"){
    if(path.startsWith("/products/")){
      const ruta=path.split('/')
      const id = ruta[ruta.length-1].replaceAll("%20", " ")
      if(!id){
        return new Response("ID not detected",{status:404})
      }
      if (!ObjectId.isValid(id)) {
        return new Response("Invalid product ID", {status: 400});
      }
      if(!await productscollection.findOne({_id:new ObjectId(id)})){
        return new Response("Product not found",{status:404})
      }
      const comprCart = await productOnCart(id,cartscollection)
      if(comprCart){
        return new Response("Product located in one or more carts, cant delete",{status:404})
      }
      const comprOrder = await productOnOrder(id,orderscollection)
      if(comprOrder){
        return new Response("Product located in one or more orders, cant delete",{status:404})
      }

      await productscollection.deleteOne({_id: new ObjectId(id)})

      return new Response("Product deleted")

    }
    else if(path === "/carts/products"){
      const userIDSp = url.searchParams.get("userId")
      const productIdSp = url.searchParams.get("productId")
      if(userIDSp && productIdSp){
        if(!ObjectId.isValid(userIDSp)) {
          return new Response("Invalid user ID", {status: 400});
        }
        if(!ObjectId.isValid(productIdSp)) {
          return new Response("Invalid product ID", {status: 400});
        }
        if(!await userscollection.findOne({_id:new ObjectId(userIDSp)})){
          return new Response("User not found",{status:404})
        }
        if(!await productscollection.findOne({_id:new ObjectId(productIdSp)})){
          return new Response("Product not found",{status:404})
        }

        const cartdb=await cartscollection.findOne({userId:new ObjectId(userIDSp)})
        if(!cartdb){
        return new Response("This user doesn't have any cart ",{status:404})
        }

        if(!await productOnUserCart(userIDSp,productIdSp,cartscollection)){
        return new Response("This product doesnt exist on this users cart ",{status:404})
        }

        await cartscollection.updateOne({userId: new ObjectId(userIDSp)},
          {$pull: {products: {productId: new ObjectId(productIdSp)}}}
        )

        return new Response("Product deleted from cart")
      }
      return new Response("Insufficent params",{status: 400})
    }
    else if(path === "/carts"){
      const userIDSp = url.searchParams.get("userId")
      if(userIDSp){
        if(!ObjectId.isValid(userIDSp)) {
          return new Response("Invalid user ID", {status: 400});
        }
        if(!await userscollection.findOne({_id:new ObjectId(userIDSp)})){
          return new Response("User not found",{status:404})
        }
        const cartdb=await cartscollection.findOne({userId:new ObjectId(userIDSp)})
        if(!cartdb){
        return new Response("This user doesn't have any cart ",{status:404})
        }

        if(cartdb.products.length === 0){
          return new Response("Cart is already empty",{status:404})
        }
        await cartscollection.updateOne({userId: new ObjectId(userIDSp)},
          {$set: {products: []}}
        )
        return new Response("Products deleted from cart")
      }
    }
    return new Response("path not found",{status:404})
  }
  return new Response("method not found",{status:404})
}
Deno.serve({port:3000},handler)