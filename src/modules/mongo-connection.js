import chalk from "chalk";
import mongoose from "mongoose";

export default () => {
  mongoose.pluralize(null);
  const uri =
    process.env.NODE_ENV === "dev"
      ? process.env.MONGO_URI
      : process.env.MONGO_URI;
  console.log('%csrc/modules/mongo-connection.js:10 uri', 'color: #007acc;', uri);
  mongoose.connect(uri);
  mongoose.set("debug", process.env.debug ? process.env.debug : true);
  const db = mongoose.connection;
  db.on("error", () => {
    console.log(chalk.red("[admin_system] Error connecting with mongo"));
  });
  db.once("open", () => {
    console.log(chalk.green("[admin_system] Connection with MongoDB"));
  });
  return db;
};
