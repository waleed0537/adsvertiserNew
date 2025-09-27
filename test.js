const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const router = express.Router();

// Environment variables with fallbacks
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://adshark00:0KKX2YSBGY9Zrz21@cluster0.g7lpz.mongodb.net/adsvertiser?retryWrites=true&w=majority&appName=Cluster0';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const BASE_DOMAIN = process.env.BASE_DOMAIN || (process.env.NODE_ENV === 'production' ? 'https://adsvertisernew-1.onrender.com' : 'http://localhost:3000');

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://adsvertisernew-1.onrender.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow for development
    }
  },
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Add this to refresh session on each request
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    ttl: 24 * 60 * 60, // 24 hours in seconds
    touchAfter: 24 * 3600,
    autoRemove: 'native'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 24 hours in milliseconds
    secure: false, // Set to false for development, true only for HTTPS in production
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Updated for better compatibility
  },
  name: 'sessionId' // Give the session a specific name
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

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  console.log('=== Session Check Debug ===');
  console.log('Session ID:', req.sessionID);
  console.log('Session exists:', !!req.session);
  console.log('User ID in session:', req.session?.userId);
  console.log('Session data:', JSON.stringify(req.session, null, 2));
  console.log('Session cookie:', req.headers.cookie);
  console.log('========================');
  
  if (req.session && req.session.userId) {
    // Touch the session to keep it alive
    req.session.touch();
    next();
  } else {
    console.log('Authentication failed - redirecting to login');
    
    // For AJAX requests, return JSON
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(401).json({ 
        success: false,
        message: 'Session expired. Please log in again.',
        redirect: '/login'
      });
    }
    
    // For regular requests, redirect
    res.redirect('/login');
  }
};

// User Schema
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
  verified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Campaign Schema
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

// Nodemailer configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'adshark00@gmail.com',
    pass: 'iasy nmqs bzpa favn',
  },
});

// Verify email transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('Email transporter error:', error);
  } else {
    console.log('Email server is ready to take messages');
  }
});

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

// Email functions
const sendVerificationEmail = (email, username) => {
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });
  const verificationUrl = `${BASE_DOMAIN}/verify-email?token=${token}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color: #8bbcd4;">Hello ${username},</h2>
      <p>Thank you for registering! Please verify your email by clicking the button below:</p>
      <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #8bbcd4; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
        Verify Email
      </a>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-wrap: break-word;">${verificationUrl}</p>
      <p>If you did not request this, please ignore this email.</p>
      <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="font-size: 12px; color: #777;">This email was sent by Adsvertiser. Please do not reply to this email.</p>
    </div>
  `;

  const mailOptions = {
    from: 'info@Adsvertiser.net',
    to: email,
    subject: 'Email Verification - Adsvertiser',
    text: `Hello ${username},\n\nThank you for registering! Please verify your email by clicking the link below:\n${verificationUrl}\n\nIf you did not request this, please ignore this email.`,
    html: htmlContent,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending verification email:', error);
        reject(error);
      } else {
        console.log('Verification email sent:', info.response);
        resolve(info);
      }
    });
  });
};

const sendCampaignEmail = (email, username, campaignData) => {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color: #8bbcd4;">Hello ${username},</h2>
      <p>Thank you for creating a campaign with Adsvertiser! Here are the details of your campaign:</p>
      <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
      <h3 style="color: #8bbcd4;">Your Campaign Details:</h3>
      <ul style="list-style-type: none; padding: 0;">
        <li><strong>Campaign Name:</strong> ${campaignData.campaignName}</li>
        <li><strong>Device Format:</strong> ${campaignData.deviceFormat}</li>
        <li><strong>Traffic Type:</strong> ${campaignData.trafficType}</li>
        <li><strong>Connection Type:</strong> ${campaignData.connectionType}</li>
        <li><strong>Ad Unit:</strong> ${campaignData.adUnit}</li>
        <li><strong>Pricing Type:</strong> ${campaignData.pricingType}</li>
        <li><strong>Landing URL:</strong> ${campaignData.landingUrl}</li>
        <li><strong>Countries:</strong> ${campaignData.countries.join(', ')}</li>
        <li><strong>Price:</strong> $${campaignData.price}</li>
        <li><strong>Schedule:</strong> ${campaignData.schedule}</li>
        <li><strong>Blacklist/Whitelist:</strong> ${campaignData.blacklistWhitelist.join(', ')}</li>
        <li><strong>IP Ranges:</strong> ${campaignData.ipRanges.join(', ')}</li>
      </ul>
      <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="font-size: 12px; color: #777;">This email was sent by Adsvertiser. Please do not reply to this email.</p>
    </div>
  `;

  const mailOptions = {
    from: 'info@Adsvertiser.net',
    to: email,
    subject: 'Your Campaign Details',
    text: `Hello ${username},\n\nThank you for creating a campaign with Adsvertiser! Here are the details of your campaign:\n${JSON.stringify(campaignData, null, 2)}\n\nIf you have any questions, please contact support.`,
    html: htmlContent,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Campaign email sent:', info.response);
    }
  });
};

const sendSupportEmail = (name, email, subject, issue) => {
  const htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #8bbcd4;">New Support Request</h2>
          <p>You have received a new support request from <strong>${name}</strong> (${email}).</p>
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
          <h3 style="color: #8bbcd4;">Support Request Details:</h3>
          <ul style="list-style-type: none; padding: 0;">
              <li><strong>Name:</strong> ${name}</li>
              <li><strong>Email:</strong> ${email}</li>
              <li><strong>Subject:</strong> ${subject}</li>
              <li><strong>Issue:</strong> ${issue}</li>
          </ul>
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #777;">This email was sent by Adsvertiser Support System. Please respond to the user directly.</p>
      </div>
  `;

  const mailOptions = {
      from: email, 
      to: 'Adsvertiser00@gmail.com',
      subject: `Support Request: ${subject}`,
      text: `You have received a new support request from ${name} (${email}).\n\nSubject: ${subject}\n\nIssue: ${issue}`,
      html: htmlContent,
  };

  transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
          console.error('Error sending support email:', error);
      } else {
          console.log('Support email sent:', info.response);
      }
  });
};

