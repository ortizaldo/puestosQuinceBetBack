import { model, Schema, Types } from "mongoose";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import _ from "underscore";

import {
  deleteBody,
  findDuplicatedCustom,
  findDuplicatedOnUpdated,
} from "modules";
require("core-js/stable");
require("regenerator-runtime/runtime");

const db = {};

db.create = async (
  req,
  options,
  modelClass,
  filterOptions = { populate: null },
) => {
  let fields = [];
  if (_.has(req.body, "fieldsDuplicated")) {
    fields = req.body.fieldsDuplicated;
  }

  const params = req.body;

  if (req.body.hashPassword) {
    params.hashedPassword = await bcrypt.hash(req.body.password, 10);
    // console.log("🚀 ~ params.hashedPassword:", params.hashedPassword);
  }

  if (fields.length) {
    const duplicated = await findDuplicatedCustom(modelClass, fields, req.body);

    if (duplicated) {
      if (_.has(options, "alertDuplicated")) {
        throw global.constants.response[options.alertDuplicated];
      } else {
        throw global.constants.response.recordDuplicated;
      }
    }
  }

  if (req.user && req.user._id) {
    params.createdBy = req.user._id;
    params.updatedBy = req.user._id;
    params.createdAt = new Date();
  }

  const modelData = new modelClass(params);
  let data = await modelData.save();

  const query = modelClass.findOne({ _id: data._id });

  if (filterOptions && filterOptions.populate) {
    _.each(filterOptions.populate, function (row) {
      query.populate(row);
    });
  }

  data = await query;

  return data;
};

db.createMany = async (req, options, modelClass) => {
  // console.log("🚀 ~ db.createMany= ~ req:", req.body);
  let fields = [];
  if (_.has(req.body, "fieldsDuplicated")) {
    fields = req.body.fieldsDuplicated;
  }

  const params = req.body;

  if (fields.length) {
    const duplicated = await findDuplicatedCustom(modelClass, fields, req.body);

    if (duplicated) {
      throw global.constants.response.recordDuplicated;
    }
  }

  let result;
  if (!_.isArray(params)) {
    if (req.user && req.user._id) {
      // params.createdBy = req.user._id;
      // params.updatedBy = req.user._id;
      req.body.createdAt = new Date();
    }
    result = await modelClass.create(params);
  } else {
    result = [];
    // eslint-disable-next-line
    for await (const mo of params) {
      const instance = await modelClass.create(mo);
      result.push(instance);
    }
  }

  return result;
};

db.updateMany = async (req, options, modelClass) => {
  const { id: pk } = req.params;

  let items = Array.isArray(req.query.items)
    ? req.query.items
    : [req.query.items];

  if (pk !== undefined) {
    items = [pk];
  }

  const instance = await modelClass
    .updateMany(
      {
        $and: [
          {
            _id: {
              $in: items,
            },
          },
        ],
      },
      req.body,
    )
    .lean();

  if (!instance) {
    throw global.constants.response.recordNotFound;
  }

  const updatedResult = await modelClass.find({ _id: { $in: items } });

  return instance;
};

/**
 * Retrieves data from the database based on the provided request, options, and modelClass.
 *
 * @param {Object} req - The request object.
 * @param {Object} options - Additional options for the query.
 * @param {Function} modelClass - The model class to query.
 * @return {Object} An object containing the retrieved data.
 */
db.get = async (req, options, modelClass) => {
  // Helper robusto: castea "142" -> 142 (Number) o -> ObjectId si no es numérico
  const castId = (v) => {
    if (v === null || v === undefined) return v;
    if (typeof v === "number") return v;

    const s = String(v).trim();
    // si es entero/decimal válido, lo tratamos como Number (para tus catálogos con _id numérico)
    if (s !== "" && !Number.isNaN(Number(s))) return Number(s);

    return new Types.ObjectId(s);
  };

  const pk = _.has(req.params, "id") ? req.params.id : null;

  let filters = _.has(req.query, "filters")
    ? JSON.parse(req.query.filters)
    : {};

  const nin = _.has(req.query, "nin") ? JSON.parse(req.query.nin) : {};

  // ✅ nin._id.$nin puede traer numbers u objectIds en string
  if (
    _.has(nin, "_id") &&
    _.has(nin._id, "$nin") &&
    Array.isArray(nin._id.$nin)
  ) {
    nin._id.$nin = nin._id.$nin.map(castId);
    filters = { ...filters, ...nin };
  }

  const filtersId = _.has(req.query, "filtersId")
    ? JSON.parse(req.query.filtersId)
    : {};

  // ✅ filtersId: convierte cada value a Number u ObjectId
  Object.keys(filtersId).forEach((key) => {
    const id = filtersId[key]?.value;
    if (id !== undefined) filtersId[key] = castId(id);
  });

  filters = { ...filters, ...filtersId };

  if (_.has(req.query, "regexp")) {
    const regexp = JSON.parse(req.query.regexp);
    filters = { ...filters, ...regexp };
  }

  const populate = _.has(req.query, "populate")
    ? JSON.parse(req.query.populate)
    : [];

  let pipelines = iteratorLookup(req, modelClass, populate);

  const filtersIncludedId = _.has(req.query, "filtersIncludedId")
    ? JSON.parse(req.query.filtersIncludedId)
    : null;

  // ✅ match _id IN (numbers u objectIds)
  if (Array.isArray(filtersIncludedId) && filtersIncludedId.length > 0) {
    pipelines.push({
      $match: { _id: { $in: filtersIncludedId.map(castId) } },
    });
  }

  const sort = _.has(req.query, "sort") ? JSON.parse(req.query.sort) : null;
  if (sort) {
    const operatorSort = {};
    Object.keys(sort).forEach((k) => {
      operatorSort[k] = sort[k] === "asc" ? 1 : -1;
    });
    pipelines = [
      ...pipelines,
      {
        $sort: operatorSort,
      },
    ];
  }

  const select = _.has(req.query, "select") ? JSON.parse(req.query.select) : [];

  if (Array.isArray(select) && select.length > 0) {
    const projects = {
      $project: {
        ...Object.assign(
          {},
          ...select.map((item) => ({
            [item]: 1,
          })),
        ),
        deleted: 1,
      },
    };
    pipelines = [...pipelines, projects];
  }

  pipelines = [{ $match: filters }, ...pipelines];

  let result;

  if (!pk) {
    const limit = _.has(req.query, "limit") ? Number(req.query.limit) : 0;
    const skip = _.has(req.query, "skip") ? Number(req.query.skip) : 0;

    if (skip >= 0) pipelines.push({ $skip: skip });
    if (limit > 0) pipelines.push({ $limit: limit });

    result = await modelClass.aggregate(pipelines);
  } else {
    // ✅ pk puede ser "142" o un ObjectId string
    const pkParsed = castId(pk);
    // result = await modelClass
    //   .findOne({ _id: pkParsed })
    //   .collation({ locale: "en" })
    //   .populate(populate)
    //   // sort en findOne no aplica realmente, pero lo dejo por compatibilidad
    //   .sort(sort || undefined)
    //   .select(select);
    // Agregar el match por pk al inicio de los pipelines
    const pkPipelines = [
      { $match: { _id: pkParsed } },
      ...pipelines, // ya contienen los $lookup del populate
    ];

    const resultArr = await modelClass.aggregate(pkPipelines);
    result = resultArr[0] || null;
  }

  const response = { data: result };

  if (
    _.has(req.query, "total") ||
    _.has(req.query, "pageSize") ||
    _.has(req.query, "limit")
  ) {
    response.total = await modelClass.countDocuments(filters);
  }

  return response;
};

db.edit = async (req, options, modelClass) => {
  const { body } = req;
  // console.log("🚀 ~ db.edit= ~ body:", body);

  let instance = await modelClass
    .findOneAndUpdate(
      {
        _id: new Types.ObjectId(req.params.id),
        deleted: false,
      },
      body,
      {
        new: true,
      },
    )
    .lean();
  // console.log(
  //   "%cpuestosQuinceBetBack/src/modules/repository-db.js:309 instance",
  //   "color: #007acc;",
  //   instance,
  // );
  if (!instance) {
    throw global.constants.response.recordNotFound;
  }
  let populate = [];

  if (_.has(req.body.data, "populateFields")) {
    populate = req.body.populateFields;
    instance = await modelClass
      .findOne({ _id: instance._id })
      .populate(populate)
      .lean();
  }

  return instance;
};

db.delete = async (req, options, modelClass) => {
  const { id: pk } = req.params;
  const filters = "filters" in req.query ? JSON.parse(req.query.filters) : {};

  let items = [];
  if (pk !== undefined) {
    items = [pk];
  } else {
    items = Array.isArray(req.query.items)
      ? req.query.items
      : JSON.parse(req.query.items);
    if (items) {
      _.each(items, (row) => {
        row = new Types.ObjectId(row);
      });
    }
  }

  let instance;
  if (filters.hardDelete) {
    instance = await modelClass.deleteMany({
      _id: {
        $in: items,
      },
    });
  } else {
    instance = await modelClass.updateMany(
      {
        $and: [
          {
            _id: {
              $in: items,
            },
          },
        ],
      },
      deleteBody(req.user ? req.user._id : null, true),
      {
        new: true,
      },
    );
  }

  if (!instance) {
    throw global.constants.response.recordNotFound;
  }

  return instance;
};

function buildVirtualLookup(req, modelClass, item, referenceVirtualPath) {
  const model = referenceVirtualPath.options.ref;
  let params = {
    from: model.collection.name,
    as: item.path,
  };
  if (Array.isArray(item.populate)) {
    // eslint-disable-next-line
    const childPipelines = iteratorLookup(req, model, item.populate);
    params = {
      ...params,
      ...{
        let: {
          foreignId: `$${referenceVirtualPath.options.foreignField}`,
        },
        pipeline: [
          ...[
            {
              $match: {
                $expr: {
                  $eq: [
                    `$${referenceVirtualPath.options.localField}`,
                    "$$foreignId",
                  ],
                },
              },
            },
          ],
          ...childPipelines,
        ],
      },
    };
  } else {
    params = {
      ...params,
      ...{
        localField: referenceVirtualPath.options.localField,
        foreignField: referenceVirtualPath.options.foreignField,
      },
    };
  }
  return {
    $lookup: params,
  };
}

// Resuelve schema.path() para paths anidados como "address.country"
function resolveSchemaPath(modelClass, pathStr) {
  const parts = pathStr.split(".");
  let current = modelClass.schema;

  for (let i = 0; i < parts.length; i++) {
    const direct = current.path(parts.slice(i).join("."));
    if (direct) return direct;

    // bajar un nivel al subdocumento
    const nested = current.path(parts[i]);
    if (nested && nested.schema) {
      current = nested.schema;
    } else {
      return null;
    }
  }
  return null;
}

function getCollectionFromRef(ref) {
  const mongoose = require("mongoose");
  try {
    return mongoose.model(ref).collection.name;
  } catch (e) {
    // fallback: pluralizar en minúsculas
    return ref.toLowerCase() + "s";
  }
}

function buildLookup(req, modelClass, item) {
  const referencePath = resolveSchemaPath(modelClass, item.path);
  // console.log("🚀 ~ buildLookup ~ referencePath:", referencePath);

  if (!referencePath) {
    throw new Error(`Cannot resolve schema path: ${item.path}`);
  }

  const referenceOptions = referencePath.options;
  const ref =
    referencePath.instance === "Array"
      ? referenceOptions.type[0].ref
      : referenceOptions.ref;

  const collectionName = getCollectionFromRef(ref);

  let params = {
    from: collectionName, // ✅ nombre real de colección
    as: item.path,
  };

  if (Array.isArray(item.populate)) {
    const childPipelines = iteratorLookup(
      req,
      mongoose.model(ref),
      item.populate,
    );
    params = {
      ...params,
      let: { foreignId: `$${item.path}` },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$foreignId"] } } },
        ...childPipelines,
      ],
    };
  } else {
    params = {
      ...params,
      localField: item.path,
      foreignField: "_id",
    };
  }

  return { $lookup: params };
}

// to enable deep level flatten use recursion with reduce and concat
function iteratorLookup(req, modelClass, array) {
  const result = [];
  array.forEach((a) => {
    const referenceVirtualPath = modelClass.schema.virtualpath(a.path);
    const referencePath = modelClass.schema.path(a.path);
    let lookup = null;
    if (referenceVirtualPath) {
      lookup = buildVirtualLookup(req, modelClass, a, referenceVirtualPath);
    } else {
      lookup = buildLookup(req, modelClass, a);
      result.push(lookup);
      const resolvedPath = resolveSchemaPath(modelClass, a.path);
      if (
        resolvedPath &&
        (resolvedPath.instance === "ObjectId" ||
          resolvedPath.instance === "Number")
      ) {
        result.push({
          $unwind: {
            path: `$${a.path}`,
            preserveNullAndEmptyArrays: true,
          },
        });
      }
      // if (referencePath.instance === "ObjectId") {
      //   result.push({
      //     $unwind: {
      //       path: `$${a.path}`,
      //       preserveNullAndEmptyArrays: true,
      //     },
      //   });
      // }
    }
  });
  return result;
}

function isNumber(value) {
  return Number.isInteger(Number(value));
}

export default db;
