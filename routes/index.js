const { render } = require('ejs');
let express = require('express');
let router = express.Router();
let conn = require('./connect');
let jwt = require('jsonwebtoken');
let secretCode = 'myEcom2022Key'; // สร้างรหัสลับ
let session = require('express-session');
let formidable = require('formidable');
let fs = require('fs');
let numeral = require('numeral');
let dayjs = require('dayjs');
const { parse } = require('path');
let dayFormat = 'DD/MM/YYYY'; // 1

router.use(session({
  secret: 'sessionEcom',
  resave: false,
  saveUninitialized:true,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 2000 // *สำคัญ* ให้ค่าอยู่ 1000วัน
  }
}))

router.use((req,res,next) => {
  res.locals.session = req.session;
  res.locals.numeral = numeral ; // ผูกกับตัวแปร locals เพื่อให้ ejs ไปใช้ได้
  res.locals.dayjs = dayjs;
  res.locals.dayFormat = dayFormat; // 2
  next();
});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});

router.post('/' , (req,res) => {
  let sql = 'INSERT INTO tb_user SET name =? ,usr = ? , pwd = ?';
  let params = [
    req.body['name'],
    req.body['usr'],
    req.body['pwd'],
  ]

  conn.query(sql , params ,( err, result) => {
    if (err) throw err;
    res.redirect('/');
  })
})

function isLogin(req,res,next) {
  if( req.session.token != undefined){
    next();
  } else{
    res.redirect('/login');
  }
}

router.get('/login' , (req,res) => {
  res.render('login');
})

router.post('/login' , (req,res) => {
  let sql = 'SELECT * FROM tb_user WHERE usr = ? AND pwd = ?';
  let params = [
    req.body['usr'],
    req.body['pwd']
  ]

  conn.query(sql , params , (err ,result) => {
    if (err) throw err;
   
    if (result.length > 0) {
       // login pass
       let id = result[0].id;
       let name = result[0].name;
       let token = jwt.sign({id: id , name: name},secretCode);
       
       req.session.token = token;
       req.session.name = name;

       res.redirect('/shop');
    } else {
      res.send('Invalid Username and Password please try again');
    }
  })
})

router.get('/shop' , (req,res) => {
  let sql = 'SELECT * FROM tb_product ORDER BY name DESC';
  conn.query(sql , (err ,result) => {
    if(req.session.cart == undefined){
      req.session.cart = [];
    }
    res.render('shop' , {product: result})
  })
})

router.get('/addCart/:id' , (req,res) => {
  let cart = [];
  let order = {
    product_id: req.params.id,
    qty: parseInt(1)
  }

  if(req.session.cart == null){
    cart.push(order)
  }
  else {
    let newItem = true ;
    cart = req.session.cart;

    for(let i = 0; i < cart.length ; i++){
      if(cart[i].product_id == req.params.id){
        cart[i].qty = cart[i].qty + 1 ;
        newItem = false;
      }
    }
    if(newItem){
      cart.push(order);
    }
  }
  cart = req.session.cart;
  res.redirect('/shop');
})

router.get('/myCart' , async (req,res) => {
  let conn = require('./connect2');
  let cart = req.session.cart;
  let products = [];
  let totalPrice = 0;
  let totalQty = 0;

  if(cart.length > 0){
    for(let i = 0 ; i < cart.length; i++){
      let c = cart[i];
      let sql = 'SELECT * FROM tb_product WHERE id = ?' ;
      let params = [c.product_id];

      let [rows , fields] = await conn.query(sql , params);
      let product = rows[0];

      let p = {
        qty: c.qty,
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        img: product.img,
        price: product.price
      }
    
      products.push(p)

      totalPrice += c.qty * product.price;
      totalQty += parseInt(c.qty);
    }
  }
  products.map(e => {
    console.log('Cart.session =>>>> : ' + e.qty);
  });
  cart = req.session.cart;
  res.render('myCart',{
    products: products,
    totalPrice: totalPrice,
    totalQty: totalQty
  })
})

