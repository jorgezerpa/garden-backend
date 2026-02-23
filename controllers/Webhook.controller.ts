import axios from "axios";
import { prisma } from "../lib/prisma";
import { Call } from "../generated/prisma/client";

const AUTH = ""; // Leaddesk Auth Token

/**
 * handleCallWebhook
 * Logic: Receives last_call_id -> Fetches full details from Leaddesk -> Upserts Agent/Callee -> Creates Call
 */
export const handleCallWebhook = async (lastCallId: string): Promise<Call> => {
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
      update: { 
        name: ld.agent_username,
        teamId: parseInt(ld.agent_group_id) // Dynamically updating team if they switch groups
        // @todo handle team history here too -> create and modify such table -> in necesary? or this is directly stored on the call? I think so
      },
      create: {
        id: parseInt(ld.agent_id),
        name: ld.agent_username,
        teamId: parseInt(ld.agent_group_id), // @todo needs to create the team if not exists 
        companyId: 1, // You'll need a way to determine companyId; using 1 as placeholder @todo -> another option could be: use the "other_" props on the response, is this user managed?
      },
    });

    // 3. Create the Call record
    // Note: I'm mapping 'isEffective' based on existence of orders or specific reason names
    // You can adjust this logic as needed.
    return await tx.call.create({
      data: {
        // id: parseInt(ld.id), // Using Leaddesk's call ID @todo create a new column to store this id 
        agentId: agent.id,
        teamId: agent.teamId,
        calleeId: callee.id,
        startAt: new Date(ld.talk_start),
        endAt: new Date(ld.talk_end),
        durationSeconds: parseInt(ld.talk_time),
        isEffective: ld.order_ids && ld.order_ids.length > 0, // Example logic @todo base this on duration or similars 
      },
    });
  });
};