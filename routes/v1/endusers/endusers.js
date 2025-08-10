const express = require('express');
const router = express.Router();
const jsonwebtoken = require('jsonwebtoken');
const bcryptjs = require('bcryptjs'); // used for password encyption
const { login } = require('../../../models/login');
const { isUser } = require('../../../controls/middleware');
const emailhelper = require('../../../controls/email'); // importing email control
const Otp = require('../../../models/otp');
const token = require('../../../models/token'); // importing token control
const PdfPrinter = require('pdfmake');
const Product = require('../../../models/product');
const Category = require('../../../models/category');
const Cart = require('../../../models/cart');
const Order = require('../../../models/orders');
const fs = require('fs');
const path = require('path');

function validateEmail(email) {
    const emailRegex = /^(?=[^@]*[a-zA-Z]{3,})[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/;
    return emailRegex.test(email);
}

router.post('/v1/endusers/register', async (request, response) => {
    try {        
        const { name, email, password, phone, role } = request.body;

        // Restrict to only enduser role
        if (role !== 'enduser') {
            return response.status(400).json({
                message: 'Role must be enduser'
            });
        }

        // Validate required fields
        if (!email || !password || !name || !phone || !role) {
            return response.status(400).json({
                message: 'Please fill all the fields'
            });
        }

        if (!validateEmail(email)) {
            return response.status(400).json({
                status: false,
                message: 'Please enter a valid email address'
            });
        }

        if (!/^[a-zA-Z\s]{2,50}$/.test(name)) {
            return response.status(400).json({
                status: false,
                message: 'Name should be 2-50 characters long and contain only letters and spaces'
            });
        }
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/.test(password)) {
            return response.status(400).json({
                status: false,
                message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character'
            });
        }
        if (!/^[6-9]\d{9}$/.test(phone)) {
            return response.status(400).json({
                status: false,
                message: 'Please enter a valid 10-digit mobile number starting with 6-9'
            });
        }

        // Check for duplicate email
        const existingUser = await login.findOne({ email: email });
        if (existingUser) {
            return response.status(400).json({
                message: 'User already exists with this email'
            });
        }

        // Check for duplicate phone
        const existingPhone = await login.findOne({ phone: phone });
        if (existingPhone) {
            return response.status(400).json({
                message: 'User already exists with this phone number'
            });
        }

        const hashedpassword = await bcryptjs.hash(password, 10);
        const newuser = new login({
            name: name,
            password: hashedpassword,
            email: email,
            phone: phone,
            role: role
        });
        await newuser.save();

        const otp = Math.floor(100000 + Math.random() * 900000);
        const otpHtml = `
            <div style="font-family: Arial, sans-serif; color: #222;">
                <h2 style="color: #2874f0;">OTP Verification</h2>
                <p>Dear ${name},</p>
                <p>Your OTP is: <b>${otp}</b></p>
                <p>This OTP is valid for 10 minutes.</p>
            </div>
        `;
        const result = await emailhelper.sendEmail(email, 'Otp Verification', otpHtml);
        const newotp = new Otp({
            loginid: newuser._id,
            otp: otp,
        });
        await newotp.save();
        return response.status(200).json({ status: true, message: 'Email sent successfully', result: result });
    } catch (error) {
        console.log(error);
        response.status(500).json({
            status: false,
            message: "Internal Server Error"
        });  
    }
});

