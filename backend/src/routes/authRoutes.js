import express from "express";
import { signupController, signinController } from "../controllers/authController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = express.Router();

// authentication endpoints
router.post("/signup", signupController);           // {name,email,password,role?}
router.post("/signin", signinController);           // {email,password}

// helpers
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

// example admin-only route
router.get("/admin-only", authenticate, requireRole("admin"), (req, res) => {
  res.json({ message: "Welcome, admin!" });
});

export default router;