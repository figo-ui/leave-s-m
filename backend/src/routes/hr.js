// src/routes/hr.js
import express from 'express';
import { hrController } from '../controllers/hrController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireHR } from '../middleware/roleMiddleware.js';

const router = express.Router();

// HR specific endpoints
router.get('/pending-approvals', authenticateToken, requireHR, hrController.getHRPendingApprovals);
router.get('/leave-overview', authenticateToken, requireHR, hrController.getLeaveOverview);

export default router;