router.post('/v1/endusers/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ status: false, message: 'Email is required' });
        }
        const user = await login.findOne({ email: email, role: 'enduser' });
        if (!user) {
            return res.status(404).json({ status: false, message: 'User not found' });
        }
        if (user.isverified) {
            return res.status(400).json({ status: false, message: 'Account already verified' });
        }

        // Remove any old OTPs for this user
        await Otp.deleteMany({ loginid: user._id });

        // Generate and send new OTP
        const otp = Math.floor(100000 + Math.random() * 900000);
        const otpHtml = `
            <div style="font-family: Arial, sans-serif; color: #222;">
                <h2 style="color: #2874f0;">OTP Verification</h2>
                <p>Dear ${user.name},</p>
                <p>Your new OTP is: <b>${otp}</b></p>
                <p>This OTP is valid for 5 minutes.</p>
            </div>
        `;
        await emailhelper.sendEmail(email, 'Otp Verification', otpHtml);
        const newOtp = new Otp({
            loginid: user._id,
            otp: otp,
        });
        await newOtp.save();

        return res.status(200).json({ status: true, message: 'OTP resent successfully' });
    } catch (error) {
        console.error('Error resending OTP:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.post('/v1/endusers/login', async (request,response) =>
    {
        try {
            const { email, password } = request.body
                    if (!validateEmail(email)) {
                        return response.status(400).json({
                            status: false,
                            message: 'Please enter a valid email address'
                        });
                    }  
            const user = await login.findOne({ email: email });
            if(!email || !password) {
                return response.status(400).json({ message: 'Please fill all the fields' });
            }
            
            if (!user) {
                return response.status(404).json({ message: 'Invalid email' });
            }

            if (!user.status) {
            return response.status(403).json({ 
                status: false,
                message: 'Your account has been deactivated. Please contact administrator.' 
            });
            }
                const isMatch = await bcryptjs.compare(password, user.password);
                if (!isMatch) 
                    {
                        return response.status(401).json({ message: 'Invalid password' });
                    }
                if (user.isverified == false) {
                        return response.status(401).json({ status: false, message: 'Please verify your email first' });
                    }
                   const payload = {
                               id: user._id,
                               email: user.email,
                               role: user.role
                           };
                   
                           const tokenval2 = jsonwebtoken.sign(payload, 'hehe123', { expiresIn: '1h' });
                           const newToken = new token({
                               loginid: user._id,
                               token: tokenval2
                           });
                           await newToken.save();

        return response.status(200).json({
            status: true,
            message: 'Login successful',
            tokenval2,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
                    }
                    catch (error) {
                        console.error('Error during login:', error);
                        return response.status(500).json(
                            {
                                status : false,
                                message : "Internal Server Error"
                                });
}});

router.post('/v1/endusers/verifyotp', async (request, response) => {
    try {
        const { email, otp } = request.body;

        if (!email || !otp) {
            return response.status(400).json({ message: 'Please provide both email and OTP' });
        }

        const userrecord = await login.findOne({ email: email });
        if (!userrecord) {
            return response.status(404).json({ status: false, message: 'Email not found' });
        }
        // Find OTP for this user
        const userOtp = await Otp.findOne({ loginid: userrecord._id, otp: String(otp) });
        if (!userOtp) {
            // Check if any OTP exists for this user (expired or wrong)
            const anyOtp = await Otp.findOne({ loginid: userrecord._id });
            if (!anyOtp) {
                return response.status(410).json({ status: false, message: 'OTP expired. Please request a new one.' });
            }
            return response.status(404).json({ status: false, message: 'Invalid OTP or Email' });
        }

        await login.findByIdAndUpdate(userrecord._id, { isverified: true });
        await Otp.deleteMany({ loginid: userrecord._id }); // Clean up OTPs

        return response.status(200).json({ status: true, message: 'OTP verified successfully' });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        return response.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.post('/v1/endusers/addtocart', isUser, async (request, response) => {
    try {
        const { productid, quantity } = request.body;
        const enduserid = request.user.id;
        const qty = Number(quantity);
        if (!productid || !qty) {
            return response.status(400).json({ message: 'Product ID and quantity are required' });
        }

        const product = await Product.findById(productid);
        if (!product) {
            return response.status(404).json({ message: 'Product not found' });
        }

        if (qty <= 0) {
            return response.status(400).json({ message: 'Invalid quantity' });
        }

        const cart = await Cart.findOne({ enduserid: enduserid });
        let currentCartQty = 0;
        if (cart) {
            const productInCart = cart.products.find(item => item.productid.toString() === productid.toString());
            if (productInCart) {
                currentCartQty = productInCart.quantity;
            }
        }

        // Prevent adding more than available stock
        if (qty + currentCartQty > product.stock) {
            return response.status(400).json({ message: 'Cannot add more than available stock' });
        }

        if (!cart) {
            const newCart = new Cart({ enduserid: enduserid, products: [] });
            newCart.products.push({ productid: productid, quantity: qty });
            await newCart.save();
        } else {
            const productIndex = cart.products.findIndex(item =>
                item.productid.toString() === productid.toString()
            );

            if (productIndex > -1) {
                // Product already exists in the cart, update quantity
                cart.products[productIndex].quantity += qty;
            } else {
                // Product does not exist in the cart, add it
                cart.products.push({ productid: productid, quantity: quantity });
            }
            await cart.save();
        }

        return response.status(200).json({ message: 'Product added to cart successfully' });
    }
    catch (error) {
        console.error('Error adding to cart:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
});

router.get('/v1/endusers/cart', isUser, async (req, res) => {
    try {
        const enduserid = req.user.id; // Assuming user ID is stored in request.user.id
        const cart = await Cart.findOne({ enduserid: enduserid }).populate('products.productid');
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }
        return res.status(200).json({ cart: cart });
    } catch (error) {
        console.error('Error fetching cart:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.put('/v1/endusers/cart/:productid', isUser, async (req, res) => {
    try {
        const enduserid = req.user.id;
        const { productid } = req.params;
        const { quantity } = req.body;

        if (!quantity || quantity <= 0) {
            return res.status(400).json({ message: 'Invalid quantity' });
        }

        const cart = await Cart.findOne({ enduserid: enduserid });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const productIndex = cart.products.findIndex((item) =>
            item.productid.toString() === productid.toString()
        );

        if (productIndex === -1) {
            return res.status(404).json({ message: 'Product not found in cart' });
        }

        // Check product stock before updating quantity
        const product = await Product.findById(productid);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        if (quantity > product.stock) {
            return res.status(400).json({ message: 'Cannot set quantity more than available stock' });
        }

        // Update the quantity of the product in the cart
        cart.products[productIndex].quantity = quantity;
        await cart.save();

        return res.status(200).json({ message: 'Cart updated successfully', cart: cart });
    } catch (error) {
        console.error('Error updating cart:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.delete('/v1/endusers/cart/:productid', isUser, async (req, res) => {
    try {
        const enduserid = req.user.id; // Assuming user ID is stored in request.user.id
        const { productid } = req.params;

        const cart = await Cart.findOne({ enduserid: enduserid });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const productIndex = cart.products.findIndex((item) =>
            item.productid.toString() === productid.toString()
        );

        if (productIndex === -1) {
            return res.status(404).json({ message: 'Product not found in cart' });
        }

        // Remove the product from the cart
        cart.products.splice(productIndex, 1);
        await cart.save();

        return res.status(200).json({ message: 'Product removed from cart successfully', cart: cart });
    } catch (error) {
        console.error('Error removing from cart:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.get('/v1/endusers/products', async (req, res) => {
    try {
        const products = await Product.find({}).populate('catid');
        return res.status(200).json({ products: products });
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.get('/v1/endusers/categories', async (req, res) => {
    try {
        const categories = await Category.find({});
        return res.status(200).json({ categories: categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.post('/v1/endusers/checkout', isUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { address } = req.body;

        // Validate address fields
        if (!address || !address.name || !address.street || !address.city || !address.state || !address.zip || !address.country) {
            return res.status(400).json({ message: 'All address fields are required' });
        }

        const cart = await Cart.findOne({ enduserid: userId }).populate('products.productid');
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }

        // Check stock for all products before proceeding
        for (const item of cart.products) {
            if (item.quantity > item.productid.stock) {
                return res.status(400).json({ message: `Insufficient stock for product: ${item.productid.name}` });
            }
        }

        // Deduct stock for all products
        for (const item of cart.products) {
            item.productid.stock -= item.quantity;
            await item.productid.save();
        }
        // Calculate total price and prepare products array
        let totalAmount = 0;
        const orderProducts = cart.products.map(item => {
            totalAmount += item.productid.price * item.quantity;
            return {
                productId: item.productid._id,
                name: item.productid.name,
                price: item.productid.price,
                quantity: item.quantity
            };
        });

        const newOrder = new Order({
            userId: userId,
            address: address,
            products: orderProducts,
            totalAmount: totalAmount,
            status: 'Pending',
            orderDate: new Date()
        });
        await newOrder.save();

        // Clear the cart
        cart.products = [];
        await cart.save();

        // Send order confirmation email
        const user = await login.findById(userId);
        if (user && user.email) {
            let productList = orderProducts.map(
                p => `${p.name} (x${p.quantity}) - ₹${p.price * p.quantity}`
            ).join('\n');
            const emailBody = `
                <div style="font-family: Arial, sans-serif; color: #222;">
                    <h2 style="color: #2874f0;">Thank you for your order, ${user.name}!</h2>
                    <p>Hi ${user.name},</p>
                    <p>We're happy to let you know that we've received your order. Here are your order details:</p>
                    <hr style="border: none; border-top: 1px solid #eee;" />
                    <h3 style="margin-bottom: 5px;">Order Summary</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th align="left" style="padding: 8px 0;">Product</th>
                                <th align="center" style="padding: 8px 0;">Quantity</th>
                                <th align="right" style="padding: 8px 0;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orderProducts.map(p => `
                                <tr>
                                    <td style="padding: 4px 0;">${p.name}</td>
                                    <td align="center" style="padding: 4px 0;">${p.quantity}</td>
                                    <td align="right" style="padding: 4px 0;">₹${p.price * p.quantity}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <hr style="border: none; border-top: 1px solid #eee;" />
                    <p style="font-size: 1.1em;"><strong>Total Amount:</strong> ₹${totalAmount}</p>
                    <h3 style="margin-bottom: 5px;">Shipping Address</h3>
                    <p>
                        ${address.name}<br/>
                        ${address.street}<br/>
                        ${address.city}, ${address.state} - ${address.zip}<br/>
                        ${address.country}
                    </p>
                    <p style="margin-top: 30px;">
                        We will send you another email once your order has shipped.<br/>
                        If you have any questions, please contact our support team.
                    </p>
                    <p style="color: #888; font-size: 0.95em;">Thank you for shopping with us!<br/>E-commerce Team</p>
                </div>
            `;
            await emailhelper.sendEmail(user.email, 'Order Confirmation', emailBody);
        }

        return res.status(201).json({ message: 'Order placed successfully', order: newOrder });
    } catch (error) {
        console.error('Error placing order:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.post('/v1/endusers/directorder', isUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { products, address } = req.body;

        // Validate input
        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ message: 'Products are required' });
        }
        if (!address || !address.name || !address.street || !address.city || !address.state || !address.zip || !address.country) {
            return res.status(400).json({ message: 'All address fields are required' });
        }

        // Step 1: Check stock for all products first
        let totalAmount = 0;
        const orderProducts = [];
        for (const item of products) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(404).json({ message: `Product not found: ${item.productId}` });
            }
            if (item.quantity <= 0 || item.quantity > product.stock) {
                return res.status(400).json({ message: `Invalid quantity for product: ${product.name}` });
            }
            totalAmount += product.price * item.quantity;
            orderProducts.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                quantity: item.quantity
            });
        }

        // Step 2: Deduct stock for all products after confirming availability
        for (const item of products) {
            const product = await Product.findById(item.productId);
            product.stock -= item.quantity;
            await product.save();
        }

        // Create order
        const newOrder = new Order({
            userId,
            address,
            products: orderProducts,
            totalAmount,
            status: 'Pending',
            orderDate: new Date()
        });
        await newOrder.save();

        // Send confirmation email (reuse your existing email code)
        const user = await login.findById(userId);
        if (user && user.email) {
            const emailBody = `
                <div style="font-family: Arial, sans-serif; color: #222;">
                    <h2 style="color: #2874f0;">Thank you for your order, ${user.name}!</h2>
                    <p>Hi ${user.name},</p>
                    <p>We're happy to let you know that we've received your order. Here are your order details:</p>
                    <hr style="border: none; border-top: 1px solid #eee;" />
                    <h3 style="margin-bottom: 5px;">Order Summary</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th align="left" style="padding: 8px 0;">Product</th>
                                <th align="center" style="padding: 8px 0;">Quantity</th>
                                <th align="right" style="padding: 8px 0;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orderProducts.map(p => `
                                <tr>
                                    <td style="padding: 4px 0;">${p.name}</td>
                                    <td align="center" style="padding: 4px 0;">${p.quantity}</td>
                                    <td align="right" style="padding: 4px 0;">₹${p.price * p.quantity}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <hr style="border: none; border-top: 1px solid #eee;" />
                    <p style="font-size: 1.1em;"><strong>Total Amount:</strong> ₹${totalAmount}</p>
                    <h3 style="margin-bottom: 5px;">Shipping Address</h3>
                    <p>
                        ${address.name}<br/>
                        ${address.street}<br/>
                        ${address.city}, ${address.state} - ${address.zip}<br/>
                        ${address.country}
                    </p>
                    <p style="margin-top: 30px;">
                        We will send you another email once your order has shipped.<br/>
                        If you have any questions, please contact our support team.
                    </p>
                    <p style="color: #888; font-size: 0.95em;">Thank you for shopping with us!<br/>E-commerce Team</p>
                </div>
            `;
            await emailhelper.sendEmail(user.email, 'Order Confirmation', emailBody);
        }

        return res.status(201).json({ message: 'Order placed successfully', order: newOrder });
    } catch (error) {
        console.error('Error placing direct order:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.get('/v1/endusers/orders/:orderId', isUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { orderId } = req.params;

        // Find the order and ensure it belongs to the logged-in user
        const order = await Order.findOne({ _id: orderId, userId: userId });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        return res.status(200).json({ order });
    } catch (error) {
        console.error('Error fetching order:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;