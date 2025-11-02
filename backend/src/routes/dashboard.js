import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getDashboardStats } from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/stats', authenticate, getDashboardStats);

export default router;