router.get('/deleteItemInCart/:id' , (req,res) => {
  let cart = req.session.cart;

  for(let i = 0 ; i < cart.length ; i++){
    if(cart[i].product_id == req.params.id){
      cart.splice( i , 1 );
    }
  }
  cart = req.session.cart;
  res.redirect('/myCart');
})

router.get('/editItemInCart/:id' , (req,res) => {
  let sql = 'SELECT tb_product.* , tb_category.name AS category_name FROM tb_product LEFT JOIN tb_category ON tb_product.category_id = tb_category.id ORDER BY tb_product.id DESC';
  let params = req.params.id;

  conn.query(sql , params , (err ,result) => {
    if (err)  throw err;
    let product = result[0];
    let cart = req.session.cart;

    for(let i = 0 ; i < cart.length ; i++){
      if(cart[i].product_id == product.id){  // วนลูปอ่านค่า qty ที่เราเตรียมจะ post ไป
        product.qty = cart[i].qty;
      }
    }
    res.render('editItemInCart' , {product: product})
  })
})

router.post('/editItemInCart/:id' , (req,res) => {
  let cart = req.session.cart;

  for(let i = 0; i < cart.length; i++){
    if (cart[i].product_id == req.params.id){
      cart[i].qty = req.body['qty'];
    }
  }
  res.redirect('/myCart');
})

// Backe-end
function beLogin(req, res ,next){
  if (req.session.token != undefined){
    next()
  } else {
    res.redirect('/beLogin');
  }
}

router.get('/beLogin' , (req,res) => {
  res.render('beLogin');
})

router.post('/beLogin' , (req,res) => {
  let sql = 'SELECT * FROM tb_be_acc WHERE usr = ? AND pwd = ?';
  let params = [
    req.body['usr'],
    req.body['pwd']
  ];

  conn.query(sql , params , (err ,result) => {
    if (err) throw err;

    if (result.length > 0) {
      let id = result[0].id;
      let name = result[0].name;
      let token = jwt.sign({ id: id , name: name }, secretCode); 

      req.session.token = token;
      req.session.name = name;
      
      res.redirect('/home');
    } else {
      res.send('Not pass');
    
    }
  })
}) 

router.get('/beLogout', (req,res) => {
  req.session.destroy();
  res.redirect('/beLogin');
})

router.get('/home' , beLogin , (req,res) => {
  res.render('home');
})

router.get('/category' , beLogin , (req,res) => {
  let sql = 'SELECT * FROM tb_category ORDER BY id';
  conn.query(sql , (err , result) => {
    if(err) throw err;
    res.render('category', { categories: result});
  })
})

router.get('/addCategory', beLogin , (req,res) => {
  res.render('addCategory' , {category : {}});
})

router.post('/addCategory' , beLogin , (req,res) => {
  let sql = 'INSERT INTO tb_category SET ?';
  let params = req.body;

  conn.query(sql,params, (err,result) => {
    if (err) throw err;
    res.redirect('/category');
  })
})

router.get('/deleteCategory/:id' , beLogin , (req,res) => {
  let sql = 'DELETE FROM tb_category WHERE id =?';
  let params = req.params.id;

  conn.query(sql , params, (err,result) => {
    if (err)throw err;
    res.redirect('/category');
  })
})

router.get('/editCategory/:id', beLogin , (req,res) => {
  let sql = 'SELECT * FROM tb_category WHERE id = ?';
  let params = req.params.id;

  conn.query(sql, params, (err,result) => {
    if(err) throw err;
    res.render('editCategory', { categories: result[0] });
  })

})

router.post('/editCategory/:id' , beLogin , (req,res) => {
  let sql = ' UPDATE tb_category SET name = ? WHERE id = ?';
  let params = [
    req.body['name'],
    req.params.id
  ]

  conn.query(sql, params , (err ,result) => {
    if(err) throw err;
    res.redirect('/category');
  })
})

