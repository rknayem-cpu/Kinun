const mongoose = require('mongoose')


const orderSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    
    cart: [{
        itemId: mongoose.Schema.Types.ObjectId,
        name: String,       // Store name
        price: Number,      // Store price
        quantity: Number,
        image: String       // Optional: store image URL
    }],
    
    total: Number,
    address: String,
    mobile: String,
    createdAt: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' }
});




module.exports = mongoose.model('Order', orderSchema);