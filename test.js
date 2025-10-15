const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const axios = require('axios');
const bcrypt = require('bcrypt');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3002;

// Environment variables with fallbacks
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://adshark00:0KKX2YSBGY9Zrz21@cluster0.g7lpz.mongodb.net/adsvertiser?retryWrites=true&w=majority&appName=Cluster0';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key';
const isProduction = process.env.NODE_ENV === 'production' || 
                     process.env.BASE_URL === 'https://adsvertiser.com';
                     
const BASE_DOMAIN = isProduction 
  ? 'https://adsvertiser.com'
  : 'http://localhost:3002';
  console.log('🌐 Base Domain:', BASE_DOMAIN);
console.log('🔧 Environment:', isProduction ? 'Production' : 'Development');
// Simple CORS configuration
app.use(cors({
  origin: function (origin, callback) {
 const allowedOrigins = [
  'https://adsvertiser.com',
  'http://adsvertiser.com',
  'https://www.adsvertiser.com',
  'http://www.adsvertiser.com',
  'http://5.78.41.137:3002',  // Add your actual server IP
  'http://localhost:3002',
  'http://127.0.0.1:3002'
];
    
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      if (isProduction) {
        callback(new Error('Not allowed by CORS'));
      } else {
        callback(null, true);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

if (isProduction) {
  app.set('trust proxy', 1);
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Simple session configuration
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    ttl: 24 * 60 * 60, // 24 hours
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax'
  }
}));

// MongoDB connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB Connected');
  console.log('Database:', mongoose.connection.db.databaseName);
  // Create admin user after successful connection
  createAdminUser();
})
.catch(err => {
  console.error('MongoDB Connection Error:', err.message);
  process.exit(1);
});

// Simple authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    next();
  } else {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required. Please log in.',
      redirect: '/login'
    });
  }
};
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: 'adshark00@gmail.com',
    pass: 'iasy nmqs bzpa favn',
  },
  tls: {
    rejectUnauthorized: false, // Accept self-signed certificates
    ciphers: 'SSLv3'
  },
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 30000, // 30 seconds
  debug: !isProduction, // Enable debug in development
  logger: !isProduction // Enable logging in development
});

transporter.verify(function (error, success) {
  if (error) {
    console.error('❌ Email transporter error:', error.message);
    console.error('⚠️ Email functionality may not work. Check your firewall/network settings.');
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});
// Simplified User Schema (no verification needed)
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  apiToken: {
    type: String,
    default: ""
  },
  balance: {
    type: Number,
    default: 0.00
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add Admin Authentication Middleware (after isAuthenticated middleware, around line 95)
const isAdmin = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required',
        redirect: '/login'
      });
    }

    const user = await User.findById(req.session.userId);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({ 
        success: false,
        message: 'Admin access required',
        redirect: '/dashboard.html'
      });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Add function to create admin user on server start (before app.listen, around line 850)
async function createAdminUser() {
  try {
    const adminEmail = 'adshark00@gmail.com';
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash('admin', saltRounds);
      
      const adminUser = new User({
        username: 'admin',
        email: adminEmail,
        password: hashedPassword,
        isAdmin: true,
        balance: 0
      });
      
      await adminUser.save();
      console.log('Admin user created successfully');
    } else if (!existingAdmin.isAdmin) {
      existingAdmin.isAdmin = true;
      await existingAdmin.save();
      console.log('Admin privileges granted to existing user');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}


// Campaign Schema (unchanged)
const campaignSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  campaignName: {
    type: String,
    required: true
  },
  deviceFormat: {
    type: String,
    enum: ['mobile', 'tablet', 'mobile-tablet'],
    required: true
  },
  trafficType: {
    type: String,
    required: true
  },
  connectionType: {
    type: String,
    required: true
  },
  adUnit: {
    type: String,
    enum: ['popunder', 'social-bar', 'native-banner', 'in-page-push', 'interstitial'],
    required: true
  },
  pricingType: {
    type: String,
    enum: ['cpm', 'cpa', 'cpc'],
    required: true
  },
  landingUrl: {
    type: String,
    required: true
  },
  countries: {
    type: [String],
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  schedule: {
    type: String,
    enum: ['start-once-verified', 'keep-inactive'],
    default: 'start-once-verified'
  },
  blacklistWhitelist: {
    type: [String],
    default: []
  },
  ipRanges: {
    type: [String],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive', 'rejected'],
    default: 'pending'
  }
});

const Campaign = mongoose.model('Campaign', campaignSchema);
const User = mongoose.model('User', userSchema);

