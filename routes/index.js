const express = require('express');
const router = express.Router();
const User = require('./users.js');
const mongoose = require('mongoose')
const Post= require('./add.js');
const Unuser= require('./unuser.js')
const Order = require('./order.js')
const nodemailer = require('nodemailer');

const QRCode = require('qrcode');



// Connect to database once at app startup (not in every route)
// Move this to your main app.js/server.js file

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.cookies.userId) {
        return res.redirect('/login');
    }
    next();
};

const requireLog = (req, res,next) => {
    if (!req.cookies.userId) {
        next()
    }else{
    res.redirect('/profile')
    
    }
    
};


const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // Termux এর জন্য প্রয়োজন হতে পারে
  }
});


router.use(async (req, res, next) => {
  try {
    const cookie = req.cookies.userId;
    
    // Set default values
    res.locals.isLoggedIn = !!cookie;
    res.locals.userId = cookie || null;
    res.locals.cartCount = 0;
    
    // If user is logged in, fetch cart count
    if (cookie) {
      const user = await User.findById(cookie).select('cart');
      
      if (user && Array.isArray(user.cart)) {
        // Sum all quantities in cart
        res.locals.cartCount = user.cart.reduce((sum, item) => {
          return sum + (Number(item.quantity) || 1);
        }, 0);
      }
    }
    
  } catch (error) {
    console.error('Middleware error:', error);
    // Set safe defaults on error
    res.locals.cartCount = 0;
    res.locals.isLoggedIn = false;
    res.locals.userId = null;
  }
  
  next();
});






// Home page
router.get('/', async (req, res) => {

const posts= await Post.find({})

    console.log(res.locals.isLoggedIn);
    res.render('index', {posts});
});

// User registration
router.get('/register',requireLog, (req, res) => res.render('register'));

router.post('/register', async (req, res) => {
    try {
        const { name, email, address, password } = req.body;
        
        // Validation
        if (!name || !email || !address || !password) {
            return res.redirect('/?error=All fields are required');
        }
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.redirect('/?error=Invalid email format');
        }
        
        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.redirect('/?error=Email already registered');
        }
        
    
  const otp = Math.floor(1000 + Math.random() * 9000);
  


// ব্যবহার
        // Create user (hash password in User model pre-save hook)
        await Unuser.create({ name, email, address, password,otp:otp });
        
        
        const mailOptions = {
      from: 'info',
      to: email,
      subject: 'Your OTP Code for - Kinun.com',
      text: `Your OTP code is: ${otp}`,
      html: `<p>Your OTP code is: <strong>${otp}</strong></p>`
    };

    await transporter.sendMail(mailOptions);
        
        
        
        res.redirect('/otp');
        
        
    } catch (error) {
        console.error('Registration error:', error);
        res.redirect('/?error=Registration failed');
    }
});


router.post('/uotp', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Resend OTP for:', email);

    // Generate new OTP
    const uotp = Math.floor(1000 + Math.random() * 9000);

    // Update OTP in database
    const user = await Unuser.findOneAndUpdate(
      { email: email },
      { otp: uotp },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ 
        status: 404, 
        message: 'User not found. Please register again.' 
      });
    }

    // Here you should send the OTP to user's email
    // For now, let's just log it (in production, send via email/SMS)
    console.log(`New OTP for ${email}: ${uotp}`);


const mailOptions = {
      from: 'info',
      to: email,
      subject: 'Your OTP Code for - Kinun.com',
      text: `Your OTP code is: ${uotp}`,
      html: `<p>Your OTP code is: <strong>${uotp}</strong></p>`
    };

    await transporter.sendMail(mailOptions);



    res.json({ 
      status: 200, 
      message: 'New OTP sent successfully',
      otp: uotp // Remove this in production - just for testing
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ 
      status: 500, 
      message: 'Failed to resend OTP' 
    });
  }
});

