const Koa = require('koa')
const app = new Koa()
const Router = require('koa-router')

let router = new Router()

router.post('/test',async ( ctx )=>{
  ctx.body = {
    "code": 0,
    "msg": "success",
    "data": {
      "id": 1,
      "name": "张三",
      "age": 20,
      "sex": "男",
      "address": "北京市海淀区",
      "phone": "13800138000",
  }}
})


app.use(router.routes()).use(router.allowedMethods())


app.listen(3000)
console.log('[demo] start-quick is starting at port 3000')