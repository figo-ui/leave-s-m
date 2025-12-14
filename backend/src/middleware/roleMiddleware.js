// src/middleware/roleMiddleware.js
export const requireHR = (req, res, next) => {
  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'HR admin access required'
    });
  }
  next();
};

export const requireManager = (req, res, next) => {
  if (!['MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Manager access required'
    });
  }
  next();
};