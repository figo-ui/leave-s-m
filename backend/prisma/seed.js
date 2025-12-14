// prisma/seed.js
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // 1. Create Super Admin (HR + Admin role)
  const superAdminPassword = await bcrypt.hash('admin123', 10)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@obu.edu.et' },
    update: {},
    create: {
      email: 'admin@obu.edu.et',
      password: superAdminPassword,
      name: 'System Administrator',
      role: 'SUPER_ADMIN',
      department: 'Administration',
      position: 'System Administrator',
      phone: '+251911111111',
      status: 'ACTIVE'
    }
  })
  console.log('✅ Created Super Admin:', superAdmin.email)

  // 2. Create HR Admin
  const hrAdminPassword = await bcrypt.hash('hr123456', 10) // Fixed: 8 characters
  const hrAdmin = await prisma.user.upsert({
    where: { email: 'hr@obu.edu.et' },
    update: {},
    create: {
      email: 'hr@obu.edu.et',
      password: hrAdminPassword,
      name: 'HR Manager',
      role: 'HR_ADMIN',
      department: 'Human Resources',
      position: 'HR Manager',
      phone: '+251911111112',
      status: 'ACTIVE'
    }
  })
  console.log('✅ Created HR Admin:', hrAdmin.email)

  // 3. Create Department Managers
  const departments = [
    { name: 'Computer Science', managerName: 'Dr. Abebe Kebede' },
    { name: 'Business', managerName: 'Dr. Mesfin Tadesse' },
    { name: 'Engineering', managerName: 'Dr. Selamawit Mekonnen' }
  ]

  const managers = []
  for (let i = 0; i < departments.length; i++) {
    const dept = departments[i]
    const password = await bcrypt.hash(`manager${i+1}123`, 10) // Fixed: 10+ characters
    
    const manager = await prisma.user.upsert({
      where: { email: `${dept.name.toLowerCase().replace(/\s+/g, '')}@obu.edu.et` },
      update: {},
      create: {
        email: `${dept.name.toLowerCase().replace(/\s+/g, '')}@obu.edu.et`,
        password,
        name: dept.managerName,
        role: 'MANAGER',
        department: dept.name,
        position: 'Department Head',
        phone: `+25192222${1000 + i}`,
        status: 'ACTIVE'
      }
    })
    managers.push(manager)
    console.log(`✅ Created Manager: ${manager.name} (${dept.name})`)
  }

  // 4. Create Sample Employees
  const employees = []
  for (let i = 0; i < 10; i++) {
    const deptIndex = i % departments.length
    const department = departments[deptIndex].name
    const managerId = managers[deptIndex].id
    
    const password = await bcrypt.hash(`employee${i+1}123`, 10) // Fixed: 11+ characters
    
    const employee = await prisma.user.create({
      data: {
        email: `employee${i+1}@obu.edu.et`,
        password,
        name: `Employee ${i+1}`,
        role: 'EMPLOYEE',
        department,
        position: i % 2 === 0 ? 'Lecturer' : 'Assistant Lecturer',
        phone: `+25193333${1000 + i}`,
        status: 'ACTIVE',
        managerId
      }
    })
    employees.push(employee)
    console.log(`✅ Created Employee: ${employee.name} (${department})`)
  }

  // 5. Create Leave Types
  const leaveTypes = [
    {
      name: 'Annual Leave',
      maxDays: 30,
      description: 'Annual vacation leave',
      color: '#3B82F6',
      requiresHRApproval: true,
      carryOver: true,
      requiresApproval: true,
      isActive: true
    },
    {
      name: 'Sick Leave',
      maxDays: 15,
      description: 'Medical leave with doctor certificate',
      color: '#10B981',
      requiresHRApproval: false,
      carryOver: false,
      requiresApproval: true,
      isActive: true
    },
    {
      name: 'Maternity Leave',
      maxDays: 120,
      description: 'Maternity leave for new mothers',
      color: '#EC4899',
      requiresHRApproval: true,
      carryOver: false,
      requiresApproval: true,
      isActive: true
    },
    {
      name: 'Paternity Leave',
      maxDays: 7,
      description: 'Paternity leave for new fathers',
      color: '#8B5CF6',
      requiresHRApproval: false,
      carryOver: false,
      requiresApproval: true,
      isActive: true
    },
    {
      name: 'Emergency Leave',
      maxDays: 5,
      description: 'Emergency or compassionate leave',
      color: '#F59E0B',
      requiresHRApproval: false,
      carryOver: false,
      requiresApproval: true,
      isActive: true
    },
    {
      name: 'Study Leave',
      maxDays: 30,
      description: 'Leave for academic purposes',
      color: '#8B5CF6',
      requiresHRApproval: true,
      carryOver: false,
      requiresApproval: true,
      isActive: true
    }
  ]

  const createdLeaveTypes = []
  for (const lt of leaveTypes) {
    const leaveType = await prisma.leaveType.upsert({
      where: { name: lt.name },
      update: {},
      create: lt
    })
    createdLeaveTypes.push(leaveType)
    console.log(`✅ Created Leave Type: ${leaveType.name}`)
  }

  // 6. Initialize Leave Balances for all users
  const allUsers = [superAdmin, hrAdmin, ...managers, ...employees]
  const currentYear = new Date().getFullYear()
  
  console.log(`📊 Initializing leave balances for ${allUsers.length} users...`)
  
  for (const user of allUsers) {
    for (const leaveType of createdLeaveTypes) {
      try {
        await prisma.leaveBalance.upsert({
          where: {
            userId_leaveTypeId_year: {
              userId: user.id,
              leaveTypeId: leaveType.id,
              year: currentYear
            }
          },
          update: {
            totalDays: leaveType.maxDays,
            remainingDays: {
              // Calculate remaining days based on leave type max days
              set: leaveType.maxDays
            }
          },
          create: {
            userId: user.id,
            leaveTypeId: leaveType.id,
            totalDays: leaveType.maxDays,
            usedDays: 0,
            remainingDays: leaveType.maxDays,
            year: currentYear
          }
        })
      } catch (error) {
        console.log(`⚠️ Error creating balance for ${user.name} - ${leaveType.name}:`, error.message)
      }
    }
    console.log(`✅ Initialized leave balances for: ${user.name}`)
  }

  // 7. Create System Settings
  const defaultSettings = [
    { 
      key: 'maxConsecutiveLeaves', 
      value: '15', 
      category: 'leave_policies', 
      description: 'Maximum consecutive leave days allowed',
      isPublic: false
    },
    { 
      key: 'advanceNoticeDays', 
      value: '3', 
      category: 'leave_policies', 
      description: 'Advance notice required in days',
      isPublic: true
    },
    { 
      key: 'allowBackdateLeaves', 
      value: 'false', 
      category: 'leave_policies', 
      description: 'Allow backdated leaves',
      isPublic: false
    },
    { 
      key: 'notificationEmails', 
      value: 'true', 
      category: 'notification_settings', 
      description: 'Enable email notifications',
      isPublic: true
    },
    { 
      key: 'systemTimezone', 
      value: 'Africa/Addis_Ababa', 
      category: 'system_settings', 
      description: 'System timezone',
      isPublic: true
    },
    { 
      key: 'workingDays', 
      value: '["Monday","Tuesday","Wednesday","Thursday","Friday"]', 
      category: 'system_settings', 
      description: 'Working days',
      isPublic: true
    },
    { 
      key: 'fiscalYearStart', 
      value: 'January', 
      category: 'system_settings', 
      description: 'Fiscal year start month',
      isPublic: true
    },
    { 
      key: 'defaultLeaveDays', 
      value: '20', 
      category: 'leave_policies', 
      description: 'Default annual leave days',
      isPublic: true
    }
  ]

  for (const setting of defaultSettings) {
    await prisma.systemSettings.upsert({
      where: { key: setting.key },
      update: {},
      create: setting
    })
  }
  console.log('✅ Created system settings')

  // 8. Create some sample leave requests for testing
  console.log('📝 Creating sample leave requests...')
  
  // Get current date for sample leaves
  const today = new Date()
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)
  
  const twoWeeksLater = new Date(today)
  twoWeeksLater.setDate(today.getDate() + 14)
  
  // Create a few sample leave requests
  const sampleLeaves = [
    {
      employeeId: employees[0].id,
      leaveTypeId: createdLeaveTypes[0].id, // Annual Leave
      startDate: nextWeek,
      endDate: new Date(nextWeek.getTime() + 4 * 24 * 60 * 60 * 1000), // +4 days
      days: 5,
      reason: 'Annual vacation with family to visit relatives',
      status: 'HR_APPROVED',
      currentApprover: 'SYSTEM',
      managerApproved: true,
      managerApprovedBy: employees[0].managerId,
      managerApprovedDate: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      hrApproved: true,
      hrApprovedBy: hrAdmin.id,
      hrApprovedDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      appliedDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
    },
    {
      employeeId: employees[1].id,
      leaveTypeId: createdLeaveTypes[1].id, // Sick Leave
      startDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      endDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      days: 2,
      reason: 'Medical appointment and recovery after minor surgery',
      status: 'APPROVED',
      currentApprover: 'HR',
      managerApproved: true,
      managerApprovedBy: employees[1].managerId,
      managerApprovedDate: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      appliedDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    },
    {
      employeeId: employees[2].id,
      leaveTypeId: createdLeaveTypes[4].id, // Emergency Leave
      startDate: twoWeeksLater,
      endDate: new Date(twoWeeksLater.getTime() + 1 * 24 * 60 * 60 * 1000), // +1 day
      days: 2,
      reason: 'Family emergency - need to attend to urgent family matter',
      status: 'PENDING_MANAGER',
      currentApprover: 'MANAGER',
      appliedDate: today
    },
    {
      employeeId: employees[3].id,
      leaveTypeId: createdLeaveTypes[2].id, // Maternity Leave
      startDate: new Date(today.getFullYear(), today.getMonth() + 1, 1), // 1st of next month
      endDate: new Date(today.getFullYear(), today.getMonth() + 5, 1), // 4 months later
      days: 120,
      reason: 'Maternity leave for childbirth and postnatal care',
      status: 'PENDING_HR',
      currentApprover: 'HR',
      managerApproved: true,
      managerApprovedBy: employees[3].managerId,
      managerApprovedDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      appliedDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)
    }
  ]

  for (const leaveData of sampleLeaves) {
    await prisma.leave.create({
      data: leaveData
    })
    console.log(`✅ Created leave request for Employee ${leaveData.employeeId}: ${leaveData.reason.substring(0, 30)}...`)
  }

  // 9. Create some notifications
  console.log('🔔 Creating sample notifications...')
  
  const notifications = [
    {
      userId: employees[0].id,
      type: 'LEAVE_APPROVED',
      title: 'Leave Approved',
      message: 'Your Annual Leave has been approved',
      actionUrl: '/leave-history',
      relatedId: '1',
      priority: 'MEDIUM',
      isRead: false
    },
    {
      userId: managers[0].id,
      type: 'LEAVE_PENDING',
      title: 'Leave Request Pending',
      message: 'Employee 3 has submitted a leave request',
      actionUrl: '/pending-requests',
      relatedId: '3',
      priority: 'HIGH',
      isRead: false
    },
    {
      userId: hrAdmin.id,
      type: 'LEAVE_PENDING',
      title: 'HR Approval Required',
      message: 'Maternity leave request requires HR review',
      actionUrl: '/hr/pending-approvals',
      relatedId: '4',
      priority: 'HIGH',
      isRead: false
    }
  ]

  for (const notification of notifications) {
    await prisma.notification.create({
      data: notification
    })
  }
  console.log('✅ Created sample notifications')

  console.log('\n' + '='.repeat(50))
  console.log('🎉 Database seeding completed successfully!')
  console.log('='.repeat(50))
  console.log('\n📋 Login Credentials:')
  console.log('   👑 Super Admin: admin@obu.edu.et / admin123')
  console.log('   👥 HR Admin: hr@obu.edu.et / hr123456')
  console.log('   👨‍💼 Managers:')
  console.log('     - computerscience@obu.edu.et / manager1123')
  console.log('     - business@obu.edu.et / manager2123')
  console.log('     - engineering@obu.edu.et / manager3123')
  console.log('   👨‍🏫 Employees:')
  for (let i = 0; i < 3; i++) {
    console.log(`     - employee${i+1}@obu.edu.et / employee${i+1}123`)
  }
  console.log('     ... and 7 more employees')
  console.log('\n⚠️ All passwords meet the 6-character minimum requirement')
  console.log('='.repeat(50))
}

main()
  .catch((e) => {
    console.error('💥 Seeding error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })