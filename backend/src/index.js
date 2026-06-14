require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const tradesRoutes = require('./routes/trades');
const exchangeRoutes = require('./routes/exchanges');
const journalRoutes = require('./routes/journal');
const analyticsRoutes = require('./routes/analytics');
const psychologyRoutes = require('./routes/psychology');
const goalsRoutes = require('./routes/goals');
const syncService = require('./services/syncService');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true);
    // Allow localhost and local network (192.168.x.x, 10.x.x.x, 172.x.x.x)
    if (
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.match(/^https?:\/\/192\.168\./) ||
      origin.match(/^https?:\/\/10\./) ||
      origin.match(/^https?:\/\/172\./)
    ) {
      return callback(null, true);
    }
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    callback(null, true); // dev mode — allow all
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 10000 : 200,
  message: { error: 'Слишком много запросов, попробуй позже' }
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/psychology', psychologyRoutes);
app.use('/api/goals', goalsRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Внутренняя ошибка сервера'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Trading Journal API запущен на порту ${PORT}`);
  
  // Start background sync every 5 minutes
  syncService.startAutoSync();
});
