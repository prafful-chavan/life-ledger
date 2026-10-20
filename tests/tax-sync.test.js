const assert = require("assert");
const S = require("../sync-engine.js");

// The tax page's data syncs like the rest of the vault: records by id, the profile as one value (last edit wins).
const base = { taxProfile: { marriageDate: "2024-06-30" }, taxReturns: [{ id: "r1", fy: "2025-26" }], taxFamily: [] };
const phone = { ...base, taxFamily: [{ id: "f1", amount: 100000 }], taxProfile: { marriageDate: "2024-06-30", parentsSenior: true } };
const laptop = { ...base, taxFamily: [{ id: "f2", amount: 200000 }], taxReturns: [{ id: "r1", fy: "2025-26" }, { id: "r2", fy: "2024-25" }] };
const mPhone = S.stamp(base, phone, S.emptyMeta(), 1000);
const mLaptop = S.stamp(base, laptop, S.emptyMeta(), 2000);
const merged = S.merge({ data: phone, meta: mPhone }, { data: laptop, meta: mLaptop }, 3000);
assert.deepStrictEqual(merged.data.taxFamily.map((x) => x.id).sort(), ["f1", "f2"], "transfers added on two devices both survive");
assert.deepStrictEqual(merged.data.taxReturns.map((x) => x.id).sort(), ["r1", "r2"]);
assert.strictEqual(merged.data.taxProfile.parentsSenior, true, "the profile edit is kept");
// deleting a transfer on one device is not undone by the other
const afterDelete = { ...merged.data, taxFamily: merged.data.taxFamily.filter((x) => x.id !== "f1") };
const mDel = S.stamp(merged.data, afterDelete, merged.meta, 4000);
const again = S.merge({ data: afterDelete, meta: mDel }, { data: merged.data, meta: merged.meta }, 5000);
assert.deepStrictEqual(again.data.taxFamily.map((x) => x.id), ["f2"]);
console.log("tax sync tests passed");
