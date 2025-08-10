const express = require('express');
const router = express.Router();
const jsonwebtoken = require('jsonwebtoken');
const bcryptjs = require('bcryptjs'); // used for password encyption
const { login } = require('../../../models/login');
const emailhelper = require('../../../controls/email'); // importing email control
const { isAdmin } = require('../../../controls/middleware');
const Otp = require('../../../models/otp');
const token = require('../../../models/token'); // importing token control
const Order = require('../../../models/orders');
const PdfPrinter = require('pdfmake');
const Product = require('../../../models/product');
const Category = require('../../../models/category');
const fs = require('fs');
const path = require('path');

function validateEmail(email) {
    const emailRegex = /^(?=[^@]*[a-zA-Z]{3,})[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/;
    return emailRegex.test(email);
}

router.post('/v1/admin/register', async (request, response) => {
    try {        
        const { name, email, password, phone, role } = request.body;

        if (role !== 'admin') {
            return response.status(400).json({
                message: 'Role must be admin'
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

router.post('/v1/admin/login', async (request,response) =>
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

router.post('/v1/admin/verifyotp', async (request, response) => {
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

router.post('/v1/admin/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ status: false, message: 'Email is required' });
        }
        const user = await login.findOne({ email: email, role: 'admin' });
        if (!user) {
            return res.status(404).json({ status: false, message: 'Admin not found' });
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

router.delete('/v1/admin/deleteuser/:id', isAdmin, async (req, res) => {
    try {
        const id  = req.params.id// Assuming the ID is sent in the request body
        
        if (!id) {
            return res.status(400).json({ status: false, message: 'User ID is required' });
        }
        
        const user = await login.findByIdAndUpdate(id, { status: false });
        if (!user) {
            return res.status(404).json({ status: false, message: 'User not found' });
        }
        
        res.status(200).json({ status: true, message: 'User deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});


const fonts = {
    Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
};

const printer = new PdfPrinter(fonts);
router.get('/v1/admin/download-users', isAdmin, async (req, res) => {
  try {
    const users = await login.find();
    const tableBody = [
      ['Name', 'Email', 'Phone', 'Role', 'Status', 'Verified']  // Header row
    ];
    

    users.forEach(user => {
      tableBody.push([
        user.name || '',
        user.email || '',
        user.phone || '',
        user.role,
        user.status ? 'Active' : 'Inactive',
        user.isverified ? 'Yes' : 'No'
      ]);
    });

   const docDefinition = {
    defaultStyle: {
        font: 'Helvetica'  // Set default font
    },
    content: [
        { text: 'User Details Report', style: 'header' },
        {
            style: 'tableExample',
            table: {
                headerRows: 1,
                body: tableBody
            }
        }
    ],
    styles: {
        header: {
            fontSize: 18,
            bold: true,
            margin: [0, 0, 0, 10]
        },
        tableExample: {
            margin: [0, 5, 0, 15]
        }
    }
};

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="users.pdf"');

    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error('Error generating PDF:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const multer = require('multer');
const storage1 = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'images/product_images/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const categoryStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'images/category-images/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const uploadCategory = multer({ storage: categoryStorage });

router.post('/v1/admin/addcategory', isAdmin, uploadCategory.single('image'), async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || !description || !req.file) {
            return res.status(400).json({ status: false, message: 'Please fill all the fields' });
        }
        const existing = await Category.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
        if (existing) {
            return res.status(400).json({ status: false, message: 'Category name already exists' });
        }

        const image = `/images/category-images/${req.file.filename}`;
        const newCategory = new Category({
            name,
            description,
            image
        });
        await newCategory.save();
        res.status(201).json({ status: true, message: 'Category added successfully', category: newCategory });
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.put('/v1/admin/updatecategory/:id', isAdmin, uploadCategory.single('image'), async (req, res) => {
    try {   
        const { id } = req.params;
        const { name, description } = req.body;
        if (!name || !description) {
            return res.status(400).json({ status: false, message: 'Please fill all the fields' });
        }

        const existingCategory = await Category.findById(id);
        if (!existingCategory) {
            return res.status(404).json({ status: false, message: 'Category not found' });
        }

        // Check for duplicate name (case-insensitive, excluding self)
        const duplicate = await Category.findOne({ 
            _id: { $ne: id }, 
            name: { $regex: `^${name}$`, $options: 'i' } 
        });
        if (duplicate) {
            return res.status(400).json({ status: false, message: 'Category name already exists' });
        }

        const updateData = { name, description };
        if (req.file) {
            if (existingCategory.image) {
                const oldImagePath = path.join(__dirname, '../../..', existingCategory.image);
                fs.unlink(oldImagePath, () => {});
            }
            updateData.image = `/images/category-images/${req.file.filename}`;
        }

        const updatedCategory = await Category.findByIdAndUpdate(id, updateData, { new: true });
        res.status(200).json({ status: true, message: 'Category updated successfully', category: updatedCategory });
    }
    catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.delete('/v1/admin/deletecategory/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findByIdAndDelete(id);
        if (!category) {
            return res.status(404).json({ status: false, message: 'Category not found' });
        }
        // Delete the image file if it exists
        if (category.image) {
            const imagePath = path.join(__dirname, '../../..', category.image);
            fs.unlink(imagePath, (err) => {
                // Ignore error if file doesn't exist
            });
        }
        res.status(200).json({ status: true, message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'images/product_images/');
  },
  filename: function (req, file, cb) {
    // Use product name (sanitized) + timestamp + extension for uniqueness
    const name = req.body.name ? req.body.name.replace(/\s+/g, '_').toLowerCase() : 'product';
    const ext = path.extname(file.originalname);
    cb(null, `${name}_${Date.now()}${ext}`);
  }
});

const uploadProduct = multer({ storage: storage });

router.post('/v1/admin/addproduct', isAdmin, uploadProduct.single('image'), async (req, res) => {
    try {  
        const { name, description, price, category, stock } = req.body;
        if (!name || !description || !price || !category || !stock || !req.file) {
            return res.status(400).json({ status: false, message: 'Please fill all the fields' });
        }
        if (isNaN(price) || price <= 0) {
            return res.status(400).json({ status: false, message: 'Price must be a positive number' });
        }
        if (isNaN(stock) || stock < 0) {
            return res.status(400).json({ status: false, message: 'Stock must be a non-negative number' });
        }
        const catid = await Category.findOne({ name: category }).select('_id');
        if (!catid) {
            return res.status(400).json({ status: false, message: 'Category does not exist' });
        }
        const product = new Product({
            name,
            description,
            price: parseFloat(price),
            catid: catid,
            image: `/images/product_images/${req.file.filename}`,
            stock: parseInt(stock)
        });
        await product.save();
        res.status(201).json({ status: true, message: 'Product added successfully', product });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.put('/v1/admin/updateproduct/:id', isAdmin, uploadProduct.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, category, stock } = req.body;
        if (!name || !description || !price || !category || !stock) {
            return res.status(400).json({ status: false, message: 'Please fill all the fields' });
        }
        if (isNaN(price) || price <= 0) {
            return res.status(400).json({ status: false, message: 'Price must be a positive number' });
        }
        if (isNaN(stock) || stock < 0) {
            return res.status(400).json({ status: false, message: 'Stock must be a non-negative number' });
        }
        const catid = await Category.findOne({ name: category }).select('_id');
        if (!catid) {
            return res.status(400).json({ status: false, message: 'Category does not exist' });
        }
        const updateData = { name, description, price: parseFloat(price), catid, stock: parseInt(stock) };

        if (req.file) {
            const existingProduct = await Product.findById(id);
            if (existingProduct && existingProduct.image) {
                const oldImagePath = path.join(__dirname, '../../..', existingProduct.image);
                fs.unlink(oldImagePath, () => {});
            }
            updateData.image = `/images/product_images/${req.file.filename}`;
        }

        const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true });
        res.status(200).json({ status: true, message: 'Product updated successfully', product: updatedProduct });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.delete('/v1/admin/deleteproduct/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndDelete(id);
        if (!product) {
            return res.status(404).json({ status: false, message: 'Product not found' });
        }
        // Delete the image file if it exists
        if (product.image) {
            const imagePath = path.join(__dirname, '../../..', product.image);
            fs.unlink(imagePath, (err) => {
                // Ignore error if file doesn't exist
            });
        }
        res.status(200).json({ status: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.put('/v1/admin/orders/:orderId/status', isAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        const validStatuses = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ status: false, message: 'Invalid status value' });
        }
        const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true }).populate('userId');
        if (!order) {
            return res.status(404).json({ status: false, message: 'Order not found' });
        }

        // Send email to enduser
        if (order.userId && order.userId.email) {
            const emailBody = `
                <div style="font-family: Arial, sans-serif; color: #222;">
                    <h2 style="color: #2874f0;">Order Status Update</h2>
                    <p>Dear ${order.userId.name},</p>
                    <p>Your order <b>${order._id}</b> status has been updated to: <b>${status}</b>.</p>
                    <p>Thank you for shopping with us!</p>
                </div>
            `;
            await emailhelper.sendEmail(order.userId.email, 'Order Status Updated', emailBody);
        }

        res.status(200).json({ status: true, message: 'Order status updated', order });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

module.exports = router;