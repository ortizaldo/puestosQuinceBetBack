import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db.js";
import Wallet from "../schemas/Wallet";
import RoosterFights from "../schemas/RoosterFights";

async function main() {
  await connectDB();
  try {
    const result = await Wallet.collection.updateMany({}, [{ $set: {
      reservedBalanceCents: { $ifNull: ["$reservedBalanceCents", 0] },
      inPlayBalanceCents: { $ifNull: ["$inPlayBalanceCents", 0] },
    } }]);
    const fightResult = await RoosterFights.collection.updateMany({}, [{ $set: {
      bettingVersion: { $ifNull: ["$bettingVersion", 0] },
      bettingStatus: { $ifNull: ["$bettingStatus", { $cond: [{ $eq: ["$apuestasAbiertas", true] }, "OPEN", "CLOSED"] }] },
    } }]);
    console.log(`Wallets normalizadas: ${result.modifiedCount}; peleas normalizadas: ${fightResult.modifiedCount}. El saldo histórico se conserva como disponible.`);
  } finally { await disconnectDB(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
