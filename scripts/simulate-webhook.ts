import axios from 'axios';

const SERVER_URL = 'http://localhost:3001/api/leaddesk/webhook';
const PUBLIC_KEY = 'pk_55f64e49-8169-43fb-8b79-d16ea347bb24';
const SECRET_KEY = '8fc563eae441c0dd7cf06bd069a896883f12d40cf65c5ba69fca43e79221f3f3';
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
  }, 5000);
}

runSimulation();