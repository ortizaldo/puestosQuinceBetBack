import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db.js";
import User from "../schemas/Users";
import { ensureWallet } from "../services/wallet";

async function main() {
  await connectDB();
  try {
    const cursor = User.find({ deleted: { $ne: true } }).select("_id").cursor();
    for await (const user of cursor) await ensureWallet(user._id);
    console.log("Wallets creadas/verificadas para usuarios existentes.");
  } finally {
    await disconnectDB();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
