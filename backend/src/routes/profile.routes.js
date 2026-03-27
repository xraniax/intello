import express from 'express';
import ProfileController from '../controllers/profile.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', ProfileController.getProfile);
router.put('/', ProfileController.updateProfile);

export default router;
