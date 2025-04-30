import express from "express";
import { auth } from "express-openid-connect";
import morgan from "morgan";
import chalk from "chalk";
import helmet from "helmet";
import path from "path";
import cors from "cors";
import router from "./routes/index";
import { mongooseCon } from "modules";
import constants from "config/constants";

require("dotenv").config();
const env = process.env.NODE_ENV || "development";
const port = env === "development" ? process.env.SERVER_PORT : 3000;

global.constants = constants;
const app = express();
const db = mongooseCon();

app.set("config", global.config);
app.set("dbConnection", db);

// middlewares
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: false }));
app.use(express.json());
//get the port number from .env file
app.use(cors());
// routes
app.use("/api", router);

// static content
app.use(express.static(path.join(__dirname, "public")));

global.db = db;

app.listen(port, () => {
  console.log(chalk.green(`[admin_system] Server running on port: ${port}`));
});
