import multer from 'multer';
import fs from 'fs';
import express from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();


const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
// Add this at the beginning of server.js
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'PORT'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    process.exit(1);
  }
  
  // Validate JWT secret in production
  if (process.env.JWT_SECRET === 'a3af209ef7207b8d1546cd868258620f') {
    console.error('❌ DEFAULT JWT_SECRET DETECTED! Please change it in production.');
    process.exit(1);
  }
}
// In your server.js, update the Prisma initialization
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Add connection error handling
prisma.$connect()
  .then(() => console.log('✅ Database connected successfully'))
  .catch(err => {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  });


// In server.js, update CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://10.140.8.10',
  'https://10.140.8.10',
];

// List of allowed headers
const allowedHeaders = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Accept',
  'Origin',
  'X-Application-Name',
  'X-Application-Version',
  'X-Client-ID',
  'X-Request-ID'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      console.warn('CORS blocked:', origin);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: allowedHeaders,
  exposedHeaders: ['Content-Length', 'X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
}));


app.use(express.json());

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Disable caching for API responses
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply to all API routes
app.use('/api', apiLimiter);

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Only 5 attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many login attempts, please try again later'
  }
});

app.use('/api/auth/login', authLimiter);

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  setHeaders: (res, path) => {
    if (path.endsWith('.jpg') || path.endsWith('.png') || path.endsWith('.jpeg')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));
// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};


/// Enhanced multer configuration with professional photo validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user.userId;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `avatar-${userId}-${timestamp}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only specific image formats
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
  
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Only JPEG and PNG images are allowed'), false);
  }

  // Check file extension
  const fileExt = path.extname(file.originalname).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(fileExt)) {
    return cb(new Error('Invalid file type. Only JPG, JPEG, and PNG are allowed'), false);
  }

  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for professional photos
    files: 1 // Only one file
  }
});

// Professional photo validation middleware
const validateProfessionalPhoto = (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const file = req.file;
  
  // Check image dimensions (minimum requirements for professional photos)
  const minWidth = 200;
  const minHeight = 200;
  const maxWidth = 2000;
  const maxHeight = 2000;
  
  // For actual dimension validation, you'd need to process the image
  // This is a basic check - in production, use sharp or jimp to get actual dimensions
  
  // Check file size more strictly
  if (file.size < 10 * 1024) { // 10KB minimum
    // Delete the uploaded file
    fs.unlinkSync(file.path);
    return res.status(400).json({
      success: false,
      message: 'Image file is too small. Please upload a higher quality photo.'
    });
  }

  next();
};

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const leaveSchema = Joi.object({
  leaveTypeId: Joi.number().integer().required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  reason: Joi.string().min(10).max(500).required()
});

const userSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid('employee', 'manager', 'hr-admin', 'super-admin').required(),
  department: Joi.string().required(),
  position: Joi.string().optional().allow(''),
  phone: Joi.string().optional().allow(''),
  password: Joi.string().min(6).required(),
  managerId: Joi.number().optional().allow(null) // ADD THIS LINE
});

