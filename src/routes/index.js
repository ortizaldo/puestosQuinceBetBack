import { Router } from "express";
import multer from "multer";
const { auth, requireRole } = require("../middleware/auth");
//const requireRole = require( "middlewares/requireRole");
import {
  login,
  refreshToken,
  logout,
  getAccessToken,
} from "controllers/auth/login";
import routesUsers from "controllers/users";
import routesDerby from "controllers/derby";
import routesCompadres from "controllers/compadres";
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
import routesCatalogs from "controllers/catalog";

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });
//----------------AUTH-------------------------------
router.route("/login").post(login);
router.route("/refresh-token").post(refreshToken);
router.route("/get-access-token").get(getAccessToken);
router.route("/logout").post(logout);
//----------------ADMIN-------------------------------
router.route("/upload").post(login, upload.single("file"));
// router.use("/users", auth, requireRole("admin"), routesUsers);
router.use("/users", auth, requireRole("admin"), routesUsers);
router.use("/derby", auth, requireRole("admin"), routesDerby);
router.use("/compadres", auth, requireRole("admin"), routesCompadres);
router.use("/derby-conf", auth, requireRole("admin"), routesDerbyConf);
router.use("/rooster", auth, requireRole("admin"), routesRoosters);
router.use(
  "/rooster-release",
  auth,
  requireRole("admin"),
  routesRoosterRelease,
);
router.use("/team", auth, requireRole("admin"), routesTeam);
// router.use("/country", auth, requireRole("admin"), routesCountry);
router.use("/country", routesCountry);
router.use("/state", auth, requireRole("admin"), routesState);
router.use("/municipality", auth, requireRole("admin"), routesMunicipality);
router.use("/companies", auth, requireRole("admin"), routesCompany);
router.use("/bet-stubs", auth, requireRole("admin"), routesBetStubs);
router.use("/brooker", auth, requireRole("admin"), routesBrooker);
router.use("/brooker-bet", auth, routesBrookerBet);
router.use("/events", auth, requireRole("admin"), routesEvents);
router.use("/catalogs", auth, requireRole("admin"), routesCatalogs);

export default router;
