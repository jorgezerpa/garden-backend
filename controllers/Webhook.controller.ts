import axios from "axios";
import { prisma } from "../lib/prisma";
import { Call, WEEK_DAYS } from "../generated/prisma/client";
import { convertDBToUTC } from "../utils/date";

const AUTH = ""; // Leaddesk Auth Token

/**
 * handleCallWebhook
 * Logic: Receives last_call_id -> Fetches full details from Leaddesk -> Upserts Agent/Callee -> Creates Call
 */
export const handleCallWebhook = async (lastCallId: string, companyId: number): Promise<{call:Call, userId: number}> => {
    // 0. Check for company
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: { leadDeskCustomData: true }
    });

    if (!company) throw new Error("Company not found");
    if(!company.leadDeskCustomData) throw new Error("no custom data for this company")
    if(company.leadDeskCustomData.SaleEventIds.length==0) throw("Should set LeadDesk Sale Event Ids")
    if(company.leadDeskCustomData.SeedEventIds.length==0) throw("Should set LeadDesk Seed Event Ids")
    if(!company.leadDeskCustomData.authString) throw new Error("Should set LeadDesk Auth String")
  
  const response = await axios.get(`https://api.leaddesk.com`, {
    params: {
      auth: company.leadDeskCustomData.authString,
      mod: "call",
      cmd: "get",
      call_ref_id: lastCallId,
    },
  });

  const ld = response.data; // Leaddesk data object

  // 2. Search for agent using third-party service id 
  const agentToThird = await prisma.agentToThird.findUnique({
    where: {
      serviceIdentifier_agentServiceIdentifier: { serviceIdentifier: "LEADDESK", agentServiceIdentifier: String(ld.agent_id) }
    }
  })

  if(!agentToThird) throw(new Error(`Agent ${ld.agent_id} has no relation with this third party service`))

  const agent = await prisma.agent.findUnique({
    where: { companyId: company.id, id: agentToThird.agentId },
    include: { user: true } 
  })

  if(!agent) throw(new Error("Agent does not exists"))
  if(agent.user?.status!="ACTIVE") throw(new Error("Agent is not active"))


  // 3. Database Sync Logic
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

    const agentToCallee = await tx.agentToCallee.upsert({
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
    const call = await tx.call.create({
      data: {
        agentId: agent.id,
        calleeId: callee.id,
        startAt: convertDBToUTC(ld.talk_start, company.leadDeskCustomData?.IANATimeZone as string),
        endAt: convertDBToUTC(ld.talk_end, company.leadDeskCustomData?.IANATimeZone as string),
        durationSeconds: parseInt(ld.talk_time),
        companyId: company.id,
        dayOfTheWeek: mapDateToWeekDayEnum(ld.talk_start, company.leadDeskCustomData?.IANATimeZone as string)
      },
    });

    // 4. Update Events:
    if(company.leadDeskCustomData?.SeedEventIds.includes(ld.call_ending_reason) || company.leadDeskCustomData?.SeedEventIds.includes(ld.call_ending_reason_name)) {
      await tx.funnelEvent.create({data: { timestamp:convertDBToUTC(ld.talk_start, company.leadDeskCustomData?.IANATimeZone as string), agentId: agent.id, callId: call.id, type: "SEED"}})
    }
    if(agentToCallee.totalAttemps>1) await tx.funnelEvent.create({data: { timestamp:convertDBToUTC(ld.talk_start, company.leadDeskCustomData?.IANATimeZone as string), agentId: agent.id,callId: call.id, type: "LEAD"}})
    
    if(company.leadDeskCustomData?.SeedEventIds.includes(ld.call_ending_reason) || company.leadDeskCustomData?.SeedEventIds.includes(ld.call_ending_reason_name)) {
      await tx.funnelEvent.create({data: { timestamp:convertDBToUTC(ld.talk_start, company.leadDeskCustomData?.IANATimeZone as string), agentId: agent.id,callId: call.id, type: "SALE"}}) 
    }

    return {call, userId: agent.user?.id as number}
  });
};


// helpers 
/**
 * Maps JS getDay() (0-6) to WEEK_DAYS enum strings.
 * JS getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
export const mapDateToWeekDayEnum = (dateString: string, iana: string): WEEK_DAYS => {
  const date = convertDBToUTC(dateString, iana);
  const dayIndex = date.getUTCDay();
  
  const mapping: Record<number, WEEK_DAYS> = {
    0: WEEK_DAYS.SUNDAY,
    1: WEEK_DAYS.MONDAY,
    2: WEEK_DAYS.TUESDAY,
    3: WEEK_DAYS.WEDNESDAY,
    4: WEEK_DAYS.THURSDAY,
    5: WEEK_DAYS.FRIDAY,
    6: WEEK_DAYS.SATURDAY,
  };

  return mapping[dayIndex];
};