router.post('/otp', async (req, res) => {
  try {
    const { otp } = req.body;
    console.log('Verifying OTP:', otp);
    
    // Find user by OTP
    const user = await Unuser.findOne({ otp: otp });

    if (!user) {
      return res.status(400).json({ 
        status: 400, 
        message: 'Invalid OTP. Please try again.' 
      });
    }

    // Create user in main User collection
    await User.create({
      name: user.name,
      email: user.email,
      address: user.address,
      password: user.password,
    });

    // Delete from temporary Unuser collection
    await Unuser.findByIdAndDelete(user._id);

    res.json({ 
      status: 200, 
      message: 'Registration successful! Redirecting to login...' 
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ 
      status: 500, 
      message: 'Server error during verification' 
    });
  }
});

router.get("/otp", (req, res) => {
  res.render("otp");
});


router.get("/otp",(req,res)=>{

res.render("otp")

})

// Login
router.get('/login',requireLog, (req, res) => res.render('login',{error:''}));

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.redirect('/login?error=Invalid credentials');
        }
        
        // Compare passwords (use bcrypt in User model)
        const isValidPassword = user.password==password;
        if (!isValidPassword) {
            return res.render('login',{error:'the password is incorrect'});
        }
        
        // Set authentication cookie
        res.cookie('userId', user._id.toString(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        });
        
        res.redirect('/profile');
        
    } catch (error) {
        console.error('Login error:', error);
        res.redirect('/login?error=Login failed');
    }
});

// Profile (protected route)
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.cookies.userId);
        if (!user) {
            res.clearCookie('userId');
            return res.redirect('/login');
        }
        
        res.render('profile', { user });
        
    } catch (error) {
        console.error('Profile error:', error);
        res.redirect('/login');
    }
});


router.get('/add',(req,res)=>{

res.render('add')


})


router.post('/add',async (req,res)=>{
const {name,imgUrl,bio,price,current,category}=req.body;

console.log(category)

const post= await Post.create({

name,imgUrl,price,current,category,bio

})

res.send('add succesfully')


})




router.get('/cart/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(req.cookies.userId);
        
        if (!user) return res.redirect('/login');

        // Check if post exists in cart
        const existingIndex = user.cart.findIndex(item => 
            item.post && item.post.toString() === id
        );

        if (existingIndex > -1) {
            // Increase quantity if already exists
            user.cart[existingIndex].quantity += 1;
        } else {
            // Add new item
            user.cart.push({ post: id, quantity: 1 });
        }

        await user.save();
        res.redirect('/'); // Or '/cart' or '/'

    } catch (error) {
        console.error('Cart add error:', error);
        res.redirect('/');
    }
});



// routes/cart.js
router.get('/cart', async (req, res) => {
    try {
        const userId = req.cookies.userId;
        
        if (!userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(userId)
            .populate('cart.post', 'name price imgUrl category'); // Post model er fields

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Calculate totals
        let subtotal = 0;
        user.cart.forEach(item => {
            if (item.post && item.post.price) {
                subtotal += item.post.price * item.quantity;
            }
        });

        res.render('cart', {
            cartItems: user.cart,
            subtotal: subtotal,
            total: subtotal, // Delivery charge add korte paren later
            isEmpty: user.cart.length === 0
        });

    } catch (error) {
        console.error('Cart error:', error);
        res.status(500).send('Server error');
    }
});


// Quantity update route (cart.js e add korun)
router.post('/cart/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'increase' or 'decrease'
        const user = await User.findById(req.cookies.userId);
        
        const cartItem = user.cart.find(item => 
            item.post.toString() === id
        );
        
        if (cartItem) {
            if (action === 'increase') {
                cartItem.quantity += 1;
            } else if (action === 'decrease') {
                if (cartItem.quantity > 1) {
                    cartItem.quantity -= 1;
                } else {
                    // Remove if quantity becomes 0
                    user.cart = user.cart.filter(item => 
                        item.post.toString() !== id
                    );
                }
            }
        }
        
        await user.save();
        res.redirect('/cart');
        
    } catch (error) {
        console.error('Update error:', error);
        res.redirect('/cart');
    }
});


