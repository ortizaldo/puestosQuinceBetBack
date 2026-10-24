import Event from "schemas/Roosters";
import { model, Schema, Types } from "mongoose";
export const getRoostersKpis = async (req, res) => {
  const { id } = req.params;
  const castId = (id) => new Types.ObjectId(id);
  try {
    const [kpis] = await Event.aggregate([
      {
        $match: { event: castId(id) },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
        },
      },
      { $project: { _id: 0 } },
    ]);

    return res.status(200).json(
      kpis ?? {
        total: 0,
      },
    );
  } catch (error) {
    console.log("🚀 ~ getRoostersKpis ~ error:", error);
    return res.status(500).json({
      message: "Error al obtener los KPI de participantes",
    });
  }
};

export const getRoostersFightKpis = async (req, res) => {
  const { id } = req.params;
  const castId = (id) => new Types.ObjectId(id);
  try {
    const [kpis] = await Event.aggregate([
      {
        $match: { event: castId(id) },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
        },
      },
      { $project: { _id: 0 } },
    ]);

    return res.status(200).json(
      kpis ?? {
        total: 0,
      },
    );
  } catch (error) {
    console.log("🚀 ~ getRoostersKpis ~ error:", error);
    return res.status(500).json({
      message: "Error al obtener los KPI de participantes",
    });
  }
};
