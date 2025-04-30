/**
 * @function findDuplicated
 * @description This function will return the fields text if the count throw more than 0 documents.
 * @param {any} model A MongoDB model.
 * @param {any} fields The field you want to search for duplications
 * @param {any} body The data you're going to save in DB if no duplication found
 */
export const findDuplicated = async (model, fields, body) => new Promise(async (resolve, reject) => {
  try {
    // We declare our empty array to use as the $or filter
    const fieldArr = [];
    fields.map((field) => {
      if (body[field] && body[field] !== undefined && body[field] !== "") {
        fieldArr.push({
          [field]: body[field],
        });
      }
      return null;
    });

    // Find the items with the filter array
    const filters = {
      $and: [
        {
          deleted: false,
        },
      ],
    };
    let items = 0;
    if (fieldArr.length > 0) {
      filters.$or = fieldArr;
      items = await model.countDocuments(filters);
    }

    if (items > 0) {
      resolve(true);
    }
    resolve(false);
  } catch (err) {
    console.error(err);
    reject(new Error(false));
  }
});

export const findDuplicatedOnUpdated = async (model, fields, body, _id) => new Promise(async (resolve, reject) => {
  try {
    // We declare our empty array to use as the $or filter
    const fieldArr = [];
    fields.map((field) => {
      if (body[field] && body[field] !== undefined && body[field] !== "") {
        fieldArr.push({
          [field]: body[field],
        });
      }
      return null;
    });

    // Find the items with the filter array
    const filters = {
      $and: [],
    };

    let items = 0;

    if (fieldArr.length > 0) {
      filters.$and = fieldArr;
      filters.$and.push(
        {
          deleted: false,
        },
        {
          _id: {
            $ne: _id,
          },
        }
      );
      items = await model.countDocuments(filters);
    }

    if (items > 0) {
      resolve(true);
    }
    resolve(false);
  } catch (err) {
    console.error(err);
    reject(new Error(false));
  }
});

export const findDuplicatedCustom = async (model, fields, body) => new Promise(async (resolve, reject) => {
  try {
    // We declare our empty array to use as the $or filter
    const fieldArr = [];
    fields.map((field) => {
      if (body[field] && body[field] !== undefined && body[field] !== "") {
        fieldArr.push({
          [field]: body[field],
        });
      }
      return null;
    });

    // Find the items with the filter array
    const filters = {
      $and: [
        {
          deleted: false,
        },
      ],
    };
    let items = 0;
    if (fieldArr.length > 0) {
      filters.$and = fieldArr;
      filters.$and.push({
        deleted: false,
      });
      items = await model.countDocuments(filters);
    }

    if (items > 0) {
      resolve(true);
    }
    resolve(false);
  } catch (err) {
    console.error(err);
    reject(new Error(false));
  }
});
