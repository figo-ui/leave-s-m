// src/routes/notifications.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead
} from '../controllers/notificationController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get('/', getNotifications);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);

export default router;