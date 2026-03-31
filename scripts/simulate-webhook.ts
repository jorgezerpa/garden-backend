import axios from 'axios';

const SERVER_URL = 'http://localhost:3001/api/leaddesk/webhook';
const PUBLIC_KEY = 'pk_6c5626d0-d8f8-4fb0-8cc3-c2294b91f59a';
const SECRET_KEY = 'f499129fa5b9ea455af0bc0a7b6777ef2588cfb2c940ec3ffde1af348492d229';
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