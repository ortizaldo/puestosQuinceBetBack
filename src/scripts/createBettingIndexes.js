import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db.js";
import BetOrder from "../schemas/BetOrder";
import BetMatch from "../schemas/BetMatch";
import WalletTransaction from "../schemas/WalletTransaction";

async function main() {
  await connectDB();
  try {
    await BetOrder.createIndexes();
    await BetMatch.createIndexes();
    await WalletTransaction.collection.createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
    await WalletTransaction.collection.createIndex({ referenceType: 1, referenceId: 1, occurredAt: 1 });
    console.log("Índices de apuestas y auditoría creados correctamente.");
  } finally { await disconnectDB(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
