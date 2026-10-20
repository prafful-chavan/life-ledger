/** Re-export: the implementation lives in tax-core.js so the browser app and Node share one copy. */
module.exports = require("../../tax-core.js").audit;
