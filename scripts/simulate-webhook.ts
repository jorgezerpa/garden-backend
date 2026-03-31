import axios from 'axios';

const SERVER_URL = 'http://localhost:3001/api/leaddesk/webhook';
const PUBLIC_KEY = 'pk_102c8281-8481-4f6a-a1f5-d7b4efb3284e';
const SECRET_KEY = 'f5b96dd63f11306ef61ac4aa4c228a8c52d7719ef99488a7e77ca9793ceac7f5';
const AUTH_HEADER = `Basic ${Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString('base64')}`;

async function runSimulation() {
  let callId = 100;

  console.log("🚀 Starting LeadDesk Webhook Simulation...");

  setInterval(async () => {
    try {
      console.log(`\nTriggering Webhook for Call ${callId}...`);
      
      const response = await axios.get(SERVER_URL, {
        params: { last_call_id: callId.toString() },
        headers: { 'Authorization': AUTH_HEADER }
      });

      console.log("✅ Webhook processed. Result:", response.data);
      callId++;
    } catch (error: any) {
      console.error("❌ Webhook failed:", error.response?.data || error.message);
    }
  }, 7000);
}

runSimulation();