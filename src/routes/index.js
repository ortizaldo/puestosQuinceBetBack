import { Router } from "express";
import multer from "multer";
const auth = require("middleware/auth");
import {
  login,
  refreshToken,
  logout,
  getAccessToken,
} from "controllers/auth/login";
import routesUsers from "controllers/users";
import routesDerby from "controllers/derby";
import routesDerbyConf from "controllers/derby-conf";
import routesRoosters from "controllers/roosters";
import routesRoosterRelease from "controllers/rooster-release";
import routesTeam from "controllers/team";
import routesCountry from "controllers/country";
import routesState from "controllers/state";
import routesMunicipality from "controllers/municipality";
import routesCompany from "controllers/company";
import routesBetStubs from "controllers/bet-stubs";
import routesBrooker from "controllers/brooker";
import routesBrookerBet from "controllers/brooker-bet";
import routesEvents from "controllers/events";

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });
//----------------AUTH-------------------------------
router.route("/login").post(login);
router.route("/refresh-token").post(refreshToken);
router.route("/get-access-token").get(getAccessToken);
router.route("/logout").post(logout);
//----------------ADMIN-------------------------------
router.route("/upload").post(login, upload.single('file'));
router.use("/users", routesUsers);
router.use("/derby", routesDerby);
router.use("/derby-conf", routesDerbyConf);
router.use("/rooster", routesRoosters);
router.use("/rooster-release", routesRoosterRelease);
router.use("/team", routesTeam);
router.use("/country", routesCountry);
router.use("/state", routesState);
router.use("/municipality", routesMunicipality);
router.use("/companies", routesCompany);
router.use("/bet-stubs", routesBetStubs);
router.use("/brooker", routesBrooker);
router.use("/brooker-bet", routesBrookerBet);
router.use("/events", routesEvents);

export default router;