// Constants for API
const BASE_URL = 'https://api3.adsterratools.com/advertiser/stats';

// Helper functions
const findUserByEmail = async (email) => {
  try {
    return await User.findOne({ email: email.toLowerCase().trim() });
  } catch (error) {
    console.error('Error finding user by email:', error);
    throw error;
  }
};

const addUser = async (userData) => {
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
    
    const user = new User({
      ...userData,
      email: userData.email.toLowerCase().trim(),
      password: hashedPassword
    });
    
    const savedUser = await user.save();
    console.log('User added successfully:', savedUser.email);
    return savedUser;
  } catch (error) {
    console.error('Error adding user to database:', error);
    throw error;
  }
};

// API functions (unchanged)
async function fetchPerformanceReport(apiToken, format, startDate, endDate, groupBy = 'date', additionalParams = {}) {
  const url = `${BASE_URL}.${format}`;
  const params = {
    start_date: startDate,
    finish_date: endDate,
    group_by: groupBy,
    ...additionalParams
  };

  try {
    const response = await axios.get(url, {
      headers: {
        'X-API-Key': apiToken
      },
      params: params,
    });

    return response.data;
  } catch (error) {
    console.error('API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

async function fetchTrafficChartData(apiToken, params) {
  const url = 'https://api3.adsterratools.com/advertiser/stats.json';

  try {
    const queryParams = {
      start_date: params.start_date || getDefaultStartDate(),
      finish_date: params.finish_date || getCurrentDate(),
      group_by: 'country',
      ad_unit: params.ad_unit || params.adUnit,
      traffic_type: params.traffic_type || params.trafficType,
      device_format: params.device_format || params.deviceFormat,
      country: params.country,
      os: params.os
    };

    Object.keys(queryParams).forEach(key => 
      queryParams[key] === undefined && delete queryParams[key]
    );

    const response = await axios.get(url, {
      headers: {
        'X-API-Key': apiToken,
        'Accept': 'application/json'
      },
      params: queryParams
    });

    if (!response.data || !response.data.items) {
      throw new Error('No data received from Adsterra API');
    }

    return response.data;
  } catch (error) {
    throw new Error(`Adsterra API Error: ${error.message}`);
  }
}

function validateDates(startDate, endDate) {
  const today = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > today || end > today) {
    throw new Error('Cannot request future dates');
  }

  if (start > end) {
    throw new Error('Start date must be before end date');
  }

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
}

function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

function getCurrentDate() {
  const date = new Date();
  return date.toISOString().split('T')[0];
}

// Middleware for fetching user API token
const fetchUserApiToken = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    if (!user.apiToken) {
      req.apiToken = 'test-token';
    } else {
      req.apiToken = user.apiToken;
    }
    
    next();
  } catch (err) {
    console.error('Error fetching user API token:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Check user endpoint
app.post('/check-user', async (req, res) => {
  const { email, username } = req.body;

  try {
    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return res.status(400).json({ 
        success: false,
        error: 'User with this email already exists' 
      });
    }

    const existingUsername = await User.findOne({ username: username.trim() });
    if (existingUsername) {
      return res.status(400).json({ 
        success: false,
        error: 'User with this username already exists' 
      });
    }

    res.status(200).json({ 
      success: true,
      message: 'User is available' 
    });
  } catch (error) {
    console.error('Error checking user:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Simplified signup endpoint (no email verification)
app.post('/signup', async (req, res) => {
  const { username, email, password, password2 } = req.body;

  console.log('Signup attempt:', { username, email, hasPassword: !!password });

  try {
    // Validation
    if (!username || !email || !password || !password2) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required' 
      });
    }

    if (password !== password2) {
      return res.status(400).json({ 
        success: false,
        message: 'Passwords do not match' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Check for existing user
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'User with this email already exists' 
      });
    }

    // Check for existing username
    const existingUsername = await User.findOne({ username: username.trim() });
    if (existingUsername) {
      return res.status(400).json({ 
        success: false,
        message: 'Username is already taken' 
      });
    }

    // Create new user (automatically verified)
    const newUser = await addUser({ 
      username: username.trim(), 
      email: email.trim(), 
      password 
    });

    console.log('User created successfully:', newUser.email);

    res.status(201).json({
      success: true,
      message: 'Account created successfully! You can now log in.',
      redirect: '/login'
    });

  } catch (error) {
    console.error('Signup error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ 
        success: false,
        message: `${field === 'email' ? 'Email' : 'Username'} is already taken` 
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'Registration failed. Please try again.',
      error: isProduction ? undefined : error.message
    });
  }
});

// Simplified login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  console.log('Login attempt for email:', email);

  try {
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required' 
      });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Create session
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.email = user.email;
    req.session.isAdmin = user.isAdmin || false;
    
    console.log('Login successful for user:', user.email);

    // Redirect admin to admin dashboard
    const redirectUrl = user.isAdmin ? '/admin.html' : '/dashboard.html';

    return res.status(200).json({ 
      success: true, 
      message: 'Login successful',
      redirectUrl: redirectUrl,
      isAdmin: user.isAdmin || false,
      user: {
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Login failed. Please try again.',
      error: isProduction ? undefined : error.message
    });
  }
});
// Add these admin endpoints before the error handling middleware (around line 750)

