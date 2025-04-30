import chalk from "chalk";
import _ from "underscore";

/**
 * @exports res-error
 * @param {any} res
 * @param {any} err
 * @description Basic error res from API. Looks useless but allow us to keep consistence in the way our server will always response in error case
 * Also, condiniotal will let us decide when to controll the err response unless a real server issue occurs
 */
export default (res, err) => {
  console.log("🚀 ~ file: res-error.js:12 ~ err:", err);
  console.log(
    chalk.redBright(
      "==================================================================================="
    )
  );
  console.log(chalk.redBright(`[admin_system] Error: ${JSON.stringify(err)}`));
  console.log(
    chalk.redBright(
      "==================================================================================="
    )
  );
  if (_.has(err, "data")) {
    res.status(err.httpCode ? err.httpCode : 500).json({
      title: _.has(err.data, "title") ? err.data.title : "Error",
      message: _.has(err.data, "message")
        ? err.data.message
        : "Please try again",
      code: _.has(err.data, "code") ? err.data.code : 999,
    });
  } else {
    res.status(err.httpCode ? err.httpCode : 500).json({
      err,
      title: "Error",
      message: "Please try again",
    });
  }
};
