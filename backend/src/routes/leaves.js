import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  applyLeave,
  getLeaveHistory,
  getPendingLeaves,
  approveLeave,
  getLeaveTypes,
  getEmployeeLeaveHistory,
  getManagerPendingLeaves,
  getHRPendingLeaves
} from '../controllers/leaveController.js';

const router = express.Router();

// Employee routes
router.post('/apply', authenticate, applyLeave);
router.get('/history', authenticate, getEmployeeLeaveHistory); // Updated
router.get('/my-leaves', authenticate, getEmployeeLeaveHistory); // Alias

// Manager routes
router.get('/pending', authenticate, authorize('MANAGER', 'HR_ADMIN'), getManagerPendingLeaves); // Updated
router.get('/manager/pending', authenticate, authorize('MANAGER'), getManagerPendingLeaves);

// HR Admin routes
router.get('/hr/pending', authenticate, authorize('HR_ADMIN'), getHRPendingLeaves);
router.put('/:id/approve', authenticate, authorize('MANAGER', 'HR_ADMIN'), approveLeave);

// Common routes
router.get('/types', authenticate, getLeaveTypes);

export default router;