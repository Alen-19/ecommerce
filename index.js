const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const mongoose = require('mongoose');
var useragent = require('express-useragent');
const adminrouter = require('./routes/v1/admin/admin');
const userRouter = require('./routes/v1/endusers/endusers');
let app = express();
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));
app.use('/images', express.static(path.join(__dirname, 'images')));
var port = 3333

app.use(bodyParser.urlencoded({
  extended: true, limit: '150mb'
}));
app.use(bodyParser.json({ limit: '150mb' }));
//PORT DECLARATION
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});
app.use(cors());
app.use(helmet({crossOriginResourcePolicy:false}));
app.use(useragent.express());
app.use((req, res, next) => {
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    console.log(fullUrl)
    next();
})


).then(() => {
    console.log('DATABASE CONNECTED SUCCESSFULLY');
}).catch((err) => {
    console.log('Error connecting to database');
    console.log(err);
});
app.use(adminrouter);
app.use(userRouter);
const server =  app.listen(port, function() {
  console.log('Server is running on port ' + port);
});
