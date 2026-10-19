import Events from "schemas/Events";
import Roosters from "schemas/Roosters";
import RestRouter from "routes/rest-router";
import { model, Schema, Types } from "mongoose";

const castId = (id) => new Types.ObjectId(id);
const router = RestRouter(Events, {
  afterGetById: async (event) => {
    return {
      numeroParticipantes: await Roosters.countDocuments({
        event: castId(event._id),
      }),
    };
  },
});

export default router;
