import RestRouter from "routes/rest-router";
import User from "schemas/Users";
import { ensureWallet } from "services/wallet";

const router = RestRouter(User, {
  afterCreate: async (user) => {
    if (user?._id) await ensureWallet(user._id);
  },
}, true);

export default router;
