import express from "express";
import axios from "axios";
import pool from "../db.js";

const router = express.Router();

const ENGINE_URL = process.env.ENGINE_URL || "http://engine:8000";

router.get("/status", async (req, res) => {
  const status = {
    backend: "online",
    engine: "offline",
    database: "offline"
  };

  try {
    const engineRes = await axios.get(ENGINE_URL, { timeout: 2000 });
    if (engineRes.status === 200) status.engine = "online";
  } catch (err) {
    console.error("Engine status check failed:", err.message);
  }

  try {
    const client = await pool.connect();
    status.database = "online";
    client.release();
  } catch (err) {
    console.error("DB status check failed:", err.message);
  }

  res.json(status);
});

// simple form handler example
router.post("/form", (req, res) => {
  console.log(req.body);
  console.log(req.file);
  const { email, password } = req.body;
  res.json({ message: `Form submitted successfully with email: ${email} and password: ${password}` });
});

export default router;
