import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.user.deleteMany({});
  await prisma.leaveType.deleteMany({});

  // Create leave types
  const leaveTypes = await prisma.leaveType.createMany({
    data: [
      {
        name: 'Annual Leave',
        description: 'Paid time off for vacation',
        maxDays: 18,
        requiresHRApproval: false,
        color: '#3498db',
        isActive: true
      },
      {
        name: 'Sick Leave',
        description: 'Leave for health reasons',
        maxDays: 10,
        requiresHRApproval: false,
        color: '#e74c3c',
        isActive: true
      }
    ],
  });

  // Create users with SIMPLE passwords for testing
  const hrAdmin = await prisma.user.create({
    data: {
      employeeId: 'OBU001',
      email: 'hr@bultum.edu.et',
      password: await bcrypt.hash('password123', 12), // Use bcrypt with reasonable rounds
      name: 'HR Administrator',
      role: 'HR_ADMIN',
      department: 'Human Resources',
      position: 'HR Manager',
      phone: '+251911223344',
      status: 'ACTIVE',
      joinDate: new Date('2020-01-15')
    }
  });

  const manager = await prisma.user.create({
    data: {
      employeeId: 'OBU002',
      email: 'manager@bultum.edu.et',
      password: await bcrypt.hash('password123', 12),
      name: 'Department Manager',
      role: 'MANAGER',
      department: 'Computer Science',
      position: 'Department Head',
      phone: '+251922334455',
      status: 'ACTIVE',
      joinDate: new Date('2019-03-20')
    }
  });

  const employee = await prisma.user.create({
    data: {
      employeeId: 'OBU003',
      email: 'employee@bultum.edu.et',
      password: await bcrypt.hash('password123', 12),
      name: 'John Doe',
      role: 'EMPLOYEE',
      department: 'Computer Science',
      position: 'Software Developer',
      phone: '+251933445566',
      managerId: manager.id,
      status: 'ACTIVE',
      joinDate: new Date('2023-01-10')
    }
  });

  console.log('✅ Database seeded successfully!');
  console.log('📧 Login credentials:');
  console.log('   HR Admin: hr@bultum.edu.et / password123');
  console.log('   Manager: manager@bultum.edu.et / password123');
  console.log('   Employee: employee@bultum.edu.et / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });