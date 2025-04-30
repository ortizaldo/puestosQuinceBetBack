import resError from "./res-error";

export default async (req, res, prepareFilters) => {
  try {
    const response = await prepareFilters(req);
    res.status(200).json(response);
  } catch (err) {
    resError(res, err);
  }
};
