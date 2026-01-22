const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const setupSocket = require("./src/Utils/socket");
const { recordRequestMetric } = require("./src/Utils/metrics");
const { connectDB } = require("./src/Config/DbConnection");

/* =========================================================
   ✅ CORS
========================================================= */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  })
);

/* =========================================================
   ✅ Request-time monitoring middleware
========================================================= */
app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    try {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;

      recordRequestMetric({
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs,
      });

      if (process.env.LOG_REQUEST_TIME === "true") {
        console.log(
          `${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs.toFixed(
            1
          )}ms`
        );
      }
    } catch (_) {}
  });

  next();
});

/* =========================================================
   ✅ Webhook raw-body route (must be BEFORE global express.json)
   - Razorpay/Stripe signature verification requires exact raw body
========================================================= */
app.use(
  "/api/v1/webhooks/payment",
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

/* =========================================================
   ✅ Parsers
========================================================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   ✅ Static files
========================================================= */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* =========================================================
   ✅ Health check
========================================================= */
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

/* =========================================================
   ✅ ROUTES IMPORTS
========================================================= */

// Existing (your current working modules)
const userRoutes = require("./src/Routes/UserRoutes/userRoutes");
const superAdminRoutes = require("./src/Routes/adminRoutes/superAdminRoutes");
const coachSellerRoutes = require("./src/Routes/CoachSellerRoute/coachSeller");
const exerciseRoutes = require("./src/Routes/ExerciseRoutes/exercise");
const userExerciseRoutes = require("./src/Routes/ExerciseRoutes/userExercise");
const aiWorkoutPlanner = require("./src/Routes/ExerciseRoutes/aiFeatures");
const calculateBmi = require("./src/Routes/BmiCalulator/bmi");
const nutritionRoutes = require("./src/Routes/NutirtionRoutes/nutrition");
const aiNutritionPlanner = require("./src/Routes/NutirtionRoutes/aiNutrition");
const coachingSessionRoutes = require("./src/Routes/CoachingSessionRoutes/coahingSession");
const coachManagerRoutes = require("./src/Routes/CoachManagerRoutes/coachManager");

// ✅ Product Module (new clean structure)
// (If your files are in different folder, update paths accordingly)
const categoryRoutes = require("./src/Routes/ProductRoutes/category.routes");
const subcategoryRoutes = require("./src/Routes/ProductRoutes/subcategory.routes");
const productRoutes = require("./src/Routes/ProductRoutes/product.routes");
const cartRoutes = require("./src/Routes/ProductRoutes/cart.routes");
const orderRoutes = require("./src/Routes/ProductRoutes/order.routes");
const webhookRoutes = require("./src/Routes/ProductRoutes/webhook.routes");
const adminRoutes = require("./src/Routes/ProductRoutes/admin.routes");


/* =========================================================
   ✅ ROUTES MOUNTING
========================================================= */

// Existing routes
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/superadmin", superAdminRoutes);
app.use("/api/v1/coach", coachSellerRoutes);
app.use("/api/v1/coach-manager", coachManagerRoutes);

app.use("/api/v1/exercise", exerciseRoutes);
app.use("/api/v1/user-exercise", userExerciseRoutes);
app.use("/api/v1/ai-workout", aiWorkoutPlanner);
app.use("/api/v1/bmi", calculateBmi);

app.use("/api/v1/nutrition", nutritionRoutes);
app.use("/api/v1/ai-nutrition", aiNutritionPlanner);
app.use("/api/v1/coaching-session", coachingSessionRoutes);

// ✅ Product module routes (CLEAN)
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/subcategories", subcategoryRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/orders", orderRoutes);

// ✅ Webhooks (signature verify uses req.rawBody)
app.use("/api/v1/webhooks", webhookRoutes);

// ✅ Admin product/order management
app.use("/api/v1/admin", adminRoutes);

/* =========================================================
   ✅ DB Connection
========================================================= */
connectDB();

/* =========================================================
   ✅ Socket init
========================================================= */
setupSocket(server);

/* =========================================================
   ✅ Global error handler
========================================================= */
app.use((err, req, res, next) => {
  console.error("Global error handler caught:", err);

  // Mongoose validation
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      error: err.message,
      details: Object.values(err.errors).map((e) => e.message),
    });
  }

  // Mongoose cast error
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
      error: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // Mongo duplicate
  if (err.name === "MongoError" && err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: "Duplicate field value",
      error: "A record with this value already exists",
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
      error: "Please log in again",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
      error: "Please log in again",
    });
  }

  // Default
  res.status(err.statusCode || err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error:
      process.env.NODE_ENV === "development" ? err.stack : "Something went wrong",
  });
});

/* =========================================================
   ✅ 404 Handler
========================================================= */
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    error: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

/* =========================================================
   ✅ Graceful Shutdown
========================================================= */
const shutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (err, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  server.close(() => {
    console.log("Server closed due to uncaught exception");
    process.exit(1);
  });
});

/* =========================================================
   ✅ Server start
========================================================= */
server.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
