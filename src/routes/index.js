import { Router } from "express";
import multer from "multer";
const { auth, requireRole } = require("../middleware/auth");
//const requireRole = require( "middlewares/requireRole");
import {
  login,
  refreshToken,
  logout,
  handlerActivateEmail,
  activation,
  activateAccount,
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
router.route("/activation/:token").get(activation);
router.route("/activate-account/").post(activateAccount);
router.route("/resend-activation-email/:token").post(handlerActivateEmail);
router.route("/send-activation-email/:id").post(handlerActivateEmail);
//----------------ADMIN-------------------------------
router.route("/upload").post(login, upload.single("file"));
// router.use("/users", auth, requireRole("ADMIN"), routesUsers);
router.use("/users", routesUsers);
router.use("/derby", auth, requireRole("ADMIN"), routesDerby);
router.use("/compadres", auth, requireRole("ADMIN"), routesCompadres);
router.use("/derby-conf", auth, requireRole("ADMIN"), routesDerbyConf);
router.use("/rooster", auth, requireRole("ADMIN"), routesRoosters);
router.use(
  "/rooster-release",
  auth,
  requireRole("ADMIN"),
  routesRoosterRelease,
);
router.use("/team", auth, requireRole("ADMIN"), routesTeam);
router.use("/country", auth, requireRole("ADMIN"), routesCountry);
router.use("/state", auth, requireRole("ADMIN"), routesState);
router.use("/municipality", auth, requireRole("ADMIN"), routesMunicipality);
router.use("/companies", auth, requireRole("ADMIN"), routesCompany);
router.use("/bet-stubs", auth, requireRole("ADMIN"), routesBetStubs);
router.use("/brooker", auth, requireRole("ADMIN"), routesBrooker);
router.use("/brooker-bet", auth, routesBrookerBet);
router.use("/events", auth, requireRole("ADMIN"), routesEvents);
router.use("/catalogs", auth, requireRole("ADMIN"), routesCatalogs);

export default router;
