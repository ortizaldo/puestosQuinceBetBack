import RestRouter from "routes/rest-router";
import User from "schemas/Users";

const router = RestRouter(User, null, true);

export default router;
