const mongoose = require('mongoose');
const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // Category name
    description: { type: String, required: true }, // Category description
    image: { type: String, required: true }, // URL or path to the category
    createdAt: { type: Date, default: Date.now }, // Automatically set the creation time
    updatedAt: { type: Date, default: Date.now } // Automatically set the update
});
const Category = mongoose.model('Category', categorySchema); // Create the Category model
module.exports = Category; // Export the Category model for use in other parts of the application
