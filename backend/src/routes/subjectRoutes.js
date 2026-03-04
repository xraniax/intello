import express from "express";
import { createSubject, getSubjects } from "../controllers/subjectController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = express.Router();

// listing is public
router.get("/", getSubjects);

// creation restricted to admins
router.post("/", authenticate, requireRole("admin"), createSubject);

export default router;
