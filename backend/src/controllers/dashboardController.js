import { prisma } from '../config/database.js';

export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const currentYear = new Date().getFullYear();
    const today = new Date();
    
    console.log(`📊 Loading dashboard stats for ${userRole} user ${userId}`);

    let stats = {};

    if (userRole === 'EMPLOYEE') {
      stats = await getEmployeeStats(userId, currentYear, today);
    } else if (userRole === 'MANAGER') {
      stats = await getManagerStats(userId, currentYear, today);
    } else if (userRole === 'HR_ADMIN') {
      stats = await getHRAdminStats(currentYear, today);
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching dashboard stats' 
    });
  }
};

// Employee Dashboard Stats
const getEmployeeStats = async (userId, currentYear, today) => {
  // Get pending requests
  const pendingRequests = await prisma.leave.count({
    where: { 
      employeeId: userId,
      status: { in: ['PENDING_MANAGER', 'PENDING_HR'] }
    }
  });

  // Get leaves taken this year
  const leavesTaken = await prisma.leave.count({
    where: { 
      employeeId: userId,
      status: 'APPROVED',
      startDate: {
        gte: new Date(currentYear, 0, 1), // Start of year
        lte: new Date(currentYear, 11, 31) // End of year
      }
    }
  });

  // Get leave balance
  const leaveBalance = await prisma.leaveBalance.findMany({
    where: { 
      userId: userId,
      year: currentYear
    },
    include: {
      leaveType: true
    }
  });

  // Calculate total available leaves
  const availableLeaves = leaveBalance.reduce((total, balance) => {
    return total + balance.remainingDays;
  }, 0);

  // Get recent activities (last 5 leaves)
  const recentActivities = await prisma.leave.findMany({
    where: { employeeId: userId },
    include: {
      leaveType: true,
      manager: { select: { name: true } },
      hrAdmin: { select: { name: true } }
    },
    orderBy: { appliedDate: 'desc' },
    take: 5
  });

  return {
    pendingRequests,
    leavesTaken,
    availableLeaves,
    leaveBalance,
    recentActivities: recentActivities.map(activity => ({
      id: activity.id,
      leaveType: activity.leaveType,
      days: activity.days,
      status: activity.status,
      appliedDate: activity.appliedDate,
      startDate: activity.startDate,
      endDate: activity.endDate
    }))
  };
};

// Manager Dashboard Stats
const getManagerStats = async (managerId, currentYear, today) => {
  // Get team members
  const teamMembers = await prisma.user.findMany({
    where: { managerId: managerId },
    select: { id: true }
  });

  const teamMemberIds = teamMembers.map(member => member.id);

  // Get pending requests from team
  const pendingRequests = await prisma.leave.count({
    where: { 
      employeeId: { in: teamMemberIds },
      status: 'PENDING_MANAGER'
    }
  });

  // Get team members on leave today
  const teamOnLeave = await prisma.leave.count({
    where: {
      employeeId: { in: teamMemberIds },
      status: 'APPROVED',
      startDate: { lte: today },
      endDate: { gte: today }
    }
  });

  // Get approvals this month
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const approvedThisMonth = await prisma.leave.count({
    where: {
      employeeId: { in: teamMemberIds },
      status: { in: ['APPROVED', 'PENDING_HR'] },
      appliedDate: { gte: thisMonthStart }
    }
  });

  // Calculate approval rate (last 30 days)
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentDecisions = await prisma.leave.findMany({
    where: {
      employeeId: { in: teamMemberIds },
      OR: [
        { managerApprovedDate: { gte: thirtyDaysAgo } },
        { hrApprovedDate: { gte: thirtyDaysAgo } }
      ]
    },
    select: { status: true }
  });

  const approvedCount = recentDecisions.filter(decision => 
    decision.status === 'APPROVED'
  ).length;
  
  const approvalRate = recentDecisions.length > 0 ? 
    Math.round((approvedCount / recentDecisions.length) * 100) : 0;

  // Get pending leaves for activities
  const pendingLeaves = await prisma.leave.findMany({
    where: { 
      employeeId: { in: teamMemberIds },
      status: 'PENDING_MANAGER'
    },
    include: {
      leaveType: true,
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          position: true
        }
      }
    },
    orderBy: { appliedDate: 'desc' },
    take: 5
  });

  return {
    pendingRequests,
    teamOnLeave,
    teamSize: teamMemberIds.length,
    approvedThisMonth,
    approvalRate,
    recentActivities: pendingLeaves
  };
};

// HR Admin Dashboard Stats
const getHRAdminStats = async (currentYear, today) => {
  // Total employees
  const totalEmployees = await prisma.user.count({
    where: { status: 'ACTIVE' }
  });

  // Employees on leave today
  const onLeaveToday = await prisma.leave.count({
    where: {
      status: 'APPROVED',
      startDate: { lte: today },
      endDate: { gte: today }
    }
  });

  // Pending HR approvals
  const pendingApprovals = await prisma.leave.count({
    where: { 
      status: 'PENDING_HR'
    }
  });

  // Pending manager approvals (for system alerts)
  const pendingManagerApprovals = await prisma.leave.count({
    where: { 
      status: 'PENDING_MANAGER'
    }
  });

  // System alerts calculation
  const systemAlerts = await calculateSystemAlerts();

  // Recent activities (all leaves)
  const recentActivities = await prisma.leave.findMany({
    include: {
      leaveType: true,
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          position: true
        }
      },
      manager: { select: { name: true } },
      hrAdmin: { select: { name: true } }
    },
    orderBy: { appliedDate: 'desc' },
    take: 6
  });

  // Overall statistics
  const totalApplications = await prisma.leave.count();
  const approvedApplications = await prisma.leave.count({
    where: { status: 'APPROVED' }
  });

  return {
    totalEmployees,
    onLeaveToday,
    pendingApprovals,
    systemAlerts: systemAlerts.length,
    pendingManagerApprovals,
    recentActivities,
    overallStats: {
      total: totalApplications,
      approved: approvedApplications,
      approvalRate: totalApplications > 0 ? 
        Math.round((approvedApplications / totalApplications) * 100) : 0
    },
    systemAlertsList: systemAlerts
  };
};

// Calculate system alerts for HR dashboard
const calculateSystemAlerts = async () => {
  const alerts = [];
  const today = new Date();
  const currentYear = today.getFullYear();

  // Check for users with low leave balance
  const lowBalanceUsers = await prisma.leaveBalance.findMany({
    where: {
      year: currentYear,
      remainingDays: { lt: 5 }
    },
    include: {
      user: { select: { name: true, email: true } },
      leaveType: true
    }
  });

  if (lowBalanceUsers.length > 0) {
    alerts.push({
      type: 'warning',
      message: `${lowBalanceUsers.length} users have low leave balance`,
      count: lowBalanceUsers.length,
      details: lowBalanceUsers.map(user => ({
        name: user.user.name,
        leaveType: user.leaveType.name,
        remaining: user.remainingDays
      }))
    });
  }

  // Check for pending approvals older than 7 days
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const oldPendingLeaves = await prisma.leave.count({
    where: {
      status: { in: ['PENDING_MANAGER', 'PENDING_HR'] },
      appliedDate: { lte: weekAgo }
    }
  });

  if (oldPendingLeaves > 0) {
    alerts.push({
      type: 'warning',
      message: `${oldPendingLeaves} leave applications pending for over 7 days`,
      count: oldPendingLeaves
    });
  }

  // System info alert
  alerts.push({
    type: 'info',
    message: 'System operating normally',
    count: 1
  });

  return alerts;
};