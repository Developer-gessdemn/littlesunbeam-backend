const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const connectDB = require("./config/db");
const { getDBStatus } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

// Route imports
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const printRoutes = require("./routes/printRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const bannerRoutes = require("./routes/bannerRoutes");
const settingsRoutes = require("./routes/settingsRoutes");

// Initialize MongoDB connection
connectDB();

const app = express();

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS configuration
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
  : ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Request parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// HTTP Request logger
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Serve static uploaded media files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Little Sunbeam Baby Clothing Ecommerce API is running smoothly",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API service is healthy",
    uptime: process.uptime(),
    database: getDBStatus(),
    timestamp: new Date().toISOString(),
  });
});

// Mount REST API endpoints
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/prints", printRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/settings", settingsRoutes);

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

let server;

function startServer(port = PORT) {
  server = app.listen(port, () => {
    console.log(
      `[Server] Little Sunbeam API Server running in ${process.env.NODE_ENV || "development"} mode on http://localhost:${port}`
    );
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[Server Warning] Port ${port} is currently in use.`);
      if (process.env.NODE_ENV === "development") {
        const nextPort = Number(port) + 1;
        console.log(`[Server] Retrying on alternate port http://localhost:${nextPort}...`);
        startServer(nextPort);
      } else {
        console.error(`[Server Error] Port ${port} is in use. Exiting...`);
        process.exit(1);
      }
    } else {
      console.error(`[Server Error]: ${err.message}`);
    }
  });
}

if (require.main === module) {
  startServer(PORT);
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error(`[UnhandledRejection Error]: ${err.message}`);
});

module.exports = app;
