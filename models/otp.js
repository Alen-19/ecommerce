const mongoose = require('mongoose');
const otpSchemea = new mongoose.Schema({
    otp: {type: String, required: true},
    loginid : {type : mongoose.Schema.Types.ObjectId, ref : 'login'},
    createdAt: {type: Date, expires: '5m', default: Date.now} // OTP will expire after 5 minutes
});
const Otp = mongoose.model('Otp', otpSchemea);
module.exports = Otp;