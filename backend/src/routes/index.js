import express from "express";
import authRoutes from "./authRoutes.js";
import subjectRoutes from "./subjectRoutes.js";
import miscRoutes from "./miscRoutes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/subjects", subjectRoutes);
router.use("", miscRoutes); // top‑level miscellaneous handlers

export default router;