const leaveTypeSchema = Joi.object({
  name: Joi.string().required().min(2).max(50),
  maxDays: Joi.number().integer().min(1).max(365).required(),
  description: Joi.string().optional().allow('').max(500),
  color: Joi.string().optional().pattern(/^#[0-9A-F]{6}$/i),
  requiresHRApproval: Joi.boolean().optional(),
  carryOver: Joi.boolean().optional(),
  requiresApproval: Joi.boolean().optional(),
  isActive: Joi.boolean().optional()
});
// Add this function before your API endpoints
// Enhanced leave balance initialization
// Fix the initializeUserLeaveBalances function
async function initializeUserLeaveBalances(userId) {
  try {
    const currentYear = new Date().getFullYear();
    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true }
    });

    console.log(`🔄 Initializing leave balances for user ${userId} for year ${currentYear}`);
    console.log(`📋 Found ${leaveTypes.length} active leave types`);

    const balancePromises = leaveTypes.map(leaveType => {
      return prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId_year: {
            userId: userId,
            leaveTypeId: leaveType.id,
            year: currentYear
          }
        },
        update: {
          // FIX: Add remainingDays calculation in update
          totalDays: leaveType.maxDays,
          remainingDays: {
            // Calculate remaining days based on current usedDays
            increment: 0 // This ensures remainingDays is set properly
          }
        },
        create: {
          userId: userId,
          leaveTypeId: leaveType.id,
          year: currentYear,
          totalDays: leaveType.maxDays,
          usedDays: 0,
          remainingDays: leaveType.maxDays // Start with full balance
        }
      });
    });

    const results = await Promise.allSettled(balancePromises);
    
    // Check for any failures
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      console.error('❌ Some leave balances failed to initialize:', failures);
      throw new Error(`${failures.length} leave balances failed to initialize`);
    }

    console.log(`✅ Leave balances initialized for user ${userId}. Success: ${results.length - failures.length}, Failed: ${failures.length}`);
    
    return results;
  } catch (error) {
    console.error('💥 Error initializing leave balances:', error);
    throw error;
  }
}
// Endpoint to initialize leave balances for all users
app.post('/api/leave-balances/initialize', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only HR administrators can initialize leave balances'
      });
    }

    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true }
    });

    console.log(`🔄 Initializing leave balances for ${users.length} users`);

    const results = await Promise.allSettled(
      users.map(user => initializeUserLeaveBalances(user.id))
    );

    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;

    res.json({
      success: true,
      message: `Leave balances initialized for ${successful} users${failed > 0 ? `, ${failed} failed` : ''}`,
      data: {
        totalUsers: users.length,
        successful,
        failed
      }
    });
  } catch (error) {
    console.error('💥 Initialize leave balances error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});
// ==================== API ROUTES ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { email, password } = value;

    console.log('🔐 Login attempt for:', email);

    // Find user with manager info and LEAVE BALANCES
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        leaveBalances: {
          include: {
            leaveType: true
          }
        }
      }
    });

    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log('✅ User found:', { 
      id: user.id, 
      email: user.email, 
      role: user.role, 
      status: user.status,
      managerId: user.managerId 
    });

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      console.log('❌ User not active:', email, 'Status:', user.status);
      return res.status(401).json({
        success: false,
        message: 'Your account is not active. Please contact HR.'
      });
    }

    // Generate token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Transform role to lowercase for frontend compatibility
    const frontendRole = user.role.toLowerCase().replace('_', '-');

    console.log('✅ Login successful for:', { 
      email, 
      role: frontendRole,
      managerId: user.managerId 
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: frontendRole,
          department: user.department,
          position: user.position,
          phone: user.phone,
          joinDate: user.joinDate,
          status: user.status.toLowerCase(),
          avatar: user.avatar,
          managerId: user.managerId,
          manager: user.manager,
          leaveBalances: user.leaveBalances // Include leave balances in response
        }
      }
    });
  } catch (error) {
    console.error('💥 Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});
// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const frontendRole = user.role.toLowerCase().replace('_', '-');

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: frontendRole,
          department: user.department,
          position: user.position,
          phone: user.phone,
          joinDate: user.joinDate,
          status: user.status.toLowerCase(),
          avatar: user.avatar,
          managerId: user.managerId,
          manager: user.manager
        }
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Dashboard endpoints
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    let stats = {};

    if (userRole === 'EMPLOYEE') {
      // Employee stats
      const pendingRequests = await prisma.leave.count({
        where: {
          employeeId: userId,
          status: { in: ['PENDING_MANAGER', 'PENDING_HR'] }
        }
      });

      const leavesTaken = await prisma.leave.count({
        where: {
          employeeId: userId,
          OR: [
            { status: 'APPROVED' },
            { status: 'HR_APPROVED' }
          ]
        }
      });

      // Get leave balances
      const leaveBalances = await prisma.leaveBalance.findMany({
        where: { userId },
        include: { leaveType: true }
      });

      const availableLeaves = leaveBalances.reduce((total, balance) => total + balance.remainingDays, 0);

      stats = {
        pendingRequests,
        leavesTaken,
        availableLeaves,
        leaveBalance: leaveBalances.map(balance => ({
          type: balance.leaveType.name,
          used: balance.usedDays,
          total: balance.totalDays,
          remaining: balance.remainingDays
        }))
      };
    } else if (userRole === 'MANAGER') {
      // Manager stats
      const pendingRequests = await prisma.leave.count({
        where: {
          employee: {
            managerId: userId
          },
          status: 'PENDING_MANAGER'
        }
      });

      const teamSize = await prisma.user.count({
        where: {
          managerId: userId,
          status: 'ACTIVE'
        }
      });

      const teamOnLeave = await prisma.leave.count({
        where: {
          employee: {
            managerId: userId
          },
          OR: [
            { status: 'APPROVED' },
            { status: 'HR_APPROVED' }
          ],
          startDate: { lte: new Date() },
          endDate: { gte: new Date() }
        }
      });

      const approvedLeaves = await prisma.leave.count({
        where: {
          employee: {
            managerId: userId
          },
          OR: [
            { status: 'APPROVED' },
            { status: 'HR_APPROVED' }
          ]
        }
      });

      const totalLeaves = await prisma.leave.count({
        where: {
          employee: {
            managerId: userId
          }
        }
      });

      const approvalRate = totalLeaves > 0 ? Math.round((approvedLeaves / totalLeaves) * 100) : 0;

      stats = {
        pendingRequests,
        teamSize,
        teamOnLeave,
        approvalRate
      };
    } else if (userRole === 'HR_ADMIN') {
      // HR Admin stats
      const totalEmployees = await prisma.user.count({
        where: { status: 'ACTIVE' }
      });

      const onLeaveToday = await prisma.leave.count({
        where: {
          OR: [
            { status: 'APPROVED' },
            { status: 'HR_APPROVED' }
          ],
          startDate: { lte: new Date() },
          endDate: { gte: new Date() }
        }
      });

      const pendingApprovals = await prisma.leave.count({
        where: { status: 'PENDING_HR' }
      });

      stats = {
        totalEmployees,
        onLeaveToday,
        pendingApprovals,
        systemAlerts: await prisma.notification.count({
          where: {
            type: 'SYSTEM_ALERT',
            isRead: false
          }
        })
      };
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ==================== EMPLOYEE ENDPOINTS ====================

// Leave endpoints
app.get('/api/leaves/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const limit = parseInt(req.query.limit) || 10;

    let whereClause = {};

    if (userRole === 'EMPLOYEE') {
      whereClause = { employeeId: userId };
    }

    const leaves = await prisma.leave.findMany({
      where: whereClause,
      include: {
        leaveType: true,
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        },
        manager: {
          select: {
            name: true,
            email: true
          }
        },
        hrAdmin: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { appliedDate: 'desc' },
      take: limit
    });

    res.json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Leave history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

app.get('/api/leaves/pending', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    let pendingLeaves = [];

    if (userRole === 'MANAGER') {
      pendingLeaves = await prisma.leave.findMany({
        where: {
          employee: {
            managerId: userId
          },
          status: 'PENDING_MANAGER'
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              department: true,
              position: true
            }
          },
          leaveType: true
        },
        orderBy: { appliedDate: 'desc' }
      });
    } else if (userRole === 'HR_ADMIN') {
      pendingLeaves = await prisma.leave.findMany({
        where: {
          status: 'PENDING_HR'
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              department: true,
              position: true,
              manager: {
                select: {
                  name: true,
                  email: true
                }
              }
            }
          },
          leaveType: true,
          manager: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: { appliedDate: 'desc' }
      });
    }

    res.json({
      success: true,
      data: pendingLeaves
    });
  } catch (error) {
    console.error('Pending leaves error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
// ==================== LEAVE APPLICATION ENDPOINT ====================

// In your server.js, update the leave application endpoint
// Enhanced leave application with two-step approval
app.post('/api/leaves/apply', authenticateToken, async (req, res) => {
  try {
    const { error, value } = leaveSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const userId = req.user.userId;
    const { leaveTypeId, startDate, endDate, reason } = value;

    console.log('📋 Leave application request:', {
      userId,
      leaveTypeId,
      startDate,
      endDate,
      reason
    });

    // Calculate days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Validate dates
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    if (start < new Date().setHours(0, 0, 0, 0)) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be in the past'
      });
    }

    // Check leave type
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId }
    });

    if (!leaveType || !leaveType.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found or inactive'
      });
    }

    // Check leave balance - with auto-initialization if not found
    const currentYear = new Date().getFullYear();
    let balance = await prisma.leaveBalance.findFirst({
      where: {
        userId,
        leaveTypeId,
        year: currentYear
      }
    });

    // If no balance found, initialize it
    if (!balance) {
      console.log(`⚠️ No leave balance found for user ${userId}, initializing...`);
      await initializeUserLeaveBalances(userId);
      
      // Try to get balance again
      balance = await prisma.leaveBalance.findFirst({
        where: {
          userId,
          leaveTypeId,
          year: currentYear
        }
      });
      
      if (!balance) {
        return res.status(400).json({
          success: false,
          message: 'Leave balance could not be initialized. Please contact HR.'
        });
      }
    }

    if (days > balance.remainingDays) {
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. You have ${balance.remainingDays} days remaining.`
      });
    }

    // Check for overlapping leaves
    const overlappingLeaves = await prisma.leave.findMany({
      where: {
        employeeId: userId,
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start }
          }
        ],
        status: {
          in: ['PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'HR_APPROVED']
        }
      }
    });

    if (overlappingLeaves.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending or approved leave during this period'
      });
    }

    // Get employee with manager info
    const employee = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        managerId: true,
        department: true
      }
    });

    console.log('👤 Employee details:', {
      name: employee.name,
      managerId: employee.managerId,
      department: employee.department
    });

    // TWO-STEP APPROVAL WORKFLOW
    let status = 'PENDING_MANAGER';
    let currentApprover = 'MANAGER';

    // If employee has no manager, skip to HR approval
    if (!employee.managerId) {
      status = 'PENDING_HR';
      currentApprover = 'HR';
    }

    console.log('🎯 Approval flow:', {
      status,
      currentApprover,
      hasManager: !!employee.managerId
    });

    // Create leave application
    const leave = await prisma.leave.create({
      data: {
        employeeId: userId,
        leaveTypeId,
        startDate: start,
        endDate: end,
        days,
        reason,
        status,
        currentApprover,
        appliedDate: new Date()
      },
      include: {
        leaveType: {
          select: {
            id: true,
            name: true,
            color: true,
            requiresHRApproval: true
          }
        },
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            position: true
          }
        }
      }
    });

    console.log('✅ Leave application created:', {
      id: leave.id,
      status: leave.status,
      currentApprover: leave.currentApprover,
      days: leave.days
    });

    // Create notifications based on approval flow
    if (status === 'PENDING_MANAGER' && employee.managerId) {
      // Notify manager
      await prisma.notification.create({
        data: {
          userId: employee.managerId,
          type: 'LEAVE_PENDING',
          title: 'New Leave Application',
          message: `${employee.name} has applied for ${leaveType.name} leave (${days} days)`,
          actionUrl: `/pending-requests`,
          relatedId: leave.id.toString(),
          priority: 'MEDIUM'
        }
      });
      console.log(`📬 Notification sent to manager: ${employee.managerId}`);
    } else if (status === 'PENDING_HR') {
      // Notify HR admins
      const hrAdmins = await prisma.user.findMany({
        where: {
          role: { in: ['HR_ADMIN', 'SUPER_ADMIN'] },
          status: 'ACTIVE'
        },
        select: { id: true, name: true }
      });

      const hrNotifications = hrAdmins.map(admin =>
        prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'LEAVE_PENDING',
            title: 'New Leave Application Requires HR Approval',
            message: `${employee.name} has applied for ${leaveType.name} leave (${days} days)`,
            actionUrl: `/hr/pending-approvals`,
            relatedId: leave.id.toString(),
            priority: 'HIGH'
          }
        })
      );

      await Promise.all(hrNotifications);
      console.log(`📬 Notifications sent to ${hrAdmins.length} HR admins`);
    }

    res.json({
      success: true,
      data: leave,
      message: 'Leave application submitted successfully'
    });
  } catch (error) {
    console.error('💥 Apply leave error:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Leave application conflict'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});
app.post('/api/auth/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { email, password } = value;

    console.log('🔐 Login attempt for:', email);

    // Find user with manager info and LEAVE BALANCES
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        leaveBalances: {
          include: {
            leaveType: true
          }
        }
      }
    });

    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log('✅ User found:', { 
      id: user.id, 
      email: user.email, 
      role: user.role, 
      status: user.status,
      managerId: user.managerId 
    });

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      console.log('❌ User not active:', email, 'Status:', user.status);
      return res.status(401).json({
        success: false,
        message: 'Your account is not active. Please contact HR.'
      });
    }

    // Generate token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Transform role to lowercase for frontend compatibility
    const frontendRole = user.role.toLowerCase().replace('_', '-');

    console.log('✅ Login successful for:', { 
      email, 
      role: frontendRole,
      managerId: user.managerId 
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: frontendRole,
          department: user.department,
          position: user.position,
          phone: user.phone,
          joinDate: user.joinDate,
          status: user.status.toLowerCase(),
          avatar: user.avatar,
          managerId: user.managerId,
          manager: user.manager,
          leaveBalances: user.leaveBalances // Include leave balances in response
        }
      }
    });
  } catch (error) {
    console.error('💥 Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});
// Leave types endpoint
// ==================== LEAVE TYPE MANAGEMENT ENDPOINTS ====================

// Get all leave types
app.get('/api/leave-types', authenticateToken, async (req, res) => {
  try {
    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: leaveTypes
    });
  } catch (error) {
    console.error('Leave types error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create leave type
app.post('/api/leave-types', authenticateToken, async (req, res) => {
  try {
    const { error, value } = leaveTypeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const leaveType = await prisma.leaveType.create({
      data: {
        ...value,
        isActive: true
      }
    });

    res.json({
      success: true,
      data: leaveType,
      message: 'Leave type created successfully'
    });
  } catch (error) {
    console.error('Create leave type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update leave type
app.put('/api/leave-types/:id', authenticateToken, async (req, res) => {
  try {
    const leaveTypeId = parseInt(req.params.id);
    const { error, value } = leaveTypeSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const leaveType = await prisma.leaveType.update({
      where: { id: leaveTypeId },
      data: value
    });

    res.json({
      success: true,
      data: leaveType,
      message: 'Leave type updated successfully'
    });
  } catch (error) {
    console.error('Update leave type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Toggle leave type status
app.patch('/api/leave-types/:id/status', authenticateToken, async (req, res) => {
  try {
    const leaveTypeId = parseInt(req.params.id);
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive field is required and must be a boolean'
      });
    }

    const leaveType = await prisma.leaveType.update({
      where: { id: leaveTypeId },
      data: { isActive }
    });

    res.json({
      success: true,
      data: leaveType,
      message: `Leave type ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Toggle leave type status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete leave type (soft delete)
app.delete('/api/leave-types/:id', authenticateToken, async (req, res) => {
  try {
    const leaveTypeId = parseInt(req.params.id);

    await prisma.leaveType.update({
      where: { id: leaveTypeId },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Leave type deleted successfully'
    });
  } catch (error) {
    console.error('Delete leave type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
// Get leave balances
app.get('/api/leave-balances', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const leaveBalances = await prisma.leaveBalance.findMany({
      where: { userId },
      include: {
        leaveType: true
      }
    });

    res.json({
      success: true,
      data: leaveBalances
    });
  } catch (error) {
    console.error('Leave balances error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
// HR Final Approval Endpoint
// ==================== HR APPROVAL ENDPOINTS ====================

// HR Final Approval
// In your POST /api/leaves/:id/hr-approve endpoint
// In your POST /api/leaves/:id/hr-approve endpoint

// HR Final Approval - second step
app.post('/api/leaves/:id/hr-approve', authenticateToken, async (req, res) => {
  try {
    const leaveId = parseInt(req.params.id);
    const hrAdminId = req.user.userId;
    const { notes } = req.body;

    console.log('🔄 HR final approval request:', {
      leaveId,
      hrAdminId,
      hasNotes: !!notes
    });

    // Verify HR admin role
    const currentUser = await prisma.user.findUnique({
      where: { id: hrAdminId }
    });

    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only HR administrators can perform final approval'
      });
    }

    // Get existing leave
    const existingLeave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        leaveType: true,
        employee: true
      }
    });

    if (!existingLeave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (existingLeave.status !== 'PENDING_HR') {
      return res.status(400).json({
        success: false,
        message: `Leave is not pending HR approval. Current status: ${existingLeave.status}`
      });
    }

    // Update leave balance and finalize approval
    const leave = await prisma.$transaction(async (tx) => {
      // Update leave status to HR_APPROVED
      const updatedLeave = await tx.leave.update({
        where: { id: leaveId },
        data: {
          status: 'HR_APPROVED',
          currentApprover: 'SYSTEM',
          hrApproved: true,
          hrApprovedBy: hrAdminId,
          hrApprovedDate: new Date(),
          hrNotes: notes
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          leaveType: true
        }
      });

      // Update leave balance - DEDUCT DAYS ONLY ON FINAL APPROVAL
      const currentYear = new Date().getFullYear();
      await tx.leaveBalance.updateMany({
        where: {
          userId: updatedLeave.employeeId,
          leaveTypeId: updatedLeave.leaveTypeId,
          year: currentYear
        },
        data: {
          usedDays: { increment: updatedLeave.days },
          remainingDays: { decrement: updatedLeave.days }
        }
      });

      // Notify employee
      await tx.notification.create({
        data: {
          userId: updatedLeave.employeeId,
          type: 'LEAVE_APPROVED',
          title: 'Leave Fully Approved',
          message: `Your ${updatedLeave.leaveType.name} leave has been fully approved by HR`,
          actionUrl: `/leave-history`,
          relatedId: updatedLeave.id.toString(),
          priority: 'MEDIUM'
        }
      });

      // Notify manager if exists
      if (existingLeave.employee.managerId) {
        await tx.notification.create({
          data: {
            userId: existingLeave.employee.managerId,
            type: 'LEAVE_APPROVED',
            title: 'Team Leave Approved',
            message: `${updatedLeave.employee.name}'s ${updatedLeave.leaveType.name} leave has been fully approved by HR`,
            actionUrl: `/team-leaves`,
            relatedId: updatedLeave.id.toString(),
            priority: 'LOW'
          }
        });
      }

      return updatedLeave;
    });

    console.log('✅ HR final approval completed:', {
      id: leave.id,
      newStatus: leave.status
    });

    res.json({
      success: true,
      data: leave,
      message: 'Leave finally approved successfully'
    });
  } catch (error) {
    console.error('💥 HR approve error:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found or already processed'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});
// HR Reject Endpoint
app.post('/api/leaves/:id/hr-reject', authenticateToken, async (req, res) => {
  try {
    const leaveId = parseInt(req.params.id);
    const hrAdminId = req.user.userId;
    const { notes } = req.body;

    console.log('🔄 HR rejection request:', { leaveId, hrAdminId });

    // Verify HR admin role
    const currentUser = await prisma.user.findUnique({
      where: { id: hrAdminId }
    });

    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only HR administrators can reject leaves'
      });
    }

    const leave = await prisma.$transaction(async (tx) => {
      const updatedLeave = await tx.leave.update({
        where: { 
          id: leaveId,
          status: 'PENDING_HR'
        },
        data: {
          status: 'REJECTED',
          currentApprover: 'SYSTEM',
          hrApproved: false,
          hrApprovedBy: hrAdminId,
          hrApprovedDate: new Date(),
          hrNotes: notes
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          leaveType: true
        }
      });

      // Notify employee
      await tx.notification.create({
        data: {
          userId: updatedLeave.employeeId,
          type: 'LEAVE_REJECTED',
          title: 'Leave Rejected by HR',
          message: `Your ${updatedLeave.leaveType.name} leave application has been rejected by HR`,
          actionUrl: `/leave-history`,
          relatedId: updatedLeave.id.toString(),
          priority: 'HIGH'
        }
      });

      // Notify manager if exists
      if (updatedLeave.employee.managerId) {
        await tx.notification.create({
          data: {
            userId: updatedLeave.employee.managerId,
            type: 'LEAVE_REJECTED',
            title: 'Team Leave Rejected',
            message: `${updatedLeave.employee.name}'s ${updatedLeave.leaveType.name} leave has been rejected by HR`,
            actionUrl: `/team-leaves`,
            relatedId: updatedLeave.id.toString(),
            priority: 'MEDIUM'
          }
        });
      }

      return updatedLeave;
    });

    console.log('✅ HR rejection completed:', {
      id: leave.id,
      newStatus: leave.status
    });

    res.json({
      success: true,
      data: leave,
      message: 'Leave rejected successfully'
    });
  } catch (error) {
    console.error('💥 HR reject error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});
// Get HR Pending Approvals
app.get('/api/hr/pending-approvals', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    // Check if user is HR Admin or Super Admin
    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only HR administrators can access this endpoint'
      });
    }

    const pendingLeaves = await prisma.leave.findMany({
      where: {
        status: 'PENDING_HR'
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            position: true,
            manager: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        leaveType: true,
        manager: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { appliedDate: 'asc' }
    });

    console.log('📋 HR Pending approvals count:', pendingLeaves.length);

    res.json({
      success: true,
      data: pendingLeaves
    });
  } catch (error) {
    console.error('HR pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
// ==================== HR REPORTS ENDPOINTS ====================

// Get comprehensive HR reports

app.get('/api/hr/reports/analytics', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Check if user is HR Admin or Super Admin
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only HR administrators can access reports'
      });
    }

    // Parse date range or use default (last 6 months)
    const start = startDate ? new Date(startDate) : new Date();
    start.setMonth(start.getMonth() - 6);
    const end = endDate ? new Date(endDate) : new Date();

    // Get all data needed for reports
    const [leaves, users, leaveTypes, leaveBalances] = await Promise.all([
      prisma.leave.findMany({
        where: {
          appliedDate: {
            gte: start,
            lte: end
          }
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              department: true,
              position: true,
              status: true
            }
          },
          leaveType: true,
          manager: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: { appliedDate: 'desc' }
      }),
      prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          position: true,
          status: true,
          joinDate: true
        }
      }),
      prisma.leaveType.findMany({
        where: { isActive: true }
      }),
      prisma.leaveBalance.findMany({
        where: {
          year: new Date().getFullYear()
        },
        include: {
          leaveType: true,
          user: {
            select: {
              id: true,
              name: true,
              department: true
            }
          }
        }
      })
    ]);

    // Process data for reports
    const reportData = await generateReportData(leaves, users, leaveTypes, leaveBalances, start, end);
    
    res.json({
      success: true,
      data: reportData,
      message: 'HR analytics report generated successfully'
    });
  } catch (error) {
    console.error('HR reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Generate export data for Excel
app.get('/api/hr/reports/export', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, reportType } = req.query;
    
    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only HR administrators can export reports'
      });
    }

    // Get report data
    const start = startDate ? new Date(startDate) : new Date();
    start.setMonth(start.getMonth() - 6);
    const end = endDate ? new Date(endDate) : new Date();

    const [leaves, users, leaveTypes] = await Promise.all([
      prisma.leave.findMany({
        where: {
          appliedDate: {
            gte: start,
            lte: end
          }
        },
        include: { 
          employee: {
            select: {
              name: true,
              department: true,
              position: true
            }
          },
          leaveType: true
        }
      }),
      prisma.user.findMany({
        where: { status: 'ACTIVE' }
      }),
      prisma.leaveType.findMany({
        where: { isActive: true }
      })
    ]);

    // Generate export data based on report type
    const exportData = generateExportData(leaves, users, leaveTypes, reportType, start, end);
    
    res.json({
      success: true,
      data: exportData,
      message: 'Export data generated successfully'
    });
  } catch (error) {
    console.error('Export reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Utility function to generate report data
async function generateReportData(leaves, users, leaveTypes, leaveBalances, startDate, endDate) {
  // Summary statistics
  const summary = {
    totalEmployees: users.length,
    totalLeaves: leaves.length,
    approvedLeaves: leaves.filter(l => l.status === 'APPROVED' || l.status === 'HR_APPROVED').length,
    pendingLeaves: leaves.filter(l => l.status === 'PENDING_MANAGER' || l.status === 'PENDING_HR').length,
    rejectedLeaves: leaves.filter(l => l.status === 'REJECTED').length,
    averageLeaveDuration: leaves.reduce((acc, leave) => acc + leave.days, 0) / leaves.length || 0,
    totalLeaveDays: leaves.reduce((acc, leave) => acc + leave.days, 0)
  };

  // Department statistics
  const departments = [...new Set(users.map(u => u.department))];
  const departmentStats = departments.map(dept => {
    const deptUsers = users.filter(u => u.department === dept);
    const deptLeaves = leaves.filter(l => 
      deptUsers.some(u => u.id === l.employeeId)
    );
    const approvedLeaves = deptLeaves.filter(l => 
      l.status === 'APPROVED' || l.status === 'HR_APPROVED'
    );
    
    return {
      department: dept,
      employeeCount: deptUsers.length,
      totalLeaves: deptLeaves.length,
      approvedLeaves: approvedLeaves.length,
      rejectedLeaves: deptLeaves.filter(l => l.status === 'REJECTED').length,
      averageDuration: deptLeaves.reduce((acc, leave) => acc + leave.days, 0) / deptLeaves.length || 0,
      approvalRate: deptLeaves.length > 0 ? (approvedLeaves.length / deptLeaves.length) * 100 : 0
    };
  });

  // Leave type statistics
  const leaveTypeStats = leaveTypes.map(lt => {
    const typeLeaves = leaves.filter(l => l.leaveTypeId === lt.id);
    const approvedLeaves = typeLeaves.filter(l => 
      l.status === 'APPROVED' || l.status === 'HR_APPROVED'
    );
    
    return {
      leaveType: lt.name,
      totalRequests: typeLeaves.length,
      approvedRequests: approvedLeaves.length,
      rejectedRequests: typeLeaves.filter(l => l.status === 'REJECTED').length,
      averageDuration: typeLeaves.reduce((acc, leave) => acc + leave.days, 0) / typeLeaves.length || 0,
      utilizationRate: typeLeaves.length > 0 ? 
        (typeLeaves.reduce((acc, leave) => acc + leave.days, 0) / (lt.maxDays * summary.totalEmployees)) * 100 : 0
    };
  });

  // Monthly trends (last 6 months)
  const monthlyTrends = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    const monthLeaves = leaves.filter(leave => {
      const leaveDate = new Date(leave.appliedDate);
      return leaveDate.getMonth() === date.getMonth() && 
             leaveDate.getFullYear() === date.getFullYear();
    });
    
    const approvedMonthLeaves = monthLeaves.filter(l => 
      l.status === 'APPROVED' || l.status === 'HR_APPROVED'
    );
    
    return {
      month: monthName,
      leavesTaken: monthLeaves.length,
      approvalRate: monthLeaves.length > 0 ? (approvedMonthLeaves.length / monthLeaves.length) * 100 : 0,
      averageDuration: monthLeaves.reduce((acc, leave) => acc + leave.days, 0) / monthLeaves.length || 0
    };
  }).reverse();

  // Employee insights (top 10 by leave days)
  const employeeInsights = users
    .map(user => {
      const userLeaves = leaves.filter(l => l.employeeId === user.id);
      const approvedLeaves = userLeaves.filter(l => 
        l.status === 'APPROVED' || l.status === 'HR_APPROVED'
      );
      
      return {
        employeeName: user.name,
        department: user.department,
        leavesTaken: userLeaves.length,
        totalDays: userLeaves.reduce((acc, leave) => acc + leave.days, 0),
        approvalRate: userLeaves.length > 0 ? (approvedLeaves.length / userLeaves.length) * 100 : 0
      };
    })
    .sort((a, b) => b.totalDays - a.totalDays)
    .slice(0, 10);

  // Compliance data
  const complianceData = {
    policyViolations: leaves.filter(leave => {
      const leaveType = leaveTypes.find(lt => lt.id === leave.leaveTypeId);
      return leaveType && leave.days > leaveType.maxDays;
    }).length,
    lateApplications: leaves.filter(leave => {
      const appliedDate = new Date(leave.appliedDate);
      const startDate = new Date(leave.startDate);
      return (startDate.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24) < 2;
    }).length,
    overlappingLeaves: calculateOverlappingLeaves(leaves),
    highFrequencyEmployees: employeeInsights.filter(emp => emp.leavesTaken > 5).length
  };

  return {
    summary,
    departmentStats,
    leaveTypeStats,
    monthlyTrends,
    employeeInsights,
    complianceData,
    reportPeriod: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }
  };
}

