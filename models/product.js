const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    description: String,
    catid : { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }, // Reference to Category model
    image: String,
    stock: Number
});   

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
