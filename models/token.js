const mongoose = require('mongoose');
const tokenschema = new mongoose.Schema(
    {
    loginid : {type : mongoose.Schema.Types.ObjectId, ref : 'login'},// collection name same in the login.js and type means referncing an underscore id  
    token : { type: String }, // token will expire in 1 day
    
}
);
const token = mongoose.model('Token',tokenschema);
module.exports = token ;