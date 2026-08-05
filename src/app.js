require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const { testConnection, sequelize } = require('./config/database');
const { initializeFirebase } = require('./config/firebase');
const { generalLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const socialRoutes = require('./routes/social.routes');
const postsRoutes = require('./routes/posts.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const mediaRoutes = require('./routes/media.routes');
const aiRoutes = require('./routes/ai.routes');
const adsRoutes = require('./routes/ads.routes');
const trendsRoutes = require('./routes/trends.routes');
const teamRoutes = require('./routes/team.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Core Middleware ─────────────────────────────────────

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Only log requests in development (I/O overhead in production)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use(generalLimiter);

// Compress all responses (gzip/deflate — ~60-80% smaller payloads)
app.use(compression({
  level: 6,
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress SSE or already-compressed responses
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// Track response time
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    res.set('X-Response-Time', `${Date.now() - start}ms`);
  });
  next();
});

// Parse JSON (except for Stripe webhooks which need raw body)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/subscriptions/webhook') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true }));

// ─── Static Files ────────────────────────────────────────

// Ensure uploads directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(path.resolve(uploadDir)));

// ─── Health Check ────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SocialFlow API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API Routes ──────────────────────────────────────────

const API_PREFIX = process.env.API_PREFIX || '/api';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/subscriptions`, subscriptionRoutes);
app.use(`${API_PREFIX}/social`, socialRoutes);
app.use(`${API_PREFIX}/posts`, postsRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${API_PREFIX}/media`, mediaRoutes);
app.use(`${API_PREFIX}/ai`, aiRoutes);
app.use(`${API_PREFIX}/ads`, adsRoutes);
app.use(`${API_PREFIX}/trends`, trendsRoutes);
app.use(`${API_PREFIX}/team`, teamRoutes);

// ─── Welcome Route ───────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    message: '🚀 SocialFlow API',
    version: '1.0.0',
    docs: `${API_PREFIX}/docs`,
    health: '/health',
    endpoints: {
      auth: `${API_PREFIX}/auth`,
      subscriptions: `${API_PREFIX}/subscriptions`,
      social: `${API_PREFIX}/social`,
      posts: `${API_PREFIX}/posts`,
      analytics: `${API_PREFIX}/analytics`,
      media: `${API_PREFIX}/media`,
    },
  });
});

// ─── Error Handling ──────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

// ─── Server Startup ──────────────────────────────────────

async function startServer() {
  try {
    // Initialize Firebase (optional — falls back to JWT)
    initializeFirebase();

    // Test database connection
    await testConnection();

    // Sync models (development only — use migrations in production)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Database synced (development mode).');
    }

    // Start listening
    app.listen(PORT, () => {
      console.log(`
  ╔══════════════════════════════════════════════╗
  ║                                              ║
  ║   🚀 SocialFlow API Server                   ║
  ║                                              ║
  ║   Port:    ${PORT}                              ║
  ║   Mode:    ${process.env.NODE_ENV || 'development'}                     ║
  ║   Health:  http://localhost:${PORT}/health       ║
  ║   API:     http://localhost:${PORT}${API_PREFIX}          ║
  ║                                              ║
  ╚══════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ───────────────────────────────────

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

startServer();

module.exports = app;