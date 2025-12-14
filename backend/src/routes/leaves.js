// src/routes/leaves.js
import express from 'express';
import { leaveController } from '../controllers/leaveController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Leave application and history
router.post('/apply', authenticateToken, leaveController.applyLeave);
router.get('/history', authenticateToken, leaveController.getLeaveHistory);
router.get('/pending', authenticateToken, leaveController.getPendingRequests);
router.get('/leave-balances', authenticateToken, leaveController.getLeaveBalances);

// Manager approvals
router.post('/:id/approve', authenticateToken, leaveController.approveLeave);
router.post('/:id/reject', authenticateToken, leaveController.rejectLeave);

// HR approvals
router.post('/:id/hr-approve', authenticateToken, leaveController.approveHRLeave);
router.post('/:id/hr-reject', authenticateToken, leaveController.rejectHRLeave);

export default router;