const sendContactEmail = (name, email, subject, message) => {
  const htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #8bbcd4;">New Contact Request</h2>
          <p>You have received a new contact request from <strong>${name}</strong> (${email}).</p>
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
          <h3 style="color: #8bbcd4;">Contact Request Details:</h3>
          <ul style="list-style-type: none; padding: 0;">
              <li><strong>Name:</strong> ${name}</li>
              <li><strong>Email:</strong> ${email}</li>
              <li><strong>Subject:</strong> ${subject}</li>
              <li><strong>Message:</strong> ${message}</li>
          </ul>
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #777;">This email was sent by Adsvertiser Contact Form. Please respond to the user directly.</p>
      </div>
  `;

  const mailOptions = {
      from: email,
      to: 'Adsvertiser00@gmail.com',
      subject: `Contact Request: ${subject}`,
      text: `New Contact Request from ${name} (${email}).\n\nSubject: ${subject}\n\nMessage: ${message}`,
      html: htmlContent,
  };

  transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
          console.error('Error sending contact email:', error);
      } else {
          console.log('Contact email sent:', info.response);
      }
  });
};

// API functions
async function fetchPerformanceReport(apiToken, format, startDate, endDate, groupBy = 'date', additionalParams = {}) {
  const url = `${BASE_URL}.${format}`;
  const params = {
    start_date: startDate,
    finish_date: endDate,
    group_by: groupBy,
    ...additionalParams
  };

  console.log('Making API request with:', {
    url,
    params,
    headers: {
      'X-API-Key': apiToken.substring(0, 4) + '...'
    }
  });

  try {
    const response = await axios.get(url, {
      headers: {
        'X-API-Key': apiToken
      },
      params: params,
    });

    console.log('API Response:', {
      status: response.status,
      data: {
        ...response.data,
        items: response.data.items
      }
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

  console.log('🌐 Fetching Traffic Chart Data:');
  console.log('----------------------------');
  console.log('API URL:', url);
  console.log('API Token (partial):', apiToken.substring(0, 4) + '...');
  console.log('Params:', JSON.stringify(params, null, 2));

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

    console.log('✅ API Response Received:');
    console.log('----------------------------');
    console.log('Status:', response.status);
    console.log('Total Items:', response.data.items.length);
    console.log('Response Details:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('❌ Adsterra API Error:');
    console.error('----------------------------');
    
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received');
      console.error('Request:', JSON.stringify(error.request, null, 2));
    } else {
      console.error('Error Message:', error.message);
    }

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
      console.warn('User does not have API token, using default for testing');
      req.apiToken = 'test-token';
    } else {
      req.apiToken = user.apiToken;
    }
    
    console.log('User found:', user.username, 'API Token:', req.apiToken ? 'Present' : 'Missing');
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

app.get('/TOS', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'TOS.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
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

// Signup endpoint
app.post('/signup', async (req, res) => {
  const { username, email, password, password2 } = req.body;

  try {
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

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'User with this email already exists' 
      });
    }

    const newUser = await addUser({ 
      username: username.trim(), 
      email: email.trim(), 
      password 
    });

    await sendVerificationEmail(email, username);

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Please check your email for verification.',
      redirect: '/success.html'
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Registration failed. Please try again.' 
    });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('Login attempt for email:', email);

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

    if (!user.verified) {
      return res.status(401).json({ 
        success: false, 
        error: 'Please verify your email before logging in' 
      });
    }

    // Regenerate session for security
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({
          success: false,
          message: 'Login failed. Please try again.'
        });
      }

      // Set session data
      req.session.userId = user._id;
      req.session.username = user.username;
      req.session.email = user.email;
      
      // Save the session explicitly
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
          });
        }

        console.log('Login successful for user:', user.email);
        console.log('Session created with ID:', req.sessionID);
        console.log('Session data:', { userId: req.session.userId, username: req.session.username });

        return res.status(200).json({ 
          success: true, 
          message: 'Login successful',
          redirectUrl: '/dashboard.html',
          sessionId: req.sessionID // Optional: for debugging
        });
      });
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Login failed. Please try again.' 
    });
  }
});

// Email verification endpoint
app.get('/verify-email', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Verification token is required');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { email } = decoded;

    console.log('Verifying email:', email);

    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { verified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).send('User not found');
    }

    console.log('Email verified successfully for:', email);
    res.redirect('/verified.html');

  } catch (error) {
    console.error('Email verification error:', error);
    if (error.name === 'TokenExpiredError') {
      res.status(400).send('Verification link has expired');
    } else {
      res.status(400).send('Invalid verification link');
    }
  }
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
    
    // Clear the session cookie
    res.clearCookie('sessionId', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
    
    console.log('Session destroyed successfully');
    
    // For AJAX requests
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.json({ success: true, redirect: '/login' });
    }
    
    // For regular requests
    res.redirect('/login');
  });
});
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
  console.log('🌐 Traffic Chart Endpoint Hit');
  console.log('----------------------------');
  
  console.log('Received Raw Query Parameters:', JSON.stringify(req.query, null, 2));
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  const { 
    adUnit, 
    trafficType, 
    deviceFormat, 
    country, 
    os 
  } = req.query;

  const apiToken = req.apiToken;

  console.log('Processed Parameters:', {
    adUnit: decodeURIComponent(adUnit || ''),
    trafficType: decodeURIComponent(trafficType || ''),
    deviceFormat: decodeURIComponent(deviceFormat || ''),
    country: decodeURIComponent(country || ''),
    os: decodeURIComponent(os || '')
  });

  if (!apiToken) {
    console.error('❌ No API token found');
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

    console.log('📤 Prepared API Request Params:', JSON.stringify(params, null, 2));

    const data = await fetchTrafficChartData(apiToken, params);
    
    console.log('📥 API Response:');
    console.log('---------------');
    console.log('Total Items:', data.items ? data.items.length : 0);
    
    if (data.items) {
      data.items.forEach((item, index) => {
        console.log(`Item ${index + 1}:`, JSON.stringify(item, null, 2));
      });
    }

    res.json({
      success: true,
      data: {
        items: data.items || [],
        totalCount: data.items ? data.items.length : 0
      }
    });
  } catch (error) {
    console.error('\n❌ Traffic Chart Endpoint Error:');
    console.error('----------------------------');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('Full Error Object:', JSON.stringify(error, null, 2));

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
    console.log('Creating campaign for user:', req.session.userId);
    
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('Campaign data received:', req.body);

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
    
    console.log('Campaign created successfully:', savedCampaign._id);

    sendCampaignEmail(user.email, user.username, campaignData);

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
    console.log('Fetching campaigns for user:', req.session.userId);
    
    const campaigns = await Campaign.find({ userId: req.session.userId })
      .sort({ createdAt: -1 });
    
    console.log(`Found ${campaigns.length} campaigns`);
    
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

// Support form endpoint
app.post('/submit-support', (req, res) => {
  const { name, email, subject, issue } = req.body;

  console.log('Received support request:', { name, email, subject, issue });

  sendSupportEmail(name, email, subject, issue);
  res.redirect('/dashboard.html');
});

// Contact form endpoint
app.post('/submit-contact', (req, res) => {
  const { name, email, subject, message } = req.body;

  console.log('Received contact request:', { name, email, subject, message });

  if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
      sendContactEmail(name, email, subject, message);
      res.redirect('/contact.html');
  } catch (error) {
      console.error('Error sending contact email:', error);
      res.status(500).json({ message: 'Failed to submit the contact request.' });
  }
});

// Payment email endpoint
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

      if (!recipientEmail) {
          return res.status(400).json({ 
              message: 'Recipient email is required' 
          });
      }

      const maskedCardNumber = `****-****-****-${cardNumber.slice(-4)}`;

      const mailOptions = {
          from: 'info@Adsvertiser.net',
          to: recipientEmail,
          subject: 'Payment Confirmation',
          text: `Payment Details:
Payment Method: ${paymentMethod}
Amount: $${amount}
Card Number: ${maskedCardNumber}
Expiry Date: ${expiryDate}

Thank you for your payment!`,
          html: `
              <h2>Payment Confirmation</h2>
              <p><strong>Payment Method:</strong> ${paymentMethod}</p>
              <p><strong>Amount:</strong> $${amount}</p>
              <p><strong>Card Number:</strong> ${maskedCardNumber}</p>
              <p><strong>Expiry Date:</strong> ${expiryDate}</p>
              <p>Thank you for your payment!</p>
          `
      };

      await transporter.sendMail(mailOptions);

      res.status(200).json({ message: 'Payment email sent successfully' });
  } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ 
          message: 'Failed to send payment email', 
          error: error.message 
      });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    res.status(403).json({
      success: false,
      message: 'Session expired. Please refresh and try again.'
    });
  } else if (err && err.message && err.message.includes('session')) {
    console.error('Session error:', err);
    res.status(500).json({
      success: false,
      message: 'Session error. Please log in again.',
      redirect: '/login'
    });
  } else {
    next(err);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Base domain: ${BASE_DOMAIN}`);
});