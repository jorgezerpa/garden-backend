import axios from "axios";
import { prisma } from "../lib/prisma";
import { Call, WEEK_DAYS } from "../generated/prisma/client";

const AUTH = ""; // Leaddesk Auth Token

/**
 * handleCallWebhook
 * Logic: Receives last_call_id -> Fetches full details from Leaddesk -> Upserts Agent/Callee -> Creates Call
 */
export const handleCallWebhook = async (lastCallId: string, companyId: number): Promise<Call> => {
    // 0. Check for company
    const company = await prisma.company.findUnique({
        where: { id: companyId },
    });

    if (!company) throw new Error("Company not found");

  // 1. Fetch full call details from Leaddesk API
  const leadDesk = await prisma.leadDeskCustomData.findUnique({ where: { companyId: company.id }, select: { authString: true } })

  if(!leadDesk?.authString) throw new Error("No LeadDesk Auth String")
  
  const response = await axios.get(`https://api.leaddesk.com`, {
    params: {
      auth: leadDesk.authString,
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

  if(!agentToThird) throw(new Error("Agent has no relation with this third party service"))

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
        startAt: parseToUTC(ld.talk_start),
        endAt: parseToUTC(ld.talk_end),
        durationSeconds: parseInt(ld.talk_time),
        companyId: company.id,
        dayOfTheWeek: mapDateToWeekDayEnum(ld.talk_start)
      },
    });

    // 4. Update Events:
    // if no callee, then is first time is called -> SEED
    // if callee is registered, but is the first time the agent calls them -> SEED
    // if callee is registered, and IS NOT the first time the agent calls them -> LEAD
    // if callee is registered, and IS NOT the first time the agent calls them -> LEAD
    // Independantly if is a SEED or LEAD, if an order was concreted, then is a SALE
    if(agentToCallee.totalAttemps==1) await tx.funnelEvent.create({data: { timestamp:parseToUTC(ld.talk_start), agentId: agent.id,callId: call.id, type: "SEED"}})
    if(agentToCallee.totalAttemps>1) await tx.funnelEvent.create({data: { timestamp:parseToUTC(ld.talk_start), agentId: agent.id,callId: call.id, type: "LEAD"}})
    if(ld.order_ids?.length > 0) await tx.funnelEvent.create({data: { timestamp:parseToUTC(ld.talk_start), agentId: agent.id,callId: call.id, type: "SALE"}})

    return call

  });
};


// helpers 
/**
 * Maps JS getDay() (0-6) to WEEK_DAYS enum strings.
 * JS getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
export const mapDateToWeekDayEnum = (dateString: string): WEEK_DAYS => {
  const date = parseToUTC(dateString);
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



/**
 * Converts a "YYYY-MM-DD HH:MM:SS" string into a UTC Date object
 * without any local timezone shifting.
 */
function parseToUTC(dateString: string) {
  // 1. Split the string into Date and Time parts
  // "2016-01-01 12:13:14" -> ["2016-01-01", "12:13:14"]
  const [datePart, timePart] = dateString.split(' ');

  // 2. Extract numbers from the Date part (Year, Month, Day)
  const [year, month, day] = datePart.split('-').map(Number);

  // 3. Extract numbers from the Time part (Hour, Minute, Second)
  // We use "0" as a fallback if the time part is missing
  const [hours, minutes, seconds] = timePart 
    ? timePart.split(':').map(Number) 
    : [0, 0, 0];

  // 4. Use Date.UTC to create the timestamp
  // IMPORTANT: Months in JavaScript are 0-indexed (Jan = 0), so we subtract 1
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
}