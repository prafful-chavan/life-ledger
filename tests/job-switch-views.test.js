// Job switch screen: health cover section text, escaping, and the form fields it reads back.
const assert = require("assert");
const J = require("../job-switch-core.js");
const V = require("../job-switch-views.js");
const T = require("../tax-core.js");
const fmt = { inr: (n) => "₹" + Math.round(n).toLocaleString("en-IN") };
const base = { resignedOn: "2026-10-05", noticeDays: 90, joinedOn: "2024-03-01", current: { gross: 3000000 } };
const render = (offers, ctx) => { const rec = { ...base, offers }; const plan = J.plan(rec, { today: "2026-11-13", computeTax: T.engine.computeTax, groupCover: 1200000, ownHealth: 0, baseline: 1000000, ...ctx }); return V.jobSwitch(rec, plan, { fmt, today: "2026-11-13" }); };
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const html = render([{ id: "o", name: "UST", joinOn: "2027-01-12", gross: 3600000, healthStarts: "after", healthAfterDays: 30, healthCover: 500000, healthSpouse: "yes", healthParents: "no" }]);
const t = text(html);
assert.ok(/Health cover after the job/.test(t) && /₹12,00,000/.test(t) && /Ends on 3 Jan 2027 \(51 days from now\)/.test(t));
assert.ok(/38 days with no cover/.test(t) && /until it starts on 11 Feb 2027/.test(t));
assert.ok(/₹7,00,000 less than the group policy/.test(t) && /₹5,00,000 below your ₹10,00,000 guide/.test(t));
assert.ok(/Archana: yes\. Parents: no\./.test(t) && /no cover after the last day/.test(t));
// the form carries the five health questions for each offer, with the saved answers selected
assert.ok(/data-field="o0healthStarts"/.test(html) && /<option value="after" selected>/.test(html) && /<option value="no" selected>/.test(html) && /data-field="o0healthCover"[^>]*value="500000"/.test(html));
// no gap, same-or-more cover, "no cover" and "not entered" are each said in their own words
assert.ok(/starts on 4 Jan 2027: no gap/.test(text(render([{ id: "o", joinOn: "2027-01-04", healthStarts: "joining", healthCover: 1500000 }]))));
assert.ok(/8 days with no cover/.test(text(render([{ id: "o", joinOn: "2027-01-12", healthStarts: "joining" }]))));
assert.ok(/₹3,00,000 more than the group policy/.test(text(render([{ id: "o", joinOn: "2027-01-12", healthCover: 1500000 }]))));
assert.ok(/same as the group policy/.test(text(render([{ id: "o", joinOn: "2027-01-12", healthCover: 1200000 }]))));
assert.ok(/meets your ₹10,00,000 guide/.test(text(render([{ id: "o", joinOn: "2027-01-12", healthCover: 1200000 }]))));
assert.ok(/gives no health cover/.test(text(render([{ id: "o", joinOn: "2027-01-12", healthStarts: "none" }]))));
assert.ok(/start of cover: not entered/.test(text(render([{ id: "o", joinOn: "2027-01-12" }]))) && /cover amount: not entered/.test(text(render([{ id: "o", joinOn: "2027-01-12" }]))));
// parents are flagged only when every offer says so; with an own policy or one "yes" they are not
assert.ok(!/no cover after the last day/.test(text(render([{ id: "o", healthParents: "yes" }]))));
assert.ok(!/no cover after the last day/.test(text(render([{ id: "o", healthParents: "no" }], { ownHealth: 500000 }))));
assert.ok(/none recorded/.test(t) && /₹5,00,000/.test(text(render([{ id: "o" }], { ownHealth: 500000 }))));
// already ended / ends today
assert.ok(/already ended/.test(text(V.jobSwitch({ ...base, offers: [] }, J.plan({ ...base, offers: [] }, { today: "2027-02-01", computeTax: T.engine.computeTax, groupCover: 1200000 }), { fmt, today: "2027-02-01" }))));
assert.ok(/\(today\)/.test(text(V.jobSwitch({ ...base, offers: [] }, J.plan({ ...base, offers: [] }, { today: "2027-01-03", computeTax: T.engine.computeTax, groupCover: 1200000 }), { fmt, today: "2027-01-03" }))));
// nothing is shown when the household has no group policy
assert.ok(!/Health cover after the job/.test(V.jobSwitch({ ...base, offers: [] }, J.plan({ ...base, offers: [] }, { today: "2026-11-13", computeTax: T.engine.computeTax }), { fmt, today: "2026-11-13" })));
// typed text is escaped everywhere, including the offer name in the cover section
const evil = render([{ id: "o", name: '<img src=x onerror=alert(1)>', joinOn: "2027-01-12", healthStarts: "joining" }]);
assert.ok(!/<img/.test(evil) && /&lt;img/.test(evil));
console.log("job-switch-views: ok");
