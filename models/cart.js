const mongoose = require('mongoose');
const cartSchema = new mongoose.Schema({
    enduserid: { type: mongoose.Schema.Types.ObjectId, ref: 'login', required: true }, // Reference to the end user
    products: [
        {
            productid: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // Reference to the product
            quantity: { type: Number, required: true, min: 1 } // Quantity of the product in the cart
        }
    ],
    createdAt: { type: Date, default: Date.now }, // Automatically set the creation time
    updatedAt: { type: Date, default: Date.now } // Automatically set the update time
});
const Cart = mongoose.model('Cart', cartSchema); // Create the Cart model
module.exports = Cart; // Export the Cart model for use in other parts of the application