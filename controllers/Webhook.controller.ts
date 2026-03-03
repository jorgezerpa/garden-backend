import axios from "axios";
import { prisma } from "../lib/prisma";
import { Call } from "../generated/prisma/client";

const AUTH = ""; // Leaddesk Auth Token

/**
 * handleCallWebhook
 * Logic: Receives last_call_id -> Fetches full details from Leaddesk -> Upserts Agent/Callee -> Creates Call
 */
export const handleCallWebhook = async (lastCallId: string, companyId: number): Promise<Call> => {
    const company = await prisma.company.findUnique({
        where: { id: companyId },
    });

    if (!company) throw new Error("Company not found");

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

  const agent = await prisma.agent.findUnique({
    where: { id: parseInt(ld.agent_id), companyId: company.id } // important to add companyId, because could be repeated @todo@dev add constraint companyId-agentId
  })

  if(!agent) throw(new Error("Agent does not exists"))

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

    await tx.agentToCallee.upsert({
      where: { agentId_calleeId: {  agentId: agent.id, calleeId: callee.id } },
      update: {
        totalAttemps: { increment: 1 }
      },
      create: {
        agentId: agent.id,
        calleeId: callee.id,
        totalAttemps: 1
      }
    })

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