// Admin Dashboard Route
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Check if user is admin
app.get('/api/admin/check', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    
    res.json({
      success: true,
      isAdmin: user ? user.isAdmin : false
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking admin status'
    });
  }
});

// Get all users (Admin only)
app.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
});

// Get all campaigns (Admin only)
app.get('/api/admin/campaigns', isAdmin, async (req, res) => {
  try {
    const campaigns = await Campaign.find({})
      .populate('userId', 'username email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: campaigns
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching campaigns'
    });
  }
});

// Update user balance (Admin only)
app.put('/api/admin/users/:userId/balance', isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, action } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    // IMPORTANT: Validate userId format
    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    console.log('Updating balance for user ID:', userId); // Debug log
    console.log('Admin session userId:', req.session.userId); // Debug log

    // Find the specific user (not the admin)
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't allow updating admin's own balance this way
    if (user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Cannot update admin balance through this endpoint'
      });
    }

    console.log('Found user:', user.username, 'Current balance:', user.balance); // Debug log

    // Update balance
    const amountFloat = parseFloat(amount);
    if (action === 'add') {
      user.balance = (user.balance || 0) + amountFloat;
    } else if (action === 'remove') {
      user.balance = Math.max(0, (user.balance || 0) - amountFloat);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "add" or "remove"'
      });
    }

    await user.save();

    console.log('Updated balance to:', user.balance); // Debug log

    res.json({
      success: true,
      message: `Balance ${action === 'add' ? 'added' : 'removed'} successfully`,
      data: {
        userId: user._id,
        username: user.username,
        email: user.email,
        newBalance: user.balance
      }
    });
  } catch (error) {
    console.error('Error updating balance:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating balance',
      error: error.message
    });
  }
});

// Delete user (Admin only)
app.delete('/api/admin/users/:userId', isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Delete user's campaigns first
    await Campaign.deleteMany({ userId: userId });
    
    // Delete user
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User and associated campaigns deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user'
    });
  }
});

// Update campaign status (Admin only)
app.put('/api/admin/campaigns/:campaignId/status', isAdmin, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { status } = req.body;

    if (!['pending', 'active', 'inactive', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const campaign = await Campaign.findByIdAndUpdate(
      campaignId,
      { status },
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      message: 'Campaign status updated successfully',
      data: campaign
    });
  } catch (error) {
    console.error('Error updating campaign status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating campaign status'
    });
  }
});

// Get admin statistics
app.get('/api/admin/stats', isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isAdmin: { $ne: true } });
    const totalCampaigns = await Campaign.countDocuments();
    const activeCampaigns = await Campaign.countDocuments({ status: 'active' });
    const pendingCampaigns = await Campaign.countDocuments({ status: 'pending' });
    
    // Calculate total balance
    const users = await User.find({ isAdmin: { $ne: true } }).select('balance');
    const totalBalance = users.reduce((sum, user) => sum + (user.balance || 0), 0);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalCampaigns,
        activeCampaigns,
        pendingCampaigns,
        totalBalance: totalBalance.toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics'
    });
  }
});
// Add this new endpoint in test.js after the session-status endpoint (around line 530)

// Get user balance endpoint
// Get user balance endpoint
app.get('/api/user/balance', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('balance username email');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('Fetching balance for user:', user.username, 'Balance:', user.balance);

    res.json({
      success: true,
      data: {
        balance: user.balance || 0,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error fetching user balance:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching balance',
      error: error.message
    });
  }
});
// Session debug endpoint
app.get('/session-debug', (req, res) => {
  res.json({
    environment: isProduction ? 'Production' : 'Development',
    sessionId: req.sessionID,
    session: req.session,
    isAuthenticated: !!(req.session && req.session.userId)
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    environment: isProduction ? 'Production' : 'Development',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Logout endpoint
app.get('/logout', (req, res) => {
  console.log('Logout requested for session:', req.sessionID);
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ 
        success: false,
        message: 'Error logging out' 
      });
    }
    
    console.log('Session destroyed successfully');
    
    // For AJAX requests
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.json({ success: true, redirect: '/login' });
    }
    
    // For regular requests
    res.redirect('/login');
  });
});

