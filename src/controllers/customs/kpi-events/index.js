import Event from "schemas/Events";
export const getEventosKpis = async (req, res) => {
  try {
    const ahora = new Date();
    console.log("🚀 ~ getEventosKpis ~ ahora:", ahora);

    const [kpis] = await Event.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          borradores: {
            $sum: { $cond: [{ $eq: ["$status", "DRAFT"] }, 1, 0] },
          },
          publicados: {
            $sum: { $cond: [{ $eq: ["$status", "PUBLISHED"] }, 1, 0] },
          },
          abiertos: {
            $sum: { $cond: [{ $eq: ["$status", "OPEN"] }, 1, 0] },
          },
          enCurso: {
            $sum: { $cond: [{ $eq: ["$status", "IN_PROGRESS"] }, 1, 0] },
          },
          finalizados: {
            $sum: { $cond: [{ $eq: ["$status", "FINISHED"] }, 1, 0] },
          },
          cancelados: {
            $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] },
          },
          proximos: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$status", ["PUBLISHED", "OPEN"]] },
                    { $gte: ["$fechaEvento", ahora] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          esteMes: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    {
                      $dateToString: {
                        format: "%Y-%m",
                        date: "$fechaEvento",
                        timezone: "America/Monterrey",
                      },
                    },
                    {
                      $dateToString: {
                        format: "%Y-%m",
                        date: ahora,
                        timezone: "America/Monterrey",
                      },
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $project: { _id: 0 } },
    ]);

    return res.status(200).json(
      kpis ?? {
        total: 0,
        borradores: 0,
        publicados: 0,
        abiertos: 0,
        enCurso: 0,
        finalizados: 0,
        cancelados: 0,
        proximos: 0,
      },
    );
  } catch (error) {
    return res.status(500).json({
      message: "Error al obtener los KPI de eventos",
    });
  }
};
