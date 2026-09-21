import express, { type Express } from "express";
import cors from "cors";
import router from "./routes/index.js";
import { logger } from "./lib/logger";

// استيراد آمن يتجاوز مشاكل تضارب الأنواع في pino-http
const pinoHttp = require("pino-http");

const app: Express = express();

app.use(pinoHttp({ logger }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
