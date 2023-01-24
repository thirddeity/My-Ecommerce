let mysql = require('mysql');
let conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'db_third_e-commerce'
})
  
conn.connect((err) => {
    if (err) throw err;
    console.log('Connect to Database SUCCESS');
})

module.exports = conn; //exports เพื่อให้ไฟล์อื่นเรียกใช้ได้