// Remove item route
router.get('/cart/remove/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(req.cookies.userId);
        
        user.cart = user.cart.filter(item => 
            item.post.toString() !== id
        );
        
        await user.save();
        res.redirect('/cart');
        
    } catch (error) {
        console.error('Remove error:', error);
        res.redirect('/cart');
    }
});




router.get('/checkout', async (req, res) => {
    try {
        const userId = req.cookies.userId;
        
        if (!userId) {
            return res.redirect('/login');
        }
        
        // Get user from database
        const user = await User.findById(userId)
                   .populate('cart.post', 'name price imgUrl category')
        
        if (!user) {
            return res.redirect('/login');
        }
        
        const cart = user.cart || [];
        let subtotal = 0;
        
        // Calculate subtotal
        cart.forEach(item => {
            if (item.post) {
                subtotal += item.post.price * item.quantity;
            }
        });
        
        const total = subtotal + 60; // Delivery fee
        
        res.render('checkout', {
            cart,
            subtotal,
            total,
            user: user // Pass actual user object
        });
        
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).send('Server error');
    }
});




router.post('/place-order', async (req, res) => {
    try {
        const userId = req.cookies.userId;
        const { address, mobile } = req.body;
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Please login first' 
            });
        }
        
        // Get user from database
        const user = await User.findById(userId)
                    .populate('cart.post', 'name price imgUrl category')
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        if (!address || !mobile) {
            return res.status(400).json({ 
                success: false, 
                error: 'Address and mobile are required' 
            });
        }
        
        const cart = user.cart || [];
        
        // Calculate total
        let subtotal = 0;
        cart.forEach(item => {
            if (item.post) {
                subtotal += item.post.price * item.quantity;
            }
        });
        const total = subtotal + 60;
        
        // Prepare cart for order
// When placing order
const orderCart = user.cart.map(item => ({
    itemId: item.post._id,
    name: item.post.name,
    price: item.post.price,
    quantity: item.quantity,
    image: item.post.imgUrl
}));

const order = new Order({
    userId: user._id,
    cart: orderCart, // Now has actual product data
    total: total,
    address: address,
    mobile: mobile
});        
        
        
        await order.save();
        
        // Clear user's cart after order (optional)
        user.cart = [];
        await user.save();
        


const qrData = `Order ID: ${order._id}\n                Total: ৳${order.total}\n                Date: ${new Date(order.createdAt).toLocaleDateString()}\n         Items: ${order.cart.length}                                       Address: ৳${order.address}\n`;

