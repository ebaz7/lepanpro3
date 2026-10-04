const axios = require('axios');

async function testEndpoint() {
  console.log("Calling /api/sayan/warehouse-inventory on local dev server...");
  const t0 = Date.now();
  try {
    const res = await axios.get('http://localhost:3000/api/sayan/warehouse-inventory', { timeout: 15000 });
    console.log(`Endpoint returned status ${res.status} in ${Date.now() - t0}ms`);
    console.log('Success:', res.data.success);
    console.log('IsLive:', res.data.isLive);
    console.log('FromBenchmark:', res.data.fromBenchmark);
    console.log('LastYear items count:', res.data.lastYearStock?.length);
    console.log('Current items count:', res.data.currentStock?.length);

    if (res.data.lastYearStock && res.data.lastYearStock.length > 0) {
      console.log('Sample LY Item:', res.data.lastYearStock[0]);
    }
    if (res.data.currentStock && res.data.currentStock.length > 0) {
      console.log('Sample Curr Item:', res.data.currentStock[0]);
    }
  } catch (err) {
    console.error("Endpoint call error:", err.message);
  }
}

testEndpoint();
