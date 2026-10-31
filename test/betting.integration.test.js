const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const BetOrder = require("../src/schemas/BetOrder").default;
const BetMatch = require("../src/schemas/BetMatch").default;
const Wallet = require("../src/schemas/Wallet").default;
const WalletTransaction = require("../src/schemas/WalletTransaction").default;
const User = require("../src/schemas/Users").default;
const Event = require("../src/schemas/Events").default;
const Fight = require("../src/schemas/RoosterFights").default;
const { createBetOrder, cancelPendingBet, setBettingOpen, settleFight, startFight } = require("../src/services/betting");

const testUri = process.env.BETTING_TEST_MONGO_URI;
const integration = testUri ? describe : describe.skip;
let eventId;
let fightId;
const users = {};

integration("betting transactional service (isolated replica set)", function () {
  this.timeout(30000);

  before(async () => {
    const uri = new URL(testUri);
    if (!/betting_test/i.test(uri.pathname)) throw new Error("BETTING_TEST_MONGO_URI must name an isolated database containing 'betting_test'.");
    uri.pathname = `/betting_test_${process.pid}`;
    await mongoose.connect(uri.toString(), { autoIndex: true });
    mongoose.set("debug", false);
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
    const [event] = await Event.create([{ nombre: "Prueba", tipoEvento: "PALENQUE", arma: "1", numGallos: 2, creditos: 0, fechaEvento: new Date(), pesoMinimo: 0, pesoMaximo: 100, tolerancia: 0 }]);
    eventId = event._id;
    const created = await User.create(["a", "b", "c", "d"].map((key) => ({ firstName: key, lastName: "Test", email: `${key}-${process.pid}@test.local`, roles: ["USUARIO"], typeUser: "USUARIO", status: "ACTIVE" })));
    for (let i = 0; i < created.length; i += 1) {
      users[["a", "b", "c", "d"][i]] = created[i]._id;
      await Wallet.create({ userId: created[i]._id, balanceCents: 10000000, reservedBalanceCents: 0, inPlayBalanceCents: 0 });
    }
    const [fight] = await Fight.create([{ event: eventId, cotejo: 1, ronda: 1, verde: { _id: new mongoose.Types.ObjectId() }, rojo: { _id: new mongoose.Types.ObjectId() }, diferenciaGramos: 0, estado: "PROGRAMADA", bettingCommissionBps: 500 }]);
    fightId = fight._id;
  });

  const open = () => setBettingOpen({ fightId, open: true, actorId: users.a });
  const bet = (userId, participantSide, marketType, riskCents) => createBetOrder({ userId, fightId, participantSide, marketType, riskCents });
  const wallet = (userId) => Wallet.findOne({ userId }).lean();

  it("coteja FIFO completo y parcial en una orden contra varias", async () => {
    await open();
    const first = await bet(users.a, "GREEN", "EVEN", 1000000);
    const second = await bet(users.b, "GREEN", "EVEN", 1500000);
    const incoming = await bet(users.c, "RED", "EVEN", 1200000);
    expect(incoming.matches).to.have.length(2);
    expect(incoming.matches.map((match) => match.myRiskAmount)).to.deep.equal([1000000, 200000]);
    const refreshedFirst = await BetOrder.findById(first.order._id).lean();
    const refreshedSecond = await BetOrder.findById(second.order._id).lean();
    expect(refreshedFirst.status).to.equal("MATCHED");
    expect(refreshedSecond).to.include({ matchedRiskAmount: 200000, pendingRiskAmount: 1300000, status: "PARTIALLY_MATCHED" });
    expect(await BetMatch.countDocuments({ fightId })).to.equal(2);
  });

  it("matches several earlier orders to one incoming order in FIFO order", async () => {
    await open();
    await bet(users.a, "RED", "EVEN", 1000000);
    await bet(users.b, "RED", "EVEN", 1500000);
    const incoming = await bet(users.c, "GREEN", "EVEN", 1200000);
    expect(incoming.matches.map((match) => match.myRiskAmount)).to.deep.equal([1000000, 200000]);
  });

  it("applies exact partial GIVE_80:TAKE_80 liability and payout ratios", async () => {
    await open();
    await bet(users.a, "GREEN", "TAKE_80", 16000);
    const give = await bet(users.b, "RED", "GIVE_80", 30000);
    expect(give.order).to.include({ matchedRiskAmount: 20000, pendingRiskAmount: 10000, potentialGrossProfit: 24000, status: "PARTIALLY_MATCHED" });
    const match = await BetMatch.findOne({ fightId }).lean();
    expect(match).to.include({ redRiskAmount: 20000, greenRiskAmount: 16000, redPotentialProfit: 16000, greenPotentialProfit: 20000 });
  });

  it("does not self-match, rejects insufficient funds, and rejects bets after close", async () => {
    await open();
    const red = await bet(users.a, "RED", "EVEN", 10000);
    const green = await bet(users.a, "GREEN", "EVEN", 10000);
    expect(green.matches).to.have.length(0);
    expect(await BetMatch.countDocuments({ fightId })).to.equal(0);
    const otherWallet = await wallet(users.b);
    await Wallet.updateOne({ _id: otherWallet._id }, { $set: { balanceCents: 0 } });
    try { await bet(users.b, "GREEN", "EVEN", 100); throw new Error("expected insufficient balance"); } catch (error) { expect(error.code).to.equal("INSUFFICIENT_BALANCE"); }
    await setBettingOpen({ fightId, open: false, actorId: users.a });
    try { await bet(users.c, "RED", "EVEN", 100); throw new Error("expected closed market"); } catch (error) { expect(error.code).to.equal("BETTING_CLOSED"); }
    expect((await BetOrder.findById(red.order._id)).status).to.equal("CLOSED_UNMATCHED");
  });

  it("cancels only unmatched risk and releases it to available balance", async () => {
    await open();
    const red = await bet(users.a, "RED", "EVEN", 10000);
    await bet(users.b, "GREEN", "EVEN", 4000);
    const cancelled = await cancelPendingBet({ userId: users.a, betId: red.order._id });
    expect(cancelled.order).to.include({ matchedRiskAmount: 4000, pendingRiskAmount: 0, status: "CLOSED_PARTIALLY_MATCHED" });
    expect(cancelled.wallet).to.include({ availableBalance: 9996000, reservedBalance: 0, inPlayBalance: 4000 });
    const release = await WalletTransaction.findOne({ userId: users.a, type: "BET_CANCEL_RELEASE" }).lean();
    expect(release).to.exist;
    expect(release.metadata.releasedRiskCents).to.equal(6000);
  });

  it("closes atomically, releases unmatched risk, and refunds DRAW or canceled fights", async () => {
    await open();
    await bet(users.a, "RED", "EVEN", 10000);
    await bet(users.b, "GREEN", "EVEN", 4000);
    const closed = await setBettingOpen({ fightId, open: false, actorId: users.a });
    expect(closed).to.include({ releasedCents: 6000, affectedOrders: 1 });
    expect((await BetMatch.findOne({ fightId })).status).to.equal("IN_PLAY");
    const settled = await settleFight({ fightId, outcome: "DRAW", actorId: users.a });
    expect(settled).to.include({ settledMatches: 1, refundedCents: 8000 });
    const [a, b] = await Promise.all([wallet(users.a), wallet(users.b)]);
    expect(a).to.include({ balanceCents: 10000000, reservedBalanceCents: 0, inPlayBalanceCents: 0 });
    expect(b).to.include({ balanceCents: 10000000, reservedBalanceCents: 0, inPlayBalanceCents: 0 });
    try { await settleFight({ fightId, outcome: "DRAW", actorId: users.a }); throw new Error("expected idempotency conflict"); } catch (error) { expect(error.code).to.equal("ALREADY_SETTLED"); }
  });

  it("returns capital, credits profit, and charges commission only on profit", async () => {
    await open();
    await bet(users.a, "RED", "EVEN", 10000);
    await bet(users.b, "GREEN", "EVEN", 10000);
    await setBettingOpen({ fightId, open: false, actorId: users.a });
    await settleFight({ fightId, outcome: "RED", actorId: users.a });
    expect((await wallet(users.a)).balanceCents).to.equal(10009500);
    expect((await wallet(users.b)).balanceCents).to.equal(9990000);
    expect(await WalletTransaction.countDocuments({ userId: users.a, type: "BET_COMMISSION", amountCents: 500 })).to.equal(1);
    expect(await WalletTransaction.countDocuments({ userId: users.a, type: "BET_WIN", "metadata.entryKind": "RETURNED_CAPITAL", amountCents: 10000 })).to.equal(1);
    expect(await WalletTransaction.countDocuments({ userId: users.a, type: "BET_WIN", "metadata.entryKind": "GROSS_PROFIT", amountCents: 10000 })).to.equal(1);
  });

  it("refunds risk on cancellation and rolls back a failed reserve ledger write", async () => {
    await open();
    await bet(users.a, "RED", "EVEN", 10000);
    await bet(users.b, "GREEN", "EVEN", 10000);
    await setBettingOpen({ fightId, open: false, actorId: users.a });
    await settleFight({ fightId, outcome: "CANCELLED", actorId: users.a });
    expect((await wallet(users.a)).balanceCents).to.equal(10000000);
    expect((await BetMatch.findOne({ fightId })).status).to.equal("REFUNDED");

    // A fresh fight makes it possible to assert that an intermediate ledger failure aborts all writes.
    const [fight] = await Fight.create([{ event: eventId, cotejo: 2, ronda: 1, verde: { _id: new mongoose.Types.ObjectId() }, rojo: { _id: new mongoose.Types.ObjectId() }, diferenciaGramos: 0, estado: "PROGRAMADA" }]);
    fightId = fight._id;
    await open();
    const before = await wallet(users.c);
    const stub = sinon.stub(WalletTransaction, "create").rejects(new Error("ledger unavailable"));
    try { await bet(users.c, "RED", "EVEN", 10000); } catch (error) { expect(error.message).to.equal("ledger unavailable"); }
    finally { stub.restore(); }
    expect((await wallet(users.c)).balanceCents).to.equal(before.balanceCents);
    expect(await BetOrder.countDocuments({ fightId })).to.equal(0);
  });

  it("serializes a close racing a new order and never leaves risk reserved", async () => {
    await open();
    const [created, closed] = await Promise.allSettled([
      bet(users.a, "RED", "EVEN", 10000),
      setBettingOpen({ fightId, open: false, actorId: users.b }),
    ]);
    expect(closed.status).to.equal("fulfilled");
    if (created.status === "fulfilled") {
      const order = await BetOrder.findById(created.value.order._id).lean();
      expect(order.pendingRiskAmount).to.equal(0);
      expect(order.status).to.equal("CLOSED_UNMATCHED");
    } else expect(created.reason.code).to.equal("BETTING_CLOSED");
    expect((await wallet(users.a)).reservedBalanceCents).to.equal(0);
  });

  it("serializes concurrent orders consuming the same pending counterpart", async () => {
    await open();
    const red = await bet(users.a, "RED", "EVEN", 10000);
    const attempts = await Promise.all([
      bet(users.b, "GREEN", "EVEN", 7000),
      bet(users.c, "GREEN", "EVEN", 7000),
    ]);
    const refreshedRed = await BetOrder.findById(red.order._id).lean();
    const greenOrders = await BetOrder.find({ _id: { $in: attempts.map((result) => result.order._id) } }).lean();
    expect(refreshedRed.matchedRiskAmount).to.equal(10000);
    expect(refreshedRed.pendingRiskAmount).to.equal(0);
    expect(greenOrders.reduce((sum, order) => sum + order.matchedRiskAmount, 0)).to.equal(10000);
    expect(greenOrders.reduce((sum, order) => sum + order.pendingRiskAmount, 0)).to.equal(4000);
    const matches = await BetMatch.find({ fightId }).lean();
    expect(matches.reduce((sum, match) => sum + match.redRiskAmount, 0)).to.equal(10000);
    expect(matches.reduce((sum, match) => sum + match.greenRiskAmount, 0)).to.equal(10000);
    const ledger = await WalletTransaction.find({ fightId }).lean();
    expect(ledger.every((entry) => entry.idempotencyKey && entry.referenceId && entry.balanceBeforeCents !== undefined && entry.balanceAfterCents !== undefined)).to.equal(true);
    expect(await WalletTransaction.countDocuments({ fightId, type: "BET_MATCHED" })).to.equal(4);
  });

  it("blocks fight start until betting is closed", async () => {
    await open();
    try { await startFight({ fightId, actorId: users.a }); throw new Error("expected an open market to block fight start"); }
    catch (error) { expect(error.code).to.equal("CANNOT_START_FIGHT"); }
    await setBettingOpen({ fightId, open: false, actorId: users.a });
    const started = await startFight({ fightId, actorId: users.a });
    expect(started.fight.estado).to.equal("EN_CURSO");
  });

  it("treats a legacy fight without bettingStatus as closed when starting", async () => {
    const legacyFightId = new mongoose.Types.ObjectId();
    await Fight.collection.insertOne({
      _id: legacyFightId,
      event: eventId,
      cotejo: 2,
      ronda: 1,
      verde: { _id: new mongoose.Types.ObjectId() },
      rojo: { _id: new mongoose.Types.ObjectId() },
      diferenciaGramos: 0,
      estado: "PROGRAMADA",
      apuestasAbiertas: false,
    });
    const started = await startFight({ fightId: legacyFightId, actorId: users.a });
    expect(started.fight.estado).to.equal("EN_CURSO");
    expect(started.fight.bettingStatus).to.equal("CLOSED");
  });
});
