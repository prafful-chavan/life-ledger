const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const funds = await get("https://api.mfapi.in/mf");
  const itiFunds = funds.filter(f => f.schemeName.toLowerCase().includes('iti'));
  console.log(`Found ${itiFunds.length} ITI funds.`);
  
  for (const f of itiFunds) {
    try {
      const details = await get(`https://api.mfapi.in/mf/${f.schemeCode}`);
      const latestData = details.data?.[0];
      const nav = latestData ? latestData.nav : 'N/A';
      console.log(`Code: ${f.schemeCode} | NAV: ${nav} | Name: ${f.schemeName}`);
    } catch (e) {
      // ignore
    }
  }
}

main().catch(console.error);
