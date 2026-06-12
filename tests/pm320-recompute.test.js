/* R44 #2 회귀 테스트 — PM320 recompute 단일 SSOT (js/lib/pm320-recompute.js)
   실행: node tests/pm320-recompute.test.js
   핵심 시나리오 = 정정일(authClose ≠ entry_price): 물타기 1배 데이터에서
   종전 2배 하드코딩 `(P0+2·P0·0.936)/3` 회귀 여부를 잡는다.
   기준 검산 (R44 조니 2심 verbatim, 2026-06-11 라이브 데이터):
     P0=138,200 → watering=129,355 / tp=142,622 / tpAfter=(138,200+129,355)/2×1.032=138,058 */
'use strict';
const assert = require('node:assert');
const rc = require('../js/lib/pm320-recompute.js');

// ① 정정일 시나리오 (authClose ≠ entry_price) — 물타기 1배 라벨, build_card_history L986-989 정합
{
  const pk = {
    entry_price: 137900, // pick 시점 stale 가
    watering_weight: '첫 매수와 동일 수량(1배)',
    watering_target_price: 129074, // stale 저장값 (재계산 시 미사용이어야 함)
    take_profit_target_price: 142313,
    take_profit_after_watering_price: 137758,
  };
  const t = rc.targets(pk, 138200); // 정정 종가 (2026-06-11 원익IPS 라이브 값)
  assert.strictEqual(t.recomputed, true, '정정일은 recomputed=true');
  assert.strictEqual(t.p0, 138200, 'p0 = authClose 우선');
  assert.strictEqual(t.watering, 129355, 'watering = round(138200×0.936)');
  assert.strictEqual(t.tp, 142622, 'tp = round(138200×1.032)');
  assert.strictEqual(t.tpAfter, 138058, 'tpAfter 1배 = (P0+P0×0.936)/2×1.032 — 2배 하드코딩 회귀 차단');
  // 종전 2배 하드코딩이 내던 값(≠) 명시 — 회귀 시 즉시 식별
  const old2x = Math.round(((138200 + 2 * 138200 * 0.936) / 3) * 1.032);
  assert.notStrictEqual(t.tpAfter, old2x, `2배 하드코딩 값(${old2x})과 달라야 함`);
}

// ② 비정정일 (authClose === entry_price) — 저장값 passthrough (추정 0)
{
  const pk = {
    entry_price: 138200,
    watering_weight: '첫 매수와 동일 수량(1배)',
    watering_target_price: 129355,
    take_profit_target_price: 142622,
    take_profit_after_watering_price: 138058,
  };
  const t = rc.targets(pk, 138200);
  assert.strictEqual(t.recomputed, false);
  assert.strictEqual(t.tpAfter, 138058, '저장값 그대로');
}

// ③ authClose 부재 (과거 카드 daily_20 부재) — 저장값 fallback (graceful)
{
  const pk = { entry_price: 10000, watering_target_price: 9360, take_profit_target_price: 10320, take_profit_after_watering_price: 9989 };
  const t = rc.targets(pk, null);
  assert.strictEqual(t.recomputed, false);
  assert.strictEqual(t.p0, 10000);
  assert.strictEqual(t.tpAfter, 9989);
}

// ④ 물타기 2배 라벨 데이터 — 식이 W 파라미터를 따라감 (프로파일 변경 호환)
{
  const pk = { entry_price: 100000, watering_weight: '첫 매수의 2배' };
  const t = rc.targets(pk, 100500);
  assert.strictEqual(rc.wateringWeightNum(pk), 2);
  assert.strictEqual(t.tpAfter, Math.round(((100500 + 2 * 100500 * 0.936) / 3) * 1.032));
}

// ⑤ 라벨 부재 폴백 — 수치 1배 + 라벨 디폴트 (종전 '첫 매수의 2배' 하드코딩 폐기 확인)
{
  const pk = { entry_price: 50000 };
  assert.strictEqual(rc.wateringWeightNum(pk), 1);
  assert.strictEqual(rc.wateringWeightLabel(pk), '첫 매수와 동일 수량(1배)');
  assert.strictEqual(rc.wateringWeightLabel({ watering_weight: '첫 매수의 2배' }), '첫 매수의 2배', '데이터 verbatim 우선');
}

console.log('pm320-recompute.test.js — 5 시나리오 전부 PASS');
