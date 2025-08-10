const mongoose = require('mongoose');
const loginschema = new mongoose.Schema(
    {
        email : {type:String},
        password : {type:String},
        role : {type:String, enum:['admin','enduser']}, //only 2 roles are allowed such as admin , enduser
        status : {type : Boolean, default : true}, // by default status is false
        name : {type : String},
        phone : {type:Number},
        isverified : {type : Boolean, default : false}, // by default isverified is false
    }
)
const login = mongoose.model('login', loginschema); // login should be the name of the collection in atlas
module.exports = { login }; //we can simply give as login also