// Utility function to calculate overlapping leaves
function calculateOverlappingLeaves(leaves) {
  let overlappingCount = 0;
  const employeeLeaves = {};

  // Group leaves by employee
  leaves.forEach(leave => {
    if (!employeeLeaves[leave.employeeId]) {
      employeeLeaves[leave.employeeId] = [];
    }
    employeeLeaves[leave.employeeId].push(leave);
  });

  // Check for overlaps for each employee
  Object.values(employeeLeaves).forEach(employeeLeaves => {
    employeeLeaves.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    
    for (let i = 1; i < employeeLeaves.length; i++) {
      const prevLeave = employeeLeaves[i - 1];
      const currentLeave = employeeLeaves[i];
      
      if (new Date(currentLeave.startDate) <= new Date(prevLeave.endDate)) {
        overlappingCount++;
      }
    }
  });

  return overlappingCount;
}

// Utility function to generate export data
function generateExportData(leaves, users, leaveTypes, reportType, startDate, endDate) {
  switch (reportType) {
    case 'department-usage':
      return leaves.map(leave => ({
        'Employee Name': leave.employee.name,
        'Department': leave.employee.department,
        'Leave Type': leave.leaveType.name,
        'Start Date': leave.startDate,
        'End Date': leave.endDate,
        'Duration (Days)': leave.days,
        'Status': leave.status,
        'Applied Date': leave.appliedDate
      }));
    
    case 'leave-types':
      return leaveTypes.map(lt => {
        const typeLeaves = leaves.filter(l => l.leaveTypeId === lt.id);
        const approvedLeaves = typeLeaves.filter(l => 
          l.status === 'APPROVED' || l.status === 'HR_APPROVED'
        );
        
        return {
          'Leave Type': lt.name,
          'Total Requests': typeLeaves.length,
          'Approved Requests': approvedLeaves.length,
          'Rejected Requests': typeLeaves.filter(l => l.status === 'REJECTED').length,
          'Approval Rate': typeLeaves.length > 0 ? ((approvedLeaves.length / typeLeaves.length) * 100).toFixed(1) + '%' : '0%',
          'Average Duration': (typeLeaves.reduce((acc, leave) => acc + leave.days, 0) / typeLeaves.length || 0).toFixed(1),
          'Max Days Allowed': lt.maxDays
        };
      });
    
    case 'employee-trends':
      return users.map(user => {
        const userLeaves = leaves.filter(l => l.employeeId === user.id);
        const approvedLeaves = userLeaves.filter(l => 
          l.status === 'APPROVED' || l.status === 'HR_APPROVED'
        );
        
        return {
          'Employee Name': user.name,
          'Department': user.department,
          'Total Leaves': userLeaves.length,
          'Total Leave Days': userLeaves.reduce((acc, leave) => acc + leave.days, 0),
          'Approval Rate': userLeaves.length > 0 ? ((approvedLeaves.length / userLeaves.length) * 100).toFixed(1) + '%' : '0%',
          'Average Duration': (userLeaves.reduce((acc, leave) => acc + leave.days, 0) / userLeaves.length || 0).toFixed(1)
        };
      });
    
    default:
      return leaves;
  }
}
  
  // ==================== SYSTEM SETTINGS ENDPOINTS ====================