const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;



  const mailOptions = {
    from: 'yourstore@gmail.com',
    to: user.email,
    subject: `Order Confirmation #${order._id}`,
    html: `
        <h2 style="text-align:center;">Your Order Details</h2>
        
        <table border="0" cellpadding="10" cellspacing="0" width="100%" style="border-collapse: collapse; font-family: Arial, sans-serif;">
            <tr>
                <th style=" border-bottom: 1px solid #cccccc; padding: 10px; text-align: left;">Item</th>
                <th style=" border-bottom: 1px solid #cccccc; padding: 10px; text-align: left;">Quantity</th>
                <th style=" border-bottom: 1px solid #cccccc; padding: 10px; text-align: left;">Price</th>
                <th style=" border-bottom: 1px solid #cccccc; padding: 10px; text-align: left;">Total</th>
            </tr>
            
            ${order.cart.map(item => `
                <tr>
                    <td style="border-bottom: 1px solid #cccccc; padding: 10px;">${item.name}</td>
                    <td style="border-bottom: 1px solid #cccccc; padding: 10px; text-align: center;">x${item.quantity}</td>
                    <td style="border-bottom: 1px solid #cccccc; padding: 10px;">৳${item.price}</td>
                    <td style="border-bottom: 1px solid #cccccc; padding: 10px;">৳${item.price * item.quantity}</td>
                </tr>
            `).join('')}
            
            <tr>
                <td colspan="3" style="  border-bottom: 2px solid #000000;    padding: 10px; text-align: right;">
                    Delivery charge:
                </td>
                <td style="border-bottom: 2px solid #000000;  padding: 10px;">
                    <strong>৳60</strong>
                </td>
            </tr>
            
            <tr>
                <td colspan="3" style="padding: 10px; text-align: right;">
                    <strong>Total:</strong>
                </td>
                <td style="padding: 10px;">
                    <strong>৳${order.total}</strong>
                </td>
            </tr>
        </table>
        
<p>Scan for order details</p>
            <img src="${qrCode}" style="width: 150px; height: 150px; margin: 15px;">
            <p style="color: #666; font-size: 14px;">
        
        
        <p style="margin-top: 20px; color: #555;">
            Thank you for your order!<br>
            Your order will be delivered soon InsaAllah.
        </p>
    `
};




        
        await transporter.sendMail(mailOptions);
        
        res.json({ 
            success: true, 
            message: 'Order placed successfully!',
            orderId: order._id 
        });
        
    } catch (error) {
        console.error('Order error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error' 
        });
    }
});


router.get('/order/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).send('Order not found');
        }
        
        // Create QR code data properly
        const qrData = `
Order ID: ${order._id}
Total: ৳${order.total}
Date: ${new Date(order.createdAt).toLocaleDateString()}
Status: ${order.status}
Items: ${order.cart.length}
        `.trim(); // Remove extra spaces
        
        // Generate QR code
        const qrCode = await QRCode.toDataURL(qrData);
        
        res.render('details', {
            order: order,
            qrCode: qrCode
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
});



router.get('/products/:id',async (req,res)=>{

const id = req.params.id;


const post = await Post.findOne({_id:id})

res.render('product',{post})



})



// Simple POST route without AJAX
router.post('/cartin/:productId', async (req, res) => {
    try {
        const userId = req.cookies.userId;
        const productId = req.params.productId;
        const quantity = req.body.quantity || 1;

        if (!userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(userId);
        const product = await Post.findById(productId);

        if (!user || !product) {
            return res.redirect('/');
        }

        if (!user.cart) user.cart = [];

        const existingIndex = user.cart.findIndex(item => 
            item.post && item.post._id.toString() === productId
        );

        if (existingIndex > -1) {
            user.cart[existingIndex].quantity += parseInt(quantity);
        } else {
            user.cart.push({
                post: {
                    _id: product._id,
                    name: product.name,
                    price: product.price,
                    imgUrl: product.imgUrl,
                    category: product.category
                },
                quantity: parseInt(quantity)
            });
        }

        await user.save();
        
        // Redirect back to product page with success message
        res.redirect(`/product/${productId}`);

    } catch (error) {
        console.error('Error:', error);
        res.redirect(`/product/${req.params.productId}`);
    }
});



// GET route for tracking page
router.get('/order-track', (req, res) => {
    res.render('track', { title: 'Track Order' });
});

// POST route for tracking order
router.post('/order-track', async (req, res) => {
    try {
        const { productId } = req.body;

        if (!productId) {
            return res.json({
                status: 400,
                message: 'Order ID is required'
            });
        }

        const order = await Order.findOne({ _id: productId });

        if (!order) {
            return res.json({
                status: 404,
                message: 'No order found with this ID'
            });
        }

        res.json({
            status: 200,
            message: 'Order found successfully',
            order: order
        });

    } catch (error) {
        res.json({
            status: 500,
            message: '!No order found'
        });
    }
});






// Logout
router.get('/logout', (req, res) => {
    res.clearCookie('userId');
    res.redirect('/');
});

module.exports = router;