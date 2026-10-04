import assert from "node:assert/strict";
import test from "node:test";

import {
  ARC_CHAIN,
  buildPaymentUrl,
  formatBalance,
  isArcChainId,
  normalizeAmount,
  parsePaymentUrl,
  validateRecipient,
} from "../core.js";

const RECIPIENT = "0xe7591be534d56D701A8726d685C5a1db0080Eac7";

test("Arc mainnet configuration is explicit", () => {
  assert.equal(ARC_CHAIN.idDecimal, 5042);
  assert.equal(ARC_CHAIN.idHex, "0x13b2");
  assert.equal(ARC_CHAIN.currency.symbol, "USDC");
  assert.equal(ARC_CHAIN.currency.decimals, 18);
});

test("recognizes Arc chain IDs without trusting formatting", () => {
  assert.equal(isArcChainId("0x13b2"), true);
  assert.equal(isArcChainId("5042"), true);
  assert.equal(isArcChainId(5042), true);
  assert.equal(isArcChainId("0x1"), false);
  assert.equal(isArcChainId("not-a-chain"), false);
});

test("normalizes Arc native USDC into 18-decimal units", () => {
  assert.deepEqual(normalizeAmount("1.25"), {
    display: "1.25",
    units: 1_250_000_000_000_000_000n,
  });
  assert.throws(() => normalizeAmount("0,01"), /commas are rejected/);
  assert.throws(() => normalizeAmount("1,000"), /commas are rejected/);
});

test("rejects zero and over-precise amounts", () => {
  assert.throws(() => normalizeAmount("0"), /greater than zero/);
  assert.throws(() => normalizeAmount("1.0000000000000000001"), /no more than 18 decimals/);
  assert.throws(() => normalizeAmount((1n << 256n).toString()), /EVM transaction limit/);
});

test("accepts the largest amount representable by an EVM transaction value", () => {
  const maxValue = (1n << 256n) - 1n;
  const whole = maxValue / 10n ** 18n;
  const fraction = (maxValue % 10n ** 18n).toString().padStart(18, "0");

  assert.equal(normalizeAmount(`${whole}.${fraction}`).units, maxValue);
});

test("validates EVM recipients and rejects the zero address", () => {
  assert.equal(validateRecipient(RECIPIENT), RECIPIENT);
  assert.throws(() => validateRecipient("TCvEo7bji7PD3BHXR6LKY4qEAafyC1XtPB"), /valid 42-character EVM address/);
  assert.throws(
    () => validateRecipient("0x0000000000000000000000000000000000000000"),
    /zero address/,
  );
});

test("builds and parses a shareable payment request", () => {
  const url = buildPaymentUrl("https://example.com/?old=1#ignored", {
    recipient: RECIPIENT,
    amount: "25.50",
    label: "Design sprint / week 1",
  });

  assert.equal(
    url,
    `https://example.com/?to=${RECIPIENT}&amount=25.50&label=Design+sprint+%2F+week+1`,
  );
  assert.deepEqual(parsePaymentUrl(url), {
    recipient: RECIPIENT,
    amount: "25.50",
    units: 25_500_000_000_000_000_000n,
    label: "Design sprint / week 1",
  });
});

test("rejects incomplete payment links", () => {
  assert.throws(
    () => parsePaymentUrl(`https://example.com/?to=${RECIPIENT}`),
    /positive USDC amount/,
  );
});

test("formats wallet balances without floating-point math", () => {
  assert.equal(formatBalance("0x1158e460913d0000"), "1.2500 USDC");
});
