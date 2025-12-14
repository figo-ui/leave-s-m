// Request logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  console.log(`📥 ${req.method} ${req.originalUrl} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logMessage = `📤 ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`;
    
    // Color code based on status
    if (res.statusCode >= 500) {
      console.error(`❌ ${logMessage}`);
    } else if (res.statusCode >= 400) {
      console.warn(`⚠️ ${logMessage}`);
    } else if (res.statusCode >= 300) {
      console.log(`🔀 ${logMessage}`);
    } else {
      console.log(`✅ ${logMessage}`);
    }

    // Log slow requests
    if (duration > 1000) {
      console.warn(`🐌 SLOW REQUEST: ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });

  next();
};