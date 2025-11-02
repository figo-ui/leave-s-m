import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { getUsers, createUser, updateUser } from '../controllers/userController.js';

const router = express.Router();

router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { department: true, manager: { select: { name: true } } }
    });
    
    res.json({ success: true, data: { user } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
});

router.get('/', authenticate, authorize('HR_ADMIN'), getUsers);
router.post('/', authenticate, authorize('HR_ADMIN'), createUser);
router.put('/:id', authenticate, authorize('HR_ADMIN'), updateUser);

export default router;