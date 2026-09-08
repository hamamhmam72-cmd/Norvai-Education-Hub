import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import profileRouter from "./profile.js";
import dashboardRouter from "./dashboard.js";
import lecturesRouter from "./lectures.js";
import curriculaRouter from "./curricula.js";
import chatRouter from "./chat.js";
import summaryRouter from "./summary.js";
import debugRouter from "./debug.js";
import quizRouter from "./quiz.js";
import careerRouter from "./career.js";
import subscriptionsRouter from "./subscriptions.js";
import adminRouter from "./admin.js";
import uploadRouter from "./upload.js";
import progressRouter from "./progress.js";
import certificatesRouter from "./certificates.js";
import feedbackRouter from "./feedback.js";
import accessRouter from "./access.js";
import studyRouter from "./study.js";
import storageRouter from "./storage.js";

import { requireActiveAccess } from "../middleware/auth.js";

const router: IRouter = Router();

// Server-side paywall: core learning features require an active subscription
// or a validated activation code. Profile, subscription, feedback, access,
// auth, upload (needed for receipts), certificates, and admin stay open.
router.use(
  ["/dashboard", "/lectures", "/curricula", "/chat", "/summary", "/debug", "/quizzes", "/career", "/progress", "/study", "/question-bank", "/team"],
  requireActiveAccess
);

router.use(healthRouter);
router.use(storageRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(dashboardRouter);
router.use(lecturesRouter);
router.use(curriculaRouter);
router.use(chatRouter);
router.use(summaryRouter);
router.use(debugRouter);
router.use(quizRouter);
router.use(careerRouter);
router.use(subscriptionsRouter);
router.use(adminRouter);
router.use(uploadRouter);
router.use(progressRouter);
router.use(certificatesRouter);
router.use(feedbackRouter);
router.use(accessRouter);
router.use(studyRouter);

export default router;