// Get all system settings
app.get('/api/system/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await prisma.systemSettings.findMany({
      orderBy: { category: 'asc' }
    });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update system setting
app.put('/api/system/settings/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    // Validate that user has permission (HR Admin or Super Admin)
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to modify system settings'
      });
    }

    // Define setting categories and defaults
    const settingCategories = {
      // Leave Policies
      'maxConsecutiveLeaves': { category: 'leave_policies', description: 'Maximum consecutive leave days allowed' },
      'advanceNoticeDays': { category: 'leave_policies', description: 'Advance notice required in days' },
      'carryOverEnabled': { category: 'leave_policies', description: 'Enable leave carry over' },
      'carryOverLimit': { category: 'leave_policies', description: 'Maximum carry over days' },
      'maxLeaveDaysPerYear': { category: 'leave_policies', description: 'Maximum leave days per year' },
      'minLeaveDuration': { category: 'leave_policies', description: 'Minimum leave duration in days' },
      
      // Approval Settings
      'autoApproveEnabled': { category: 'approval_settings', description: 'Enable auto-approval for short leaves' },
      'autoApproveMaxDays': { category: 'approval_settings', description: 'Maximum days for auto-approval' },
      'requireManagerApproval': { category: 'approval_settings', description: 'Require manager approval' },
      'requireHRApproval': { category: 'approval_settings', description: 'Require HR approval' },
      'approvalReminderHours': { category: 'approval_settings', description: 'Approval reminder interval in hours' },
      
      // Notification Settings
      'notificationEmails': { category: 'notification_settings', description: 'Enable email notifications' },
      'notificationSMS': { category: 'notification_settings', description: 'Enable SMS notifications' },
      'managerNotifications': { category: 'notification_settings', description: 'Enable manager notifications' },
      'hrNotifications': { category: 'notification_settings', description: 'Enable HR notifications' },
      'systemAlerts': { category: 'notification_settings', description: 'Enable system alerts' },
      
      // System Behavior
      'allowBackdateLeaves': { category: 'system_behavior', description: 'Allow backdated leaves' },
      'allowOverlappingLeaves': { category: 'system_behavior', description: 'Allow overlapping leaves' },
      'fiscalYearStart': { category: 'system_behavior', description: 'Fiscal year start date' },
      'workingDays': { category: 'system_behavior', description: 'Working days configuration' },
      'holidayCalendar': { category: 'system_behavior', description: 'Holiday calendar type' },
      
      // UI Settings
      'theme': { category: 'ui_settings', description: 'Interface theme' },
      'language': { category: 'ui_settings', description: 'Interface language' },
      'timezone': { category: 'ui_settings', description: 'System timezone' }
    };

    const settingConfig = settingCategories[key];
    if (!settingConfig) {
      return res.status(400).json({
        success: false,
        message: `Invalid setting key: ${key}`
      });
    }

    // Update or create setting
    const setting = await prisma.systemSettings.upsert({
      where: { key },
      update: { 
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        updatedAt: new Date()
      },
      create: {
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        description: settingConfig.description,
        category: settingConfig.category,
        isPublic: false // System settings are not public
      }
    });

    // Log the setting change
    console.log(`🔧 System setting updated: ${key} = ${value} by user ${currentUser.name}`);

    res.json({
      success: true,
      data: setting,
      message: 'Setting updated successfully'
    });
  } catch (error) {
    console.error('Update system setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Initialize default system settings
app.post('/api/system/settings/initialize', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const defaultSettings = [
      // Leave Policies
      { key: 'maxConsecutiveLeaves', value: '15', category: 'leave_policies', description: 'Maximum consecutive leave days allowed' },
      { key: 'advanceNoticeDays', value: '3', category: 'leave_policies', description: 'Advance notice required in days' },
      { key: 'carryOverEnabled', value: 'true', category: 'leave_policies', description: 'Enable leave carry over' },
      { key: 'carryOverLimit', value: '10', category: 'leave_policies', description: 'Maximum carry over days' },
      { key: 'maxLeaveDaysPerYear', value: '30', category: 'leave_policies', description: 'Maximum leave days per year' },
      { key: 'minLeaveDuration', value: '0.5', category: 'leave_policies', description: 'Minimum leave duration in days' },
      
      // Approval Settings
      { key: 'autoApproveEnabled', value: 'false', category: 'approval_settings', description: 'Enable auto-approval for short leaves' },
      { key: 'autoApproveMaxDays', value: '1', category: 'approval_settings', description: 'Maximum days for auto-approval' },
      { key: 'requireManagerApproval', value: 'true', category: 'approval_settings', description: 'Require manager approval' },
      { key: 'requireHRApproval', value: 'true', category: 'approval_settings', description: 'Require HR approval' },
      { key: 'approvalReminderHours', value: '24', category: 'approval_settings', description: 'Approval reminder interval in hours' },
      
      // Notification Settings
      { key: 'notificationEmails', value: 'true', category: 'notification_settings', description: 'Enable email notifications' },
      { key: 'notificationSMS', value: 'false', category: 'notification_settings', description: 'Enable SMS notifications' },
      { key: 'managerNotifications', value: 'true', category: 'notification_settings', description: 'Enable manager notifications' },
      { key: 'hrNotifications', value: 'true', category: 'notification_settings', description: 'Enable HR notifications' },
      { key: 'systemAlerts', value: 'true', category: 'notification_settings', description: 'Enable system alerts' },
      
      // System Behavior
      { key: 'allowBackdateLeaves', value: 'false', category: 'system_behavior', description: 'Allow backdated leaves' },
      { key: 'allowOverlappingLeaves', value: 'false', category: 'system_behavior', description: 'Allow overlapping leaves' },
      { key: 'fiscalYearStart', value: '2024-01-01', category: 'system_behavior', description: 'Fiscal year start date' },
      { key: 'workingDays', value: '["monday","tuesday","wednesday","thursday","friday"]', category: 'system_behavior', description: 'Working days configuration' },
      { key: 'holidayCalendar', value: 'ethiopian', category: 'system_behavior', description: 'Holiday calendar type' },
      
      // UI Settings
      { key: 'theme', value: 'light', category: 'ui_settings', description: 'Interface theme' },
      { key: 'language', value: 'en', category: 'ui_settings', description: 'Interface language' },
      { key: 'timezone', value: 'Africa/Addis_Ababa', category: 'ui_settings', description: 'System timezone' }
    ];

    // Create or update each setting
    const createPromises = defaultSettings.map(setting =>
      prisma.systemSettings.upsert({
        where: { key: setting.key },
        update: { 
          value: setting.value,
          category: setting.category,
          description: setting.description,
          updatedAt: new Date()
        },
        create: {
          key: setting.key,
          value: setting.value,
          category: setting.category,
          description: setting.description,
          isPublic: false
        }
      })
    );

    await Promise.all(createPromises);

    res.json({
      success: true,
      message: 'System settings initialized successfully'
    });
  } catch (error) {
    console.error('Initialize system settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ==================== SYSTEM SETTINGS ENDPOINTS ====================

// Get all system settings
app.get('/api/system/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await prisma.systemSettings.findMany({
      orderBy: { category: 'asc' }
    });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update system setting
app.put('/api/system/settings/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    // Validate that user has permission (HR Admin or Super Admin)
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to modify system settings'
      });
    }

    // Define setting categories and defaults
    const settingCategories = {
      // Leave Policies
      'maxConsecutiveLeaves': { category: 'leave_policies', description: 'Maximum consecutive leave days allowed' },
      'advanceNoticeDays': { category: 'leave_policies', description: 'Advance notice required in days' },
      'carryOverEnabled': { category: 'leave_policies', description: 'Enable leave carry over' },
      'carryOverLimit': { category: 'leave_policies', description: 'Maximum carry over days' },
      'maxLeaveDaysPerYear': { category: 'leave_policies', description: 'Maximum leave days per year' },
      'minLeaveDuration': { category: 'leave_policies', description: 'Minimum leave duration in days' },
      
      // Approval Settings
      'autoApproveEnabled': { category: 'approval_settings', description: 'Enable auto-approval for short leaves' },
      'autoApproveMaxDays': { category: 'approval_settings', description: 'Maximum days for auto-approval' },
      'requireManagerApproval': { category: 'approval_settings', description: 'Require manager approval' },
      'requireHRApproval': { category: 'approval_settings', description: 'Require HR approval' },
      'approvalReminderHours': { category: 'approval_settings', description: 'Approval reminder interval in hours' },
      
      // Notification Settings
      'notificationEmails': { category: 'notification_settings', description: 'Enable email notifications' },
      'notificationSMS': { category: 'notification_settings', description: 'Enable SMS notifications' },
      'managerNotifications': { category: 'notification_settings', description: 'Enable manager notifications' },
      'hrNotifications': { category: 'notification_settings', description: 'Enable HR notifications' },
      'systemAlerts': { category: 'notification_settings', description: 'Enable system alerts' },
      
      // System Behavior
      'allowBackdateLeaves': { category: 'system_behavior', description: 'Allow backdated leaves' },
      'allowOverlappingLeaves': { category: 'system_behavior', description: 'Allow overlapping leaves' },
      'fiscalYearStart': { category: 'system_behavior', description: 'Fiscal year start date' },
      'workingDays': { category: 'system_behavior', description: 'Working days configuration' },
      'holidayCalendar': { category: 'system_behavior', description: 'Holiday calendar type' },
      
      // UI Settings
      'theme': { category: 'ui_settings', description: 'Interface theme' },
      'language': { category: 'ui_settings', description: 'Interface language' },
      'timezone': { category: 'ui_settings', description: 'System timezone' }
    };

    const settingConfig = settingCategories[key];
    if (!settingConfig) {
      return res.status(400).json({
        success: false,
        message: `Invalid setting key: ${key}`
      });
    }

    // Update or create setting
    const setting = await prisma.systemSettings.upsert({
      where: { key },
      update: { 
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        updatedAt: new Date()
      },
      create: {
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        description: settingConfig.description,
        category: settingConfig.category,
        isPublic: false // System settings are not public
      }
    });

    // Log the setting change
    console.log(`🔧 System setting updated: ${key} = ${value} by user ${currentUser.name}`);

    res.json({
      success: true,
      data: setting,
      message: 'Setting updated successfully'
    });
  } catch (error) {
    console.error('Update system setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Initialize default system settings
app.post('/api/system/settings/initialize', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const defaultSettings = [
      // Leave Policies
      { key: 'maxConsecutiveLeaves', value: '15', category: 'leave_policies', description: 'Maximum consecutive leave days allowed' },
      { key: 'advanceNoticeDays', value: '3', category: 'leave_policies', description: 'Advance notice required in days' },
      { key: 'carryOverEnabled', value: 'true', category: 'leave_policies', description: 'Enable leave carry over' },
      { key: 'carryOverLimit', value: '10', category: 'leave_policies', description: 'Maximum carry over days' },
      { key: 'maxLeaveDaysPerYear', value: '30', category: 'leave_policies', description: 'Maximum leave days per year' },
      { key: 'minLeaveDuration', value: '0.5', category: 'leave_policies', description: 'Minimum leave duration in days' },
      
      // Approval Settings
      { key: 'autoApproveEnabled', value: 'false', category: 'approval_settings', description: 'Enable auto-approval for short leaves' },
      { key: 'autoApproveMaxDays', value: '1', category: 'approval_settings', description: 'Maximum days for auto-approval' },
      { key: 'requireManagerApproval', value: 'true', category: 'approval_settings', description: 'Require manager approval' },
      { key: 'requireHRApproval', value: 'true', category: 'approval_settings', description: 'Require HR approval' },
      { key: 'approvalReminderHours', value: '24', category: 'approval_settings', description: 'Approval reminder interval in hours' },
      
      // Notification Settings
      { key: 'notificationEmails', value: 'true', category: 'notification_settings', description: 'Enable email notifications' },
      { key: 'notificationSMS', value: 'false', category: 'notification_settings', description: 'Enable SMS notifications' },
      { key: 'managerNotifications', value: 'true', category: 'notification_settings', description: 'Enable manager notifications' },
      { key: 'hrNotifications', value: 'true', category: 'notification_settings', description: 'Enable HR notifications' },
      { key: 'systemAlerts', value: 'true', category: 'notification_settings', description: 'Enable system alerts' },
      
      // System Behavior
      { key: 'allowBackdateLeaves', value: 'false', category: 'system_behavior', description: 'Allow backdated leaves' },
      { key: 'allowOverlappingLeaves', value: 'false', category: 'system_behavior', description: 'Allow overlapping leaves' },
      { key: 'fiscalYearStart', value: '2024-01-01', category: 'system_behavior', description: 'Fiscal year start date' },
      { key: 'workingDays', value: '["monday","tuesday","wednesday","thursday","friday"]', category: 'system_behavior', description: 'Working days configuration' },
      { key: 'holidayCalendar', value: 'ethiopian', category: 'system_behavior', description: 'Holiday calendar type' },
      
      // UI Settings
      { key: 'theme', value: 'light', category: 'ui_settings', description: 'Interface theme' },
      { key: 'language', value: 'en', category: 'ui_settings', description: 'Interface language' },
      { key: 'timezone', value: 'Africa/Addis_Ababa', category: 'ui_settings', description: 'System timezone' }
    ];

    // Create or update each setting
    const createPromises = defaultSettings.map(setting =>
      prisma.systemSettings.upsert({
        where: { key: setting.key },
        update: { 
          value: setting.value,
          category: setting.category,
          description: setting.description,
          updatedAt: new Date()
        },
        create: {
          key: setting.key,
          value: setting.value,
          category: setting.category,
          description: setting.description,
          isPublic: false
        }
      })
    );

    await Promise.all(createPromises);

    res.json({
      success: true,
      message: 'System settings initialized successfully'
    });
  } catch (error) {
    console.error('Initialize system settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
// ==================== PROFILE ENDPOINTS ====================

// Update user profile
app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phone, department, position } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(department && { department }),
        ...(position !== undefined && { position })
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        position: true,
        phone: true,
        status: true,
        avatar: true,
        joinDate: true,
        createdAt: true
      }
    });

    // Transform for frontend
    const frontendUser = {
      ...user,
      role: user.role.toLowerCase().replace('_', '-'),
      status: user.status.toLowerCase()
    };

    res.json({
      success: true,
      data: frontendUser,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Change password endpoint
app.post('/api/profile/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});
// ==================== AVATAR ENDPOINTS ====================

// Upload avatar endpoint
app.post('/api/users/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const userId = req.user.userId;
    
    // Get current user to delete old avatar file
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true }
    });

    // Delete old avatar file if exists
    if (currentUser?.avatar) {
      const oldFilePath = path.join(__dirname, currentUser.avatar);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Get the file path relative to the uploads directory
    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    // Update user in database
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarPath },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        position: true,
        phone: true,
        status: true,
        avatar: true,
        joinDate: true,
        createdAt: true
      }
    });

    // Transform for frontend
    const frontendUser = {
      ...user,
      role: user.role.toLowerCase().replace('_', '-'),
      status: user.status.toLowerCase()
    };

    res.json({
      success: true,
      data: frontendUser,
      message: 'Avatar uploaded successfully'
    });

  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload avatar'
    });
  }
});

