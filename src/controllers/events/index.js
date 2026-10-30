import Events from "schemas/Events";
import Roosters from "schemas/Roosters";
import RoosterFights from "schemas/RoosterFights";
import RestRouter from "routes/rest-router";
import { model, Schema, Types } from "mongoose";
import _ from "underscore";

const castId = (id) => new Types.ObjectId(id);
const router = RestRouter(Events, {
  afterGetById: async (event) => {
    return {
      numeroParticipantes: await Roosters.countDocuments({
        event: castId(event._id),
      }),
      numeroPeleas: await RoosterFights.countDocuments({
        event: castId(event._id),
        estado: "PROGRAMADA",
      }),
      peleasEnCurso: await RoosterFights.countDocuments({
        event: castId(event._id),
        estado: "EN_CURSO",
      }),
      peleasFinalizadas: await RoosterFights.countDocuments({
        event: castId(event._id),
        estado: "FINALIZADA",
      }),
    };
  },

  afterGetAll: async (events) => {
    if (_.isArray(events)) {
      const eventPromises = events.map(async (event) => {
        const numeroParticipantes = await Roosters.countDocuments({
          event: castId(event._id),
        });
        const numeroPeleas = await RoosterFights.countDocuments({
          event: castId(event._id),
          estado: "PROGRAMADA",
        });
        const peleasEnCurso = await RoosterFights.countDocuments({
          event: castId(event._id),
          estado: "EN_CURSO",
        });
        const peleasFinalizadas = await RoosterFights.countDocuments({
          event: castId(event._id),
          estado: "FINALIZADA",
        });

        return {
          ...event,
          numeroParticipantes,
          numeroPeleas,
          peleasEnCurso,
          peleasFinalizadas,
        };
      });

      return Promise.all(eventPromises);
    } else {
      return events;
    }
  },
});

export default router;
