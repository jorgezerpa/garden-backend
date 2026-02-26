import axios from "axios";
import { prisma } from "../lib/prisma";
import { Call } from "../generated/prisma/client";

const AUTH = ""; // Leaddesk Auth Token

/**
 * handleCallWebhook
 * Logic: Receives last_call_id -> Fetches full details from Leaddesk -> Upserts Agent/Callee -> Creates Call
 */
export const handleCallWebhook = async (lastCallId: string, companyApiKey:string, secretHash: string): Promise<Call> => {
    const company = await prisma.company.findFirst({
        where: { 
            // Note: You might need to add an 'apiKey' field to your Company model 
            // Or use the name/unique identifier. For now, we search by name or a custom field.
            apiKey: {
              publicKey: companyApiKey
            }
        },
        include: {
          apiKey: {
            select: {
              secretKeyHash: true
            }
          }
        }
    });

    // if (!company) throw new Error("Company not found for provided API Key"); // @audit@dev it is secure to return this reason? like, this is saying "Hey attacker! you can run this to see if you actually have a valid public key"
    if (!company) throw new Error("Unauthorized");
    if (company.apiKey?.secretKeyHash !== secretHash) throw new Error("Unauthorized") 

  // 1. Fetch full call details from Leaddesk API
  const response = await axios.get(`https://api.leaddesk.com`, {
    params: {
      auth: AUTH,
      mod: "call",
      cmd: "get",
      call_ref_id: lastCallId,
    },
  });

  const ld = response.data; // Leaddesk data object

  // 2. Database Sync Logic
  return await prisma.$transaction(async (tx) => {
    
    // Ensure the Callee (Customer) exists
    const callee = await tx.callee.upsert({
      where: { phoneNumber: ld.number },
      update: { totalAttempts: { increment: 1 } },
      create: { 
        phoneNumber: ld.number,
        totalAttempts: 1 
      },
    });

    // Ensure the Agent exists (Upserting based on Leaddesk Agent ID)
    // We use ID from LD as our primary ID in this logic
    const agent = await tx.agent.upsert({
      where: { id: parseInt(ld.agent_id) },
      update: {},
      create: {
        id: parseInt(ld.agent_id),
        name: ld.agent_username,
        companyId: company.id, // @dev taking it from auth params, another option could be: use the "other_" props on the response
      },
    });

    // 3. Create the Call record
    // Note: I'm mapping 'isEffective' based on existence of orders or specific reason names
    // You can adjust this logic as needed.
    return await tx.call.create({
      data: {
        leadDeskId: ld.id,
        agentId: agent.id,
        calleeId: callee.id,
        startAt: new Date(ld.talk_start),
        endAt: new Date(ld.talk_end),
        durationSeconds: parseInt(ld.talk_time),
        companyId: company.id
      },
    });
  });
};