router.get('/product' , beLogin , (req,res) => {
  let sql = ' SELECT tb_product.* , tb_category.name AS category_name FROM tb_product'; // เลือกตารางสินค้าทั้งหมด กับ ชื่อของตารางหมวดหมู่ จาก ตารางซ้าย left join ตารางขวา
  sql += ' LEFT JOIN tb_category ON tb_product.category_id = tb_category.id'; // เงื่อนไข ไอดีหมวดหมู่ต้องเท่ากัน
  sql += ' ORDER BY tb_product.id DESC'; //เรียงตาม id 

  conn.query(sql , (err,result) => {
    if (err) throw err;
    console.log(result)
    res.render('product' ,{ product: result});
  })
})

router.get('/addProduct' , beLogin , (req,res) =>{
  let sql = 'SELECT * FROM tb_category ORDER BY name DESC'; // ดึง tb หมวดหมู่สินค้ามาใส่ใน select ประเภทสินค้า
  conn.query(sql, (err,result) => {
    if(err) throw err;
    res.render('addProduct', {product: {} , categories: result});
  })
})

router.post('/addProduct' , beLogin , (req,res) => {
  let form = new formidable.IncomingForm();

  form.parse(req , (err , fields , file) => {
    let filePath = file.img.filepath;
    let newPath = 'C:/Users/Win10_2020/Desktop/Third Project/My E-commerce/app/public/images/';
    newPath += file.img.originalFilename;

    fs.copyFile(filePath , newPath , () => {
      //Insert in database
      let sql = 'INSERT INTO tb_product(category_id,name,barcode,cost,price,img) VALUES(?,?,?,?,?,?)';
      let params = [
        fields['category_id'],
        fields['name'],
        fields['barcode'],
        fields['cost'],
        fields['price'],
        file.img.originalFilename
      ]
      conn.query(sql,params,(err,result) => {
        if(err)throw err;
        res.redirect('/product');
      })
    })
  }) 
  }
)

router.get('/editProduct/:id' , beLogin , (req,res) => {
  let sql = 'SELECT * FROM tb_product WHERE id =?';
  let params = req.params.id;

  conn.query(sql , params , (err , ReSt) => {
    if (err) throw err;

    sql = ' SELECT * FROM tb_category ORDER BY name DESC';
    conn.query(sql , (err ,categories) => {
      if (err) throw err;
      console.log(ReSt)
        res.render('editProduct', {product: ReSt[0] , categories: categories});
    })
  })
})

router.post('/editProduct/:id' , beLogin , (req,res) => {
  let form = new formidable.IncomingForm();
  form.parse(req, (err , fields ,file )=> {
    let filePath = file.img.filepath;
    let newPath = 'C:/Users/Win10_2020/Desktop/Third Project/My E-commerce/app/public/images/';
    let pathUpload = newPath + file.img.originalFilename;

    fs.copyFile(filePath , pathUpload , () => {
      let sqlSelect = 'SELECT img FROM tb_product WHERE id =?';
      let paramsSelect = req.params.id;

      conn.query(sqlSelect , paramsSelect , (err , oldProduct) => {
        if (err) throw err;
        let product = oldProduct[0];
        fs.unlink(newPath + product.img , (err) => {
          if (err) {console.log(err)};


          let sql = 'UPDATE tb_product SET category_id = ? , name = ? , barcode = ? , cost = ? ,price = ? ,img = ? WHERE id =?';
          let params = [
            fields['category_id'],
            fields['name'],
            fields['barcode'],
            fields['cost'],
            fields['price'],
            file.img.originalFilename,
            req.params.id
          ];

          conn.query(sql , params , (err , result) => {
            if (err) throw err;
            res.redirect('/product');
          })
        })
      })
    })
  })
})

router.get('/deleteProduct/:id/:img' , beLogin ,(req,res) => {
  let newPath = 'C://Users/Win10_2020/Desktop/Third Project/My E-commerce/app/public/images/';
    newPath += req.params.img;

  fs.unlink(newPath , (err) => { //2.ลบไฟล์ภาพจากฐานข้อมูล
    if (err) throw err;
      
      let sql = ' DELETE FROM tb_product WHERE id = ?';
      let params = req.params.id;

  conn.query(sql , params ,(err,result) => {
      if (err) throw err;
        res.redirect('/product');
        })
    })
})


module.exports = router;
