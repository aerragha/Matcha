var mysql = require('mysql');

var cn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'tiger',
    database: 'Matcha'
});

cn.connect(function (err) {
    if (!err) {
        console.log("Database is connected");
    } else {
        console.log("Error while connecting with database");
    }
});
module.exports = cn;
//module.exports is an object that will be returned as the result of a require function call.