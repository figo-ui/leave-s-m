// src/routes/manager.js
import express from 'express';
import { managerController } from '../controllers/managerController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireManager } from '../middleware/roleMiddleware.js';

const router = express.Router();

// Manager specific endpoints
router.get('/team-overview', authenticateToken, requireManager, managerController.getTeamOverview);
router.get('/approvals-history', authenticateToken, requireManager, managerController.getApprovalsHistory);
router.get('/reports', authenticateToken, requireManager, managerController.getManagerReports);

export default router;