const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
require("dotenv").config();


const app = express();
const server = http.createServer(app); // Use this instead of app.listen
const setupSocket = require("./src/Utils/socket");
const { recordRequestMetric } = require('./src/Utils/metrics');


app.use(
  cors({
    origin: "*", // allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true, // allow cookies if needed
  })
);

// Simple response-time monitoring middleware
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    try {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      recordRequestMetric({
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs,
      });
      if (process.env.LOG_REQUEST_TIME === 'true') {
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs.toFixed(1)}ms`);
      }
    } catch (_) {}
  });
  next();
});

// Use raw body for Razorpay webhook route to preserve signature integrity
// For Razorpay webhook: capture raw body while still parsing JSON
app.use('/api/v1/products/verify-signature', express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Import routes
const userRoutes = require("./src/Routes/UserRoutes/userRoutes");
const productRoutes = require("./src/Routes/ProductRoutes/productRoutes");
const superAdminRoutes = require("./src/Routes/adminRoutes/superAdminRoutes");
const coachSellerRoutes = require("./src/Routes/CoachSellerRoute/coachSeller");
const exerciseRoutes = require("./src/Routes/ExerciseRoutes/exercise");
const userExerciseRoutes = require("./src/Routes/ExerciseRoutes/userExercise");
const aiWorkoutPlanner = require("./src/Routes/ExerciseRoutes/aiFeatures");
const calculateBmi = require("./src/Routes/BmiCalulator/bmi");
const nutritionRoutes = require("./src/Routes/NutirtionRoutes/nutrition");
const aiNutritionPlanner = require("./src/Routes/NutirtionRoutes/aiNutrition");
const cartRoutes = require("./src/Routes/ProductRoutes/cart");
const coachingSessionRoutes = require("./src/Routes/CoachingSessionRoutes/coahingSession");
const coachManagerRoutes = require("./src/Routes/CoachManagerRoutes/coachManager");

app.use("/api/v1/user", userRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/superadmin", superAdminRoutes);
app.use("/api/v1/coach", coachSellerRoutes);
app.use("/api/v1/coach-manager", coachManagerRoutes);
app.use("/api/v1/exercise", exerciseRoutes);
app.use("/api/v1/user-exercise", userExerciseRoutes);
app.use("/api/v1/ai-workout", aiWorkoutPlanner);
app.use("/api/v1/bmi", calculateBmi);
app.use("/api/v1/nutrition", nutritionRoutes);
app.use("/api/v1/ai-nutrition", aiNutritionPlanner);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/coaching-session", coachingSessionRoutes);

// DB Connection
const { connectDB } = require("./src/Config/DbConnection");
connectDB();

// Initialize Socket.io
setupSocket(server);

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      error: err.message,
      details: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      error: `Invalid ${err.path}: ${err.value}`
    });
  }
  
  if (err.name === 'MongoError' && err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate field value',
      error: 'A record with this value already exists'
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: 'Please log in again'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      error: 'Please log in again'
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : 'Something went wrong'
  });
});

// 404 handler for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', err);
  // Don't exit the process, just log the error
});

// Uncaught exception handler
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Gracefully shutdown the server
  server.close(() => {
    console.log('Server closed due to uncaught exception');
    process.exit(1);
  });
});

server.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