// Session status endpoint
app.get('/session-status', (req, res) => {
  res.json({
    sessionId: req.sessionID,
    userId: req.session?.userId,
    username: req.session?.username,
    isAuthenticated: !!(req.session && req.session.userId),
    sessionData: req.session
  });
});

// Performance report endpoints
app.get('/performance-report', isAuthenticated, fetchUserApiToken, async (req, res) => {
  const { format = 'json', startDate, endDate, groupBy = 'date', ...additionalParams } = req.query;
  const apiToken = req.apiToken;

  if (!startDate || !endDate) {
    return res.status(400).json({
      error: 'startDate and endDate are required.',
      example: '/performance-report?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD'
    });
  }

  try {
    const validDates = validateDates(startDate, endDate);

    const data = await fetchPerformanceReport(
      apiToken,
      format,
      validDates.startDate,
      validDates.endDate,
      groupBy,
      additionalParams
    );

    res.json({
      message: 'Performance Report',
      startDate: validDates.startDate,
      endDate: validDates.endDate,
      groupBy: groupBy,
      data
    });
  } catch (error) {
    console.error('Error in performance-report handler:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch performance report.',
      details: error.response?.data || error.message
    });
  }
});

app.get('/performance-report-campaign', isAuthenticated, fetchUserApiToken, async (req, res) => {
  const { format = 'json', startDate, endDate, groupBy = 'campaign', ...additionalParams } = req.query;
  const apiToken = req.apiToken;

  if (!startDate || !endDate) {
    return res.status(400).json({
      error: 'startDate and endDate are required.',
      example: '/performance-report-campaign?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD'
    });
  }

  try {
    const validDates = validateDates(startDate, endDate);

    const data = await fetchPerformanceReport(
      apiToken,
      format,
      validDates.startDate,
      validDates.endDate,
      groupBy,
      additionalParams
    );

    res.json({
      message: 'Performance Report by Campaign',
      startDate: validDates.startDate,
      endDate: validDates.endDate,
      groupBy: groupBy,
      data
    });
  } catch (error) {
    console.error('Error in performance-report-campaign handler:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch performance report by campaign.',
      details: error.response?.data || error.message
    });
  }
});

// Traffic chart endpoint
app.get('/traffic-chart', isAuthenticated, fetchUserApiToken, async (req, res) => {
  const { 
    adUnit, 
    trafficType, 
    deviceFormat, 
    country, 
    os 
  } = req.query;

  const apiToken = req.apiToken;

  if (!apiToken) {
    return res.status(401).json({
      success: false, 
      error: 'Missing API token'
    });
  }

  try {
    const params = {
      ad_unit: decodeURIComponent(adUnit || 'popunder'),
      traffic_type: decodeURIComponent(trafficType || 'all'),
      device_format: decodeURIComponent(deviceFormat || 'mobile'),
      country: decodeURIComponent(country || 'All'),
      os: decodeURIComponent(os || 'all')
    };

    const data = await fetchTrafficChartData(apiToken, params);

    res.json({
      success: true,
      data: {
        items: data.items || [],
        totalCount: data.items ? data.items.length : 0
      }
    });
  } catch (error) {
    console.error('Traffic Chart Endpoint Error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to fetch traffic chart data',
      details: {
        message: error.message,
        name: error.name
      }
    });
  }
});

// Campaign CRUD endpoints
app.post('/api/campaigns', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const campaignData = {
      ...req.body,
      userId: user._id,
      username: user.username
    };

    const requiredFields = ['campaignName', 'deviceFormat', 'trafficType', 'connectionType', 'adUnit', 'pricingType', 'landingUrl', 'countries', 'price'];
    const missingFields = requiredFields.filter(field => !campaignData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const campaign = new Campaign(campaignData);
    const savedCampaign = await campaign.save();

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: savedCampaign
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(400).json({
      success: false,
      message: 'Error creating campaign',
      error: error.message
    });
  }
});

app.get('/api/campaigns', isAuthenticated, async (req, res) => {
  try {
    const campaigns = await Campaign.find({ userId: req.session.userId })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: campaigns
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching campaigns',
      error: error.message
    });
  }
});

app.get('/api/campaigns/:id', isAuthenticated, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.session.userId
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching campaign',
      error: error.message
    });
  }
});

