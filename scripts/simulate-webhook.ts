import axios from 'axios';

const SERVER_URL = 'http://localhost:3001/api/leaddesk/webhook';
const PUBLIC_KEY = 'pk_f9f2dae9-73e7-47c0-a2ad-26e87200f01f';
const SECRET_KEY = 'b643c49325fdda632ce8c46046a24416ab6574d177c344e1936e64d201a94309';
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