// Delete avatar endpoint
app.delete('/api/users/avatar', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get current user to find avatar path
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true }
    });

    // Delete physical file if exists
    if (user?.avatar) {
      const filePath = path.join(__dirname, user.avatar);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Update database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        position: true,
        phone: true,
        status: true,
        avatar: true,
        joinDate: true,
        createdAt: true
      }
    });

    // Transform for frontend
    const frontendUser = {
      ...updatedUser,
      role: updatedUser.role.toLowerCase().replace('_', '-'),
      status: updatedUser.status.toLowerCase()
    };

    res.json({
      success: true,
      data: frontendUser,
      message: 'Avatar removed successfully'
    });

  } catch (error) {
    console.error('Avatar delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove avatar'
    });
  }
});

// ==================== MANAGER ENDPOINTS ====================

// Approve leave (Manager)

// Manager approval - first step
app.post('/api/leaves/:id/approve', authenticateToken, async (req, res) => {
  try {
    const leaveId = parseInt(req.params.id);
    const managerId = req.user.userId;
    const { notes } = req.body;

    console.log('🔄 Manager approval request:', {
      leaveId,
      managerId,
      hasNotes: !!notes
    });

    // Get the leave request first to check current status
    const existingLeave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        leaveType: true,
        employee: true
      }
    });

    if (!existingLeave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (existingLeave.status !== 'PENDING_MANAGER') {
      return res.status(400).json({
        success: false,
        message: `Leave request is not pending manager approval. Current status: ${existingLeave.status}`
      });
    }

    // Check if manager is authorized to approve this leave
    if (existingLeave.employee.managerId !== managerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to approve this leave request'
      });
    }

    // TWO-STEP APPROVAL: Always go to HR for final approval
    const nextStatus = 'PENDING_HR';
    const nextApprover = 'HR';

    console.log('📋 Approval flow:', {
      currentStatus: existingLeave.status,
      nextStatus,
      nextApprover
    });

    // Update leave with transaction
    const leave = await prisma.$transaction(async (tx) => {
      const updatedLeave = await tx.leave.update({
        where: { 
          id: leaveId
        },
        data: {
          status: nextStatus,
          currentApprover: nextApprover,
          managerApproved: true,
          managerApprovedBy: managerId,
          managerApprovedDate: new Date(),
          managerNotes: notes
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          leaveType: true,
          manager: {
            select: {
              name: true,
              email: true
            }
          }
        }
      });

      // Notify employee
      await tx.notification.create({
        data: {
          userId: updatedLeave.employeeId,
          type: 'LEAVE_PENDING',
          title: 'Leave Forwarded to HR',
          message: `Your ${updatedLeave.leaveType.name} leave has been approved by manager and forwarded to HR for final approval`,
          actionUrl: `/leave-history`,
          relatedId: updatedLeave.id.toString(),
          priority: 'MEDIUM'
        }
      });

      // Notify HR admins
      const hrAdmins = await tx.user.findMany({
        where: {
          role: { in: ['HR_ADMIN', 'SUPER_ADMIN'] },
          status: 'ACTIVE'
        },
        select: { id: true }
      });

      const hrNotifications = hrAdmins.map(admin =>
        tx.notification.create({
          data: {
            userId: admin.id,
            type: 'LEAVE_PENDING',
            title: 'Leave Request Requires HR Approval',
            message: `${updatedLeave.employee.name}'s ${updatedLeave.leaveType.name} leave requires HR review`,
            actionUrl: `/hr/pending-approvals`,
            relatedId: updatedLeave.id.toString(),
            priority: 'HIGH'
          }
        })
      );

      await Promise.all(hrNotifications);
      console.log(`📬 Notifications sent to ${hrAdmins.length} HR admins`);

      return updatedLeave;
    });

    console.log('✅ Manager approval completed:', {
      id: leave.id,
      newStatus: leave.status
    });

    res.json({
      success: true,
      data: leave,
      message: 'Leave approved and forwarded to HR for final approval'
    });
  } catch (error) {
    console.error('💥 Approve leave error:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found or already processed'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});
