// src/controllers/userController.js
import { prisma } from '../config/database.js';
import bcrypt from 'bcryptjs';

export const getUserProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        position: true,
        phone: true,
        joinDate: true,
        status: true,
        avatar: true,
        managerId: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get leave balances
    const currentYear = new Date().getFullYear();
    const leaveBalances = await prisma.leaveBalance.findMany({
      where: {
        userId: req.user.id,
        year: currentYear
      },
      include: {
        leaveType: true
      }
    });

    res.json({
      success: true,
      data: {
        user,
        leaveBalances
      }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user profile' 
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, department, position, currentPassword, newPassword } = req.body;

    const updateData = {
      name,
      phone,
      department,
      position,
      updatedAt: new Date()
    };

    // Handle password change if provided
    if (currentPassword && newPassword) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { password: true }
      });

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      updateData.password = await bcrypt.hash(newPassword, 12);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        position: true,
        phone: true,
        joinDate: true,
        status: true,
        avatar: true
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating profile' 
    });
  }
};

export const getTeamMembers = async (req, res) => {
  try {
    if (req.user.role !== 'MANAGER') {
      return res.status(403).json({
        success: false,
        message: 'Only managers can access team members'
      });
    }

    const teamMembers = await prisma.user.findMany({
      where: { 
        managerId: req.user.id,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        email: true,
        position: true,
        department: true,
        avatar: true
      }
    });

    // Get leave information for team members
    const teamWithLeaves = await Promise.all(
      teamMembers.map(async (member) => {
        const currentYear = new Date().getFullYear();
        const leaveBalances = await prisma.leaveBalance.findMany({
          where: {
            userId: member.id,
            year: currentYear
          },
          include: {
            leaveType: true
          }
        });

        const totalLeavesTaken = leaveBalances.reduce((sum, balance) => sum + balance.used, 0);
        const totalRemaining = leaveBalances.reduce((sum, balance) => sum + balance.remaining, 0);

        // Check if currently on leave
        const today = new Date();
        const onLeave = await prisma.leave.findFirst({
          where: {
            employeeId: member.id,
            status: 'APPROVED',
            startDate: { lte: today },
            endDate: { gte: today }
          }
        });

        return {
          ...member,
          leavesTaken: totalLeavesTaken,
          remainingLeaves: totalRemaining,
          onLeave: !!onLeave
        };
      })
    );

    res.json({
      success: true,
      data: teamWithLeaves
    });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching team members' 
    });
  }
};