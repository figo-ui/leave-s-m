import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

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

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const leaveSchema = Joi.object({
  leaveTypeId: Joi.number().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  reason: Joi.string().min(10).required()
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Backend is working!',
    timestamp: new Date().toISOString()
  });
});

// Auth endpoints
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

    // Find user with manager info
    const user = await prisma.user.findUnique({
      where: { email },
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
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
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
          manager: user.manager
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
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
    // Managers and HR can see all leaves in history endpoint

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

    // Calculate days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

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

    // Check balance
    const balance = await prisma.leaveBalance.findFirst({
      where: {
        userId,
        leaveTypeId,
        year: new Date().getFullYear()
      }
    });

    if (balance && days > balance.remainingDays) {
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. You have ${balance.remainingDays} days remaining.`
      });
    }

    // Determine initial status based on leave type requirements
    let initialStatus = 'PENDING_MANAGER';
    let currentApprover = 'MANAGER';

    // If leave type requires HR approval and user is not HR, set to PENDING_MANAGER first
    // HR approval will be needed after manager approval
    if (leaveType.requiresHRApproval) {
      initialStatus = 'PENDING_MANAGER';
      currentApprover = 'MANAGER';
    }

    // Create leave application
    const leave = await prisma.leave.create({
      data: {
        employeeId: userId,
        leaveTypeId,
        startDate: start,
        endDate: end,
        days,
        reason,
        status: initialStatus,
        currentApprover: currentApprover
      },
      include: {
        leaveType: true,
        employee: {
          select: {
            name: true,
            email: true,
            managerId: true
          }
        }
      }
    });

    // Create notification for manager if applicable
    if (initialStatus === 'PENDING_MANAGER' && leave.employee.managerId) {
      await prisma.notification.create({
        data: {
          userId: leave.employee.managerId,
          type: 'LEAVE_PENDING',
          title: 'New Leave Application',
          message: `${leave.employee.name} has applied for ${leaveType.name} leave`,
          actionUrl: `/pending-requests`,
          relatedId: leave.id.toString(),
          priority: 'MEDIUM'
        }
      });
    }

    res.json({
      success: true,
      data: leave,
      message: 'Leave application submitted successfully'
    });
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Leave types endpoint
app.get('/api/leave-types', authenticateToken, async (req, res) => {
  try {
    const leaveTypes = await prisma.leaveType.findMany({
      where: { 
        isActive: true
      }
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

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 BACKEND SERVER RUNNING ON PORT 5000');
  console.log('='.repeat(50));
  console.log('📧 Using your existing comprehensive schema');
  console.log('='.repeat(50));
});