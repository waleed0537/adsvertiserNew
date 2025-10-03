const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const axios = require('axios');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;

// Environment variables with fallbacks
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://adshark00:0KKX2YSBGY9Zrz21@cluster0.g7lpz.mongodb.net/adsvertiser?retryWrites=true&w=majority&appName=Cluster0';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key';
const isProduction = process.env.NODE_ENV === 'production';
const BASE_DOMAIN = isProduction 
  ? 'https://adsvertisernew-1.onrender.com' 
  : 'http://localhost:3002';

// Simple CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://adsvertisernew-1.onrender.com',
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

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
    
    console.log('Login successful for user:', user.email);

    return res.status(200).json({ 
      success: true, 
      message: 'Login successful',
      redirectUrl: '/dashboard.html',
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