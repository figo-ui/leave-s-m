// Add these methods to your existing leaveController

export const getEmployeeLeaveHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const where = { employeeId: req.user.id };
    if (status) where.status = status;
    
    const leaves = await prisma.leave.findMany({
      where,
      include: {
        leaveType: true,
        manager: { select: { name: true } },
        hrAdmin: { select: { name: true } }
      },
      orderBy: { appliedDate: 'desc' },
      skip: (page - 1) * parseInt(limit),
      take: parseInt(limit)
    });
    
    const total = await prisma.leave.count({ where });
    
    res.json({
      success: true,
      data: leaves,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get employee leave history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching leave history' 
    });
  }
};

export const getManagerPendingLeaves = async (req, res) => {
  try {
    // Get manager's team members
    const teamMembers = await prisma.user.findMany({
      where: { managerId: req.user.id },
      select: { id: true }
    });

    const teamMemberIds = teamMembers.map(member => member.id);

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
      orderBy: { appliedDate: 'asc' }
    });

    res.json({
      success: true,
      data: pendingLeaves
    });

  } catch (error) {
    console.error('Get manager pending leaves error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching pending leaves' 
    });
  }
};

export const getHRPendingLeaves = async (req, res) => {
  try {
    const pendingLeaves = await prisma.leave.findMany({
      where: {
        status: 'PENDING_HR'
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
        },
        manager: { select: { name: true } }
      },
      orderBy: { appliedDate: 'asc' }
    });

    res.json({
      success: true,
      data: pendingLeaves
    });

  } catch (error) {
    console.error('Get HR pending leaves error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching pending HR leaves' 
    });
  }
};