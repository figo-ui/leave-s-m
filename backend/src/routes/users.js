// Open and check src/routes/users.js - it should look like this:
import express from 'express';
import { userController } from '../controllers/userController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireHR } from '../middleware/roleMiddleware.js';

const router = express.Router();

// User management (HR only)
router.get('/', authenticateToken, requireHR, userController.getUsers);
router.post('/', authenticateToken, requireHR, userController.createUser);
router.get('/managers/department/:department', authenticateToken, userController.getManagersByDepartment);

export default router;