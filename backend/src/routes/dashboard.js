// src/routes/dashboard.js
import express from 'express';
import { dashboardController } from '../controllers/dashboardController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/stats', authenticateToken, dashboardController.getDashboardStats);

export default router;