import express from "express";
import { signupController , signinController} from "./controller.js";

const app = express();

const router = express.Router();    

router.get('/signup', signupController);
router.get('/signin', signinController);

export default router;