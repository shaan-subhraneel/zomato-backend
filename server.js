//api for ZOMATO
//code by Subhraneel Chowdhury

let express = require('express');
let app = express();
let bodyParser = require('body-parser');
let cors = require('cors')
let dotenv = require('dotenv');
dotenv.config()
let port = process.env.PORT || 9870;
let mongo = require('mongodb');
let mongoClient = mongo.MongoClient;
let mongoUrl = process.env.MongoLiveUrl;
let db;
let jwt = require('jsonwebtoken');
let bcrypt = require('bcrypt');
let config = require('./config');

//Connection with db
mongoClient.connect(mongoUrl,(err,client) => {
  if(err) console.log(`Error While Connecting`);
  db = client.db("zomato");
  app.listen(port,(err) => {
    if(err) throw err;
    console.log(`Express Server listening on port ${port}`)
  })
})

app.use(bodyParser.urlencoded({extended:true}))
app.use(bodyParser.json())
app.use(cors())

app.get('/',(req,res) => {
    res.send('Express Server default')
})

app.get('/users',(req,res) => {
  db.collection('users').find().toArray((err,result) => {
      if(err) throw err;
      res.send(result)
    })
})

//register User
app.post('/register', (req,res) => {
  const hashPassword =  bcrypt.hashSync(req.body.password, 8)
  db.collection('users').insertOne({
      name:req.body.name,
      email:req.body.email,
      password:hashPassword,
      phone:req.body.phone,
      role:req.body.role?req.body.role:'User'
  },(err,data) => {
      if(err) return res.status(500).send('Error While Register');
      res.status(200).send('Registeration Succesful')
  })
})

///login Users
app.post('/login',(req,res) => {
  db.collection('users').findOne({email:req.body.email},(err,user) => {
      if(err) return res.send({auth:false,token:'Error While Login'})
      if(!user) return res.send({auth:false,token:'No User Found Register First'})
      else{
          const passIsValid = bcrypt.compareSync(req.body.password,user.password)
          if(!passIsValid) return res.send({auth:false,token:'Invalid Password'})
          // in case email and password both good than generate token
          let token = jwt.sign({id:user._id},config.secret,{expiresIn:86400}) // 24 hours
          return res.send({auth:true,token:token})
      }
  })
})

//userinfo
app.get('/userInfo',(req,res) => {
  let token = req.headers['x-access-token'];
  if(!token) res.send({auth:false,token:'No Token Provided'})
  // jwt verify token
  jwt.verify(token,config.secret,(err,user) => {
      if(err) return res.send({auth:false,token:'Invalid Token'})
      db.collection('users').findOne({"_id":user.id},(err,result) => {
        res.send(user._id)
    })

  })
})

app.get('/items/:collections',(req,res) => {
  db.collection(req.params.collections).find().toArray((err,result) => {
    if(err) throw err;
    res.send(result)
  })
})

app.get('/location',(req,res) => {
    db.collection('location').find().toArray((err,result) => {
      if(err) throw err;
      res.send(result)
    })
})

app.get('/mealType',(req,res) => {
    db.collection('mealType').find().toArray((err,result) => {
      if(err) throw err;
      res.send(result)
    })
})

app.get('/restaurants',(req,res) => {
  let stateId = Number(req.query.stateId)
  let mealId = Number(req.query.mealId)
  let query = {}
  if(stateId && mealId){
    query = {state_id:stateId,'mealTypes.mealtype_id':mealId}
  }
  else if(stateId){
    query = {state_id:stateId}
  }else if(mealId){
    query = {'mealTypes.mealtype_id':mealId}
  }
  db.collection('restaurants').find(query).toArray((err,result) => {
    if(err) throw err;
    res.send(result)
  })
})

app.get(`/filter/:mealId`,(req,res) => {
  let sort = {cost:1}
  let mealId = Number(req.params.mealId)
  let cuisineId = Number(req.query.cuisineId)
  let lcost = Number(req.query.lcost)
  let hcost = Number(req.query.hcost)
  let query = {}
  if(req.query.sort){
    sort={cost:req.query.sort}
  }

  if(lcost && hcost && cuisineId){
    query={
      "mealTypes.mealtype_id":mealId,
      $and:[{cost:{$gt:lcost,$lt:hcost}}],
      "cuisines.cuisine_id":cuisineId
    }
  }
  else if(lcost && hcost){
    query={
      "mealTypes.mealtype_id":mealId,
      $and:[{cost:{$gt:lcost,$lt:hcost}}]
    }
  }
  else if(cuisineId){
    query={
      "mealTypes.mealtype_id":mealId,
      "cuisines.cuisine_id":cuisineId
    }
  }else{
    query={
      "mealTypes.mealtype_id":mealId
    }
  }
  db.collection('restaurants').find(query).sort(sort).toArray((err,result) => {
    if(err) throw err;
    res.send(result)
  })
})

app.get('/details/:id',(req,res) => {
  let id = Number(req.params.id)
  db.collection('restaurants').find({restaurant_id:id}).toArray((err,result) => {
    if(err) throw err;
    res.send(result)
  })
})

app.get('/menu/:id',(req,res) => {
  let id = Number(req.params.id)
  db.collection('menu').find({restaurant_id:id}).toArray((err,result) => {
    if(err) throw err;
    res.send(result)
  })
})

app.get('/orders',(req,res) => {
  let email = req.query.email;
  let query = {}
  if(email){
    //query = {email:email}
    query = {email}
  }
  db.collection('orders').find(query).toArray((err,result) => {
    if(err) throw err;
    res.send(result)
  })
})

app.post('/menuItem',(req,res) => {
  if(Array.isArray(req.body)){
    db.collection('menu').find({menu_id:{$in:req.body}}).toArray((err,result) => {
      if(err) throw err;
      res.send(result)
    })
  }else{
    res.send('Invalid Input')
  }
})

app.post('/placeOrder',(req,res) => {
  console.log(req.body)
  db.collection('orders').insert(req.body,(err,result) => {
    if(err) throw err;
    res.send(result)
  })
})

app.put('/updateOrder/:id',(req,res) => {
    let oid = Number(req.params.id);
    db.collection('orders').updateOne(
      {id:oid},
      {
        $set:{
          "status":req.body.status,
          "bank_name":req.body.bank_name,
          "date":req.body.date
        }
      },(err,result) => {
        if(err) throw err;
        res.send('Order Updated')
      }
    )
})

app.delete('/deleteOrder/:id',(req,res) => {
    let oid =  mongo.ObjectId(req.params.id)
    db.collection('orders').remove({_id:oid},(err,result) => {
      if(err) throw err;
      res.send('Order Deleted')
    })
})