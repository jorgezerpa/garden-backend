import axios from 'axios';

const SERVER_URL = 'http://localhost:3001/api/leaddesk/webhook';
const PUBLIC_KEY = 'pk_01e81e69-9246-419e-954c-6bbfe4c5b64c';
const SECRET_KEY = 'd624305605d0b64dd91f2f5aec146936a0e0f13efbff5cd5e4664f4bad8c5008';
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
  }, 500);
}

runSimulation();