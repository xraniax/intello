
import express from "express";
import cors from "cors";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL pool
const { Pool } = pg;
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST || "db",
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT || 5432,
});

// Test DB connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error("Error acquiring client", err.stack);
  }
  console.log("Database connected");
  release();
});

// ====================
// Routes
// ====================

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Backend is running!" });
});

// Create a new subject
app.post("/subjects", async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO subjects (name, description) VALUES ($1, $2) RETURNING *",
      [name, description]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get all subjects
app.get("/subjects", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM subjects ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ====================
// Start server
// ====================
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
