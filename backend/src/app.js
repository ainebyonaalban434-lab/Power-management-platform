const express = require("express");
const cors = require("cors");
require("dotenv").config();

const regionRoutes = require("./routes/region.routes");

const userRoutes = require("./routes/user.routes");

const prisma = require("./lib/prisma");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/regions", regionRoutes);
app.use("/api/users", userRoutes);


// Home route
app.get("/", (req, res) => {
  res.json({
    message: "Power Management Platform API is running",
  });
});


// Health check route
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "OK",
      message: "Backend and database are healthy",
      timestamp: new Date().toISOString(),
    });

  } catch (error) {

    console.error("Database connection error:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Backend is running but database connection failed",
    });

  }
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const loadSheddingRoutes = require("./routes/loadshedding.routes");

app.use("/api/load-shedding", loadSheddingRoutes);