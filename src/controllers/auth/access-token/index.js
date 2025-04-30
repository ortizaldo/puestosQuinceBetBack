import RestRouter from "routes/rest-router";
import User from "schemas/AccessToken";

const router = RestRouter(User, null, true);

export default router;
