import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db.js";
import Wallet from "../schemas/Wallet";
import WalletTransaction from "../schemas/WalletTransaction";

async function main() {
  await connectDB();
  try {
    await Wallet.collection.createIndex({ userId: 1 }, { unique: true });
    await WalletTransaction.collection.createIndex({ walletId: 1, occurredAt: -1 });
    await WalletTransaction.collection.createIndex({ userId: 1, occurredAt: -1 });
    await WalletTransaction.collection.createIndex({ requestId: 1 }, { unique: true, sparse: true });
    console.log("Índices de Wallet creados correctamente.");
  } finally {
    await disconnectDB();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
