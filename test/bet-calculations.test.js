const { expect } = require("chai");
const { compatibleMarket, compatibleSide, commissionForProfit, matchedRisks, orderStatus, profitForRisk } = require("../src/services/bet-calculations");

describe("betting calculations", () => {
  it("matches EVEN risk cent for cent and supports partial orders", () => {
    expect(matchedRisks("EVEN", 1200000, "EVEN", 1000000)).to.deep.equal({ ownRiskCents: 1000000, oppositeRiskCents: 1000000 });
    expect(matchedRisks("EVEN", 20000, "EVEN", 150000)).to.deep.equal({ ownRiskCents: 20000, oppositeRiskCents: 20000 });
    expect(profitForRisk("EVEN", 1200000)).to.equal(1200000);
  });

  it("pairs GIVE_80 and TAKE_80 by the 100:80 risk ratio without fractional cents", () => {
    expect(matchedRisks("GIVE_80", 30000, "TAKE_80", 16000)).to.deep.equal({ ownRiskCents: 20000, oppositeRiskCents: 16000 });
    expect(matchedRisks("TAKE_80", 10000, "GIVE_80", 10000)).to.deep.equal({ ownRiskCents: 8000, oppositeRiskCents: 10000 });
    expect(profitForRisk("GIVE_80", 20000)).to.equal(16000);
    expect(profitForRisk("TAKE_80", 16000)).to.equal(20000);
    expect(matchedRisks("GIVE_80", 10000, "TAKE_80", 7999)).to.deep.equal({ ownRiskCents: 0, oppositeRiskCents: 0 });
  });

  it("rejects 80-line risks that cannot be represented as complete $100:$80 units", () => {
    expect(() => profitForRisk("GIVE_80", 9999)).to.throw();
    expect(() => profitForRisk("TAKE_80", 7999)).to.throw();
  });

  it("maps only opposite sides and opposite 80 markets as compatible", () => {
    expect(compatibleSide("RED")).to.equal("GREEN");
    expect(compatibleMarket("GIVE_80")).to.equal("TAKE_80");
    expect(compatibleMarket("TAKE_80")).to.equal("GIVE_80");
  });

  it("calculates commission only from gross profit with deterministic half-up cents", () => {
    expect(commissionForProfit(10000, 500)).to.equal(500);
    expect(commissionForProfit(101, 500)).to.equal(5);
    expect(commissionForProfit(10000, 0)).to.equal(0);
  });

  it("derives pending, partial, and full order states", () => {
    expect(orderStatus({ matchedRiskAmount: 0, pendingRiskAmount: 500 })).to.equal("PENDING");
    expect(orderStatus({ matchedRiskAmount: 200, pendingRiskAmount: 300 })).to.equal("PARTIALLY_MATCHED");
    expect(orderStatus({ matchedRiskAmount: 500, pendingRiskAmount: 0 })).to.equal("MATCHED");
  });
});