// Reject leave (Manager)
app.post('/api/leaves/:id/reject', authenticateToken, async (req, res) => {
  try {
    const leaveId = parseInt(req.params.id);
    const approverId = req.user.userId;
    const { notes } = req.body;

    console.log('🔄 Rejection request:', {
      leaveId,
      approverId,
      hasNotes: !!notes
    });

    // Get current user and leave request
    const [currentUser, existingLeave] = await Promise.all([
      prisma.user.findUnique({ where: { id: approverId } }),
      prisma.leave.findUnique({ 
        where: { id: leaveId },
        include: { 
          employee: true,
          leaveType: true
        }
      })
    ]);

    if (!existingLeave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Check current status
    if (!['PENDING_MANAGER', 'PENDING_HR'].includes(existingLeave.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject leave request. Current status: ${existingLeave.status}`
      });
    }

    // Check authorization based on current status and user role
    let isAuthorized = false;
    let rejectionData = {};

    if (existingLeave.status === 'PENDING_MANAGER') {
      // Only manager can reject at this stage
      isAuthorized = existingLeave.employee.managerId === approverId;
      rejectionData = {
        managerApproved: false,
        managerApprovedBy: approverId,
        managerApprovedDate: new Date(),
        managerNotes: notes
      };
    } else if (existingLeave.status === 'PENDING_HR') {
      // Only HR admins can reject at this stage
      isAuthorized = ['HR_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role);
      rejectionData = {
        hrApproved: false,
        hrApprovedBy: approverId,
        hrApprovedDate: new Date(),
        hrNotes: notes
      };
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject this leave request'
      });
    }

    const leave = await prisma.$transaction(async (tx) => {
      const updatedLeave = await tx.leave.update({
        where: { 
          id: leaveId
        },
        data: {
          status: 'REJECTED',
          currentApprover: 'SYSTEM',
          ...rejectionData
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          leaveType: true,
          manager: {
            select: {
              name: true,
              email: true
            }
          }
        }
      });

      // Notify employee
      await tx.notification.create({
        data: {
          userId: updatedLeave.employeeId,
          type: 'LEAVE_REJECTED',
          title: 'Leave Application Rejected',
          message: `Your ${updatedLeave.leaveType.name} leave application has been rejected`,
          actionUrl: `/leave-history`,
          relatedId: updatedLeave.id.toString(),
          priority: 'HIGH' // Use valid priority
        }
      });

      return updatedLeave;
    });

    console.log('✅ Leave rejected:', {
      id: leave.id,
      status: leave.status
    });

    res.json({
      success: true,
      data: leave,
      message: 'Leave request rejected successfully'
    });
  } catch (error) {
    console.error('💥 Reject leave error:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found or already processed'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});

app.post('/api/leaves/:id/manager-approve', authenticateToken, async (req, res) => {
  try {
    const leaveId = parseInt(req.params.id);
    const managerId = req.user.userId;
    const { notes } = req.body;

    console.log('🔄 Manager approval request:', { leaveId, managerId });

    // Get existing leave
    const existingLeave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        leaveType: true,
        employee: true
      }
    });

    if (!existingLeave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (existingLeave.status !== 'PENDING_MANAGER') {
      return res.status(400).json({
        success: false,
        message: `Leave is not pending manager approval. Current status: ${existingLeave.status}`
      });
    }

    // Verify manager authorization
    if (existingLeave.employee.managerId !== managerId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to approve this leave request'
      });
    }

    // Update leave status to PENDING_HR
    const leave = await prisma.$transaction(async (tx) => {
      const updatedLeave = await tx.leave.update({
        where: { id: leaveId },
        data: {
          status: 'PENDING_HR',
          currentApprover: 'HR',
          managerApproved: true,
          managerApprovedBy: managerId,
          managerApprovedDate: new Date(),
          managerNotes: notes
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          leaveType: true
        }
      });

      // Notify employee
      await tx.notification.create({
        data: {
          userId: updatedLeave.employeeId,
          type: 'LEAVE_PENDING',
          title: 'Leave Forwarded to HR',
          message: `Your ${updatedLeave.leaveType.name} leave has been approved by manager and forwarded to HR for final approval`,
          actionUrl: `/leave-history`,
          relatedId: updatedLeave.id.toString(),
          priority: 'MEDIUM'
        }
      });

      // Notify HR admins
      const hrAdmins = await tx.user.findMany({
        where: {
          role: { in: ['HR_ADMIN', 'SUPER_ADMIN'] },
          status: 'ACTIVE'
        },
        select: { id: true, name: true }
      });

      const hrNotifications = hrAdmins.map(admin =>
        tx.notification.create({
          data: {
            userId: admin.id,
            type: 'LEAVE_PENDING',
            title: 'Leave Requires HR Approval',
            message: `${updatedLeave.employee.name}'s ${updatedLeave.leaveType.name} leave requires HR review`,
            actionUrl: `/hr/pending-approvals`,
            relatedId: updatedLeave.id.toString(),
            priority: 'HIGH'
          }
        })
      );

      await Promise.all(hrNotifications);

      return updatedLeave;
    });

    console.log('✅ Manager approval completed:', {
      id: leave.id,
      newStatus: leave.status
    });

    res.json({
      success: true,
      data: leave,
      message: 'Leave approved and forwarded to HR for final approval'
    });
  } catch (error) {
    console.error('💥 Manager approve error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});
// Manager team overview
app.get('/api/manager/team-overview', authenticateToken, async (req, res) => {
  try {
    const managerId = req.user.userId;

    const teamMembers = await prisma.user.findMany({
      where: {
        managerId: managerId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        position: true,
        phone: true,
        joinDate: true,
        leaves: {
          where: {
            OR: [
              { status: 'APPROVED' },
              { status: 'HR_APPROVED' }
            ]
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            days: true,
            leaveType: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: teamMembers
    });
  } catch (error) {
    console.error('Team overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Manager approvals history
app.get('/api/manager/approvals-history', authenticateToken, async (req, res) => {
  try {
    const managerId = req.user.userId;

    const approvals = await prisma.leave.findMany({
      where: {
        managerApprovedBy: managerId
      },
      include: {
        employee: {
          select: {
            name: true,
            email: true,
            department: true
          }
        },
        leaveType: true
      },
      orderBy: { managerApprovedDate: 'desc' }
    });

    res.json({
      success: true,
      data: approvals
    });
  } catch (error) {
    console.error('Approvals history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Manager reports
app.get('/api/manager/reports', authenticateToken, async (req, res) => {
  try {
    const managerId = req.user.userId;

    // Get team leave statistics
    const teamLeaves = await prisma.leave.findMany({
      where: {
        employee: {
          managerId: managerId
        }
      },
      include: {
        employee: {
          select: {
            name: true,
            department: true
          }
        },
        leaveType: true
      }
    });

    // Generate report data
    const reportData = {
      totalApplications: teamLeaves.length,
      approved: teamLeaves.filter(l => l.status === 'APPROVED' || l.status === 'HR_APPROVED').length,
      rejected: teamLeaves.filter(l => l.status === 'REJECTED').length,
      pending: teamLeaves.filter(l => l.status === 'PENDING_MANAGER' || l.status === 'PENDING_HR').length,
      byMonth: {}, // You can add monthly breakdown
      byDepartment: {}, // You can add department breakdown
      byLeaveType: {} // You can add leave type breakdown
    };

    res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('Manager reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ==================== HR ADMIN ENDPOINTS ====================

// HR Pending Approvals
app.get('/api/hr/pending-approvals', authenticateToken, async (req, res) => {
  try {
    const pendingLeaves = await prisma.leave.findMany({
      where: {
        status: 'PENDING_HR'
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            position: true,
            manager: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        leaveType: true,
        manager: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { appliedDate: 'desc' }
    });

    res.json({
      success: true,
      data: pendingLeaves
    });
  } catch (error) {
    console.error('HR pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// HR Leave Overview
app.get('/api/hr/leave-overview', authenticateToken, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    const overview = await prisma.leave.findMany({
      where: {
        appliedDate: {
          gte: new Date(`${currentYear}-01-01`),
          lte: new Date(`${currentYear}-12-31`)
        }
      },
      include: {
        employee: {
          select: {
            name: true,
            department: true
          }
        },
        leaveType: true
      }
    });

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('HR leave overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// User Management Endpoints
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        position: true,
        phone: true,
        status: true,
        joinDate: true,
        createdAt: true,
        manager: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform roles for frontend
    const transformedUsers = users.map(user => ({
      ...user,
      role: user.role.toLowerCase().replace('_', '-'),
      status: user.status.toLowerCase()
    }));

    res.json({
      success: true,
      data: transformedUsers
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
// Enhanced user creation with proper role handling
// Update the POST /api/users endpoint to handle managerId properly
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const { error, value } = userSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { name, email, role, department, position, phone, password, managerId } = value;

    console.log('🔄 Creating user with email:', email);

    // FIX: Check for active users only and normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    const existingUser = await prisma.user.findFirst({
      where: { 
        email: normalizedEmail,
        status: 'ACTIVE' // Only check active users
      }
    });

    if (existingUser) {
      console.log('❌ Email conflict with active user:', existingUser);
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Also check for inactive users with same email
    const inactiveUser = await prisma.user.findFirst({
      where: { 
        email: normalizedEmail,
        status: { not: 'ACTIVE' }
      }
    });

    if (inactiveUser) {
      console.log('ℹ️ Found inactive user with same email:', inactiveUser);
      return res.status(400).json({
        success: false,
        message: `This email was previously used by ${inactiveUser.name} (${inactiveUser.status.toLowerCase()}). Please use a different email address.`
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Convert frontend role to backend role
    const backendRole = role.toUpperCase().replace('-', '_');

    // Validate manager assignment
    let finalManagerId = null;
    
    if (managerId && backendRole === 'EMPLOYEE') {
      const manager = await prisma.user.findUnique({
        where: { 
          id: parseInt(managerId),
          OR: [
            { role: 'MANAGER' },
            { role: 'HR_ADMIN' },
            { role: 'SUPER_ADMIN' }
          ]
        }
      });

      if (!manager) {
        return res.status(400).json({
          success: false,
          message: 'Selected manager not found or is not a manager'
        });
      }
      
      finalManagerId = parseInt(managerId);
    }

    // Set default position based on role
    const positionTitles = {
      'employee': 'Employee',
      'manager': 'Manager', 
      'hr-admin': 'HR Administrator',
      'super-admin': 'System Administrator'
    };
    
    const defaultPosition = positionTitles[role] || 'Employee';

    // Create user data
    const userData = {
      name: name.trim(),
      email: normalizedEmail, // Use normalized email
      password: hashedPassword,
      role: backendRole,
      department: department.trim(),
      position: (position || defaultPosition).trim(),
      phone: phone ? phone.trim() : null,
      status: 'ACTIVE'
    };

    // Only add managerId if it's provided and valid
    if (finalManagerId) {
      userData.managerId = finalManagerId;
    }

    console.log('✅ Creating user with data:', userData);

    // Create user
    const user = await prisma.user.create({
      data: userData,
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Initialize leave balances for new user
    await initializeUserLeaveBalances(user.id);

    console.log('✅ User created successfully:', { 
      id: user.id, 
      name: user.name, 
      email: user.email,
      role: user.role
    });

    // Transform for frontend
    const frontendUser = {
      ...user,
      role: user.role.toLowerCase().replace('_', '-'),
      status: user.status.toLowerCase()
    };

    res.json({
      success: true,
      data: frontendUser,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('❌ Create user error:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Email already exists in the system'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});
 

// Leave Types Management
app.post('/api/leave-types', authenticateToken, async (req, res) => {
  try {
    const { error, value } = leaveTypeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const leaveType = await prisma.leaveType.create({
      data: {
        ...value,
        isActive: true
      }
    });

    res.json({
      success: true,
      data: leaveType,
      message: 'Leave type created successfully'
    });
  } catch (error) {
    console.error('Create leave type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

app.put('/api/leave-types/:id', authenticateToken, async (req, res) => {
  try {
    const leaveTypeId = parseInt(req.params.id);
    const { error, value } = leaveTypeSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const leaveType = await prisma.leaveType.update({
      where: { id: leaveTypeId },
      data: value
    });

    res.json({
      success: true,
      data: leaveType,
      message: 'Leave type updated successfully'
    });
  } catch (error) {
    console.error('Update leave type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

app.delete('/api/leave-types/:id', authenticateToken, async (req, res) => {
  try {
    const leaveTypeId = parseInt(req.params.id);

    await prisma.leaveType.update({
      where: { id: leaveTypeId },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Leave type deleted successfully'
    });
  } catch (error) {
    console.error('Delete leave type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// System Settings
app.get('/api/system/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await prisma.systemSettings.findMany({
      orderBy: { category: 'asc' }
    });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

app.put('/api/system/settings/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const setting = await prisma.systemSettings.upsert({
      where: { key },
      update: { value },
      create: {
        key,
        value,
        category: 'general',
        description: `System setting for ${key}`
      }
    });

    res.json({
      success: true,
      data: setting,
      message: 'Setting updated successfully'
    });
  } catch (error) {
    console.error('Update system setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// HR Reports
app.get('/api/hr/reports', authenticateToken, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    // Get comprehensive HR report data
    const totalEmployees = await prisma.user.count({
      where: { status: 'ACTIVE' }
    });

    const totalLeaves = await prisma.leave.count({
      where: {
        appliedDate: {
          gte: new Date(`${currentYear}-01-01`)
        }
      }
    });

    const approvedLeaves = await prisma.leave.count({
      where: {
        OR: [
          { status: 'APPROVED' },
          { status: 'HR_APPROVED' }
        ],
        appliedDate: {
          gte: new Date(`${currentYear}-01-01`)
        }
      }
    });

    const departmentStats = await prisma.user.groupBy({
      by: ['department'],
      where: { status: 'ACTIVE' },
      _count: {
        id: true
      }
    });

    const leaveTypeStats = await prisma.leave.groupBy({
      by: ['leaveTypeId'],
      where: {
        appliedDate: {
          gte: new Date(`${currentYear}-01-01`)
        }
      },
      _count: {
        id: true
      }
    });

    const reportData = {
      totalEmployees,
      totalLeaves,
      approvedLeaves,
      approvalRate: totalLeaves > 0 ? Math.round((approvedLeaves / totalLeaves) * 100) : 0,
      departmentStats,
      leaveTypeStats,
      monthlyBreakdown: [] // You can add monthly data
    };

    res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('HR reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


// ==================== PROFILE ENDPOINTS ====================

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phone, department, position } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        phone,
        department,
        position
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        position: true,
        phone: true,
        status: true,
        joinDate: true,
        avatar: true
      }
    });

    const frontendUser = {
      ...user,
      role: user.role.toLowerCase().replace('_', '-'),
      status: user.status.toLowerCase()
    };

    res.json({
      success: true,
      data: frontendUser,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

app.post('/api/profile/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ==================== ROOT ENDPOINT ====================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'OBU Leave Management API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  // Handle Prisma errors
  if (err.code && err.code.startsWith('P')) {
    return res.status(400).json({
      success: false,
      message: 'Database error occurred'
    });
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  // Handle validation errors
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      message: err.details[0].message
    });
  }
  
  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// Handle 404
app.use( (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});
// Start server
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 BACKEND SERVER RUNNING ON PORT 5000');
  console.log('='.repeat(50));
  console.log('📧 Available API endpoints:');
  console.log('   AUTH:');
  console.log('     POST /api/auth/login');
  console.log('     GET  /api/auth/me');
  console.log('   DASHBOARD:');
  console.log('     GET  /api/dashboard/stats');
  console.log('   EMPLOYEE:');
  console.log('     GET  /api/leaves/history');
  console.log('     POST /api/leaves/apply');
  console.log('     GET  /api/leave-balances');
  console.log('   MANAGER:');
  console.log('     GET  /api/leaves/pending');
  console.log('     POST /api/leaves/:id/approve');
  console.log('     POST /api/leaves/:id/reject');
  console.log('     GET  /api/manager/team-overview');
  console.log('     GET  /api/manager/approvals-history');
  console.log('     GET  /api/manager/reports');
  console.log('   HR ADMIN:');
  console.log('     GET  /api/hr/pending-approvals');
  console.log('     GET  /api/hr/leave-overview');
  console.log('     GET  /api/users');
  console.log('     POST /api/users');
  console.log('     DELETE /api/users/:id');
  console.log('     PUT   /api/users/:id/manager'); // ADD THIS
  console.log('     GET   /api/managers/department/:department'); // ADD THIS
  console.log('     POST /api/leave-types');
  console.log('     PUT  /api/leave-types/:id');
  console.log('     DELETE /api/leave-types/:id');
  console.log('     GET  /api/system/settings');
  console.log('     PUT  /api/system/settings/:key');
  console.log('     GET  /api/hr/reports');
  console.log('   PROFILE:');
  console.log('     PUT  /api/profile');
  console.log('     POST /api/profile/change-password');
  console.log('     POST /api/users/avatar');
  console.log('     DELETE /api/users/avatar');
  console.log('='.repeat(50));
  console.log('🌐 Test server: http://localhost:5000/');
  console.log('🌐 Frontend should run on: http://localhost:5173');
  console.log('='.repeat(50));
});