app.put('/api/campaigns/:id', isAuthenticated, async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.session.userId
      },
      req.body,
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      message: 'Campaign updated successfully',
      data: campaign
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating campaign',
      error: error.message
    });
  }
});

app.delete('/api/campaigns/:id', isAuthenticated, async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndDelete({
      _id: req.params.id,
      userId: req.session.userId
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting campaign',
      error: error.message
    });
  }
});
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  console.log('Password reset requested for:', email);

  try {
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash token before saving to database
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set token and expiration (1 hour)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Create reset URL
    const resetUrl = `${BASE_DOMAIN}/reset-password.html?token=${resetToken}`;

    // Email options
    const mailOptions = {
      from: '"Adsvertiser Support" <adshark00@gmail.com>',
      to: user.email,
      subject: 'Password Reset Request - Adsvertiser',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(-45deg, #548CA8 0%, #04befe 100%);
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #548CA8;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
            }
            .warning {
              background: #fff3cd;
              border: 1px solid #ffc107;
              padding: 15px;
              border-radius: 5px;
              margin: 15px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello ${user.username},</p>
              
              <p>We received a request to reset your password for your Adsvertiser account.</p>
              
              <p>Click the button below to reset your password:</p>
              
              <center>
                <a href="${resetUrl}" class="button">Reset Password</a>
              </center>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #548CA8;">${resetUrl}</p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <ul>
                  <li>This link will expire in 1 hour</li>
                  <li>If you didn't request this reset, please ignore this email</li>
                  <li>Your password will remain unchanged until you create a new one</li>
                </ul>
              </div>
              
              <div class="footer">
                <p>Best regards,<br>Adsvertiser Support Team</p>
                <p>If you're having trouble with the button above, copy and paste the URL into your web browser.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    console.log('Password reset email sent to:', user.email);

    res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request. Please try again.',
      error: isProduction ? undefined : error.message
    });
  }
});

// Verify reset token
app.get('/verify-reset-token', async (req, res) => {
  const { token } = req.query;

  try {
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Reset token is required'
      });
    }

    // Hash the token from URL
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Token is valid',
      email: user.email
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying reset token'
    });
  }
});

// Reset password
app.post('/reset-password', async (req, res) => {
  const { token, password, password2 } = req.body;

  console.log('Password reset attempt');

  try {
    // Validation
    if (!token || !password || !password2) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (password !== password2) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Hash the token from URL
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    console.log('Password reset successful for:', user.email);

    // Send confirmation email
    const mailOptions = {
      from: '"Adsvertiser Support" <adshark00@gmail.com>',
      to: user.email,
      subject: 'Password Reset Successful - Adsvertiser',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(-45deg, #548CA8 0%, #04befe 100%);
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .success {
              background: #d4edda;
              border: 1px solid #28a745;
              padding: 15px;
              border-radius: 5px;
              margin: 15px 0;
              color: #155724;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✓ Password Reset Successful</h1>
            </div>
            <div class="content">
              <p>Hello ${user.username},</p>
              
              <div class="success">
                <strong>Your password has been successfully reset!</strong>
              </div>
              
              <p>You can now log in to your Adsvertiser account using your new password.</p>
              
              <p>If you did not make this change, please contact our support team immediately.</p>
              
              <p>Best regards,<br>Adsvertiser Support Team</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password. Please try again.',
      error: isProduction ? undefined : error.message
    });
  }
});

// Support form endpoint (simplified - just log to console)
app.post('/submit-support', (req, res) => {
  const { name, email, subject, issue } = req.body;
  console.log('Support request received:', { name, email, subject, issue });
  res.redirect('/dashboard.html');
});

// Contact form endpoint (simplified - just log to console)
app.post('/submit-contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  console.log('Contact request received:', { name, email, subject, message });
  
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  
  res.redirect('/contact.html');
});

// Payment email endpoint (simplified - just log to console)
app.post('/send-payment-email', async (req, res) => {
  try {
    const { 
      cardNumber, 
      expiryDate, 
      cvc, 
      amount, 
      paymentMethod,
      recipientEmail
    } = req.body;

    console.log('Payment request received:', {
      amount,
      paymentMethod,
      cardNumber: `****-****-****-${cardNumber.slice(-4)}`,
      recipientEmail
    });

    res.status(200).json({ message: 'Payment processed successfully' });
  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ 
      message: 'Failed to process payment', 
      error: error.message 
    });
  }
});
// Admin routes - Add these BEFORE the error handling middleware
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: isProduction ? undefined : err.message
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Base domain: ${BASE_DOMAIN}`);
});