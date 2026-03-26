/**
 * Converts a target wall-clock time (ISO string) in a specific IANA timezone 
 * into a precise UTC Date object.
 */
export const getZonedUtcDate = (
  isoString: string,   // "2026-03-23T00:00:00.000Z"
  ianaTimezone: string // "America/Bogota"
): Date => {
  // 1. Parse the ISO string as if it were UTC (our "target" wall time)
  const targetTime = new Date(isoString);

  // 2. Use Intl to see what the clock would say in that timezone 
  // if the real time was actually the targetTime.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(targetTime);
  const v: Record<string, string> = {};
  parts.forEach(p => v[p.type] = p.value);

  // 3. Create a Date object representing that "local" clock reading
  const localClock = new Date(Date.UTC(
    Number(v.year),
    Number(v.month) - 1,
    Number(v.day),
    Number(v.hour),
    Number(v.minute),
    Number(v.second)
  ));

  // 4. Calculate the difference (the offset) and apply it to the target
  const diff = localClock.getTime() - targetTime.getTime();
  
  return new Date(targetTime.getTime() - diff);
};

/**
 * Converts a precise UTC Date/string into a Date object representing 
 * the "Wall Clock" time in a specific IANA timezone.
 * * Example: If UTC is 12:00 PM and Bogota is UTC-5, 
 * this returns a Date object set to 07:00 AM.
 */
export const getZonedLocalTime = (
  utcDate: Date | string, 
  ianaTimezone: string
): Date => {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

  // 1. Ask Intl what the clock says in that specific timezone right now
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const v: Record<string, string> = {};
  parts.forEach(p => (v[p.type] = p.value));

  // 2. Construct a Date object that reflects those "local" numbers
  // We use Date.UTC so the numbers aren't shifted by the browser's local timezone
  return new Date(Date.UTC(
    Number(v.year),
    Number(v.month) - 1,
    Number(v.day),
    Number(v.hour),
    Number(v.minute),
    Number(v.second)
  ));
};

export const getYYYYMMDD = (d: any) => {
  const dateObj = new Date(d);
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getUTCString = (dateStr: string, timeZone: string): string => {
  // 1. Create a formatter for the specific IANA zone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // 2. Parse the input string (assumes YYYY-MM-DDTHH:mm:ss)
  const date = new Date(dateStr);
  
  // 3. Extract the components as they would appear in the target timezone
  const parts = formatter.formatToParts(date);
  const partMap: any = {};
  parts.forEach(p => partMap[p.type] = p.value);

  // 4. Construct the UTC timestamp based on those local parts
  const utcTimestamp = Date.UTC(
    parseInt(partMap.year),
    parseInt(partMap.month) - 1,
    parseInt(partMap.day),
    parseInt(partMap.hour) % 24, // Ensures 24 becomes 0
    parseInt(partMap.minute),
    parseInt(partMap.second)
  );

  // 5. Calculate the offset and apply it
  const offset = date.getTime() - utcTimestamp;
  const finalDate = new Date(date.getTime() + offset);

  // 6. Return as ISO string (e.g., "2026-01-01T04:00:00.000Z")
  return finalDate.toISOString();
};

// Example:
// getUTCString("2026-01-01T00:00:00", "America/New_York") 
// Returns: "2026-01-01T05:00:00.000Z" (NY is -5 in Jan)

/**
 * We use Intl to find the offset for this specific timezone at this specific time.
 * This is safer than hardcoding -4 because of potential Daylight Saving changes
 * (though usually not an issue on Jan 1st, it's a good habit).
 */
export const getUTC = (dateStr: string, timeZone: string): Date => {
  // We create a formatter that returns the parts of the date in the target TZ
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // We calculate the difference between the "local" idea of the time 
  // and the UTC time to find the exact moment.
  const date = new Date(dateStr);
  const parts = formatter.formatToParts(date);
  const partMap: any = {};
  parts.forEach(p => partMap[p.type] = p.value);

  const utcDate = Date.UTC(
    parseInt(partMap.year),
    parseInt(partMap.month) - 1,
    parseInt(partMap.day),
    parseInt(partMap.hour),
    parseInt(partMap.minute),
    parseInt(partMap.second)
  );

  const offset = date.getTime() - utcDate;
  return new Date(date.getTime() + offset);
};

export const getUTCIsoString = (dateStr: string, timeZone: string): string => {
  // We create a formatter that returns the parts of the date in the target TZ
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // We calculate the difference between the "local" idea of the time 
  // and the UTC time to find the exact moment.
  const date = new Date(dateStr);
  const parts = formatter.formatToParts(date);
  const partMap: any = {};
  parts.forEach(p => partMap[p.type] = p.value);

  const utcDate = Date.UTC(
    parseInt(partMap.year),
    parseInt(partMap.month) - 1,
    parseInt(partMap.day),
    parseInt(partMap.hour),
    parseInt(partMap.minute),
    parseInt(partMap.second)
  );

  const offset = date.getTime() - utcDate;
  return new Date(date.getTime() + offset).toISOString();
};

export const getYearBoundariesInUTC = (year: number, iana: string) => {
  // 1. Create a string representing the start of the year in the local zone
  // We use the format YYYY-MM-DDTHH:mm:ss
  const localStartStr = `${year}-01-01T00:00:00`;
  const localEndStr = `${year + 1}-01-01T00:00:00`;


  const startDate = getUTC(localStartStr, iana);
  const endDate = getUTC(localEndStr, iana);

  return {
    startDate, // This will be Jan 1, 04:00:00 UTC if offset is -4
    endDate,   // This will be Jan 1 (Next Year), 04:00:00 UTC
    startDateISO: startDate.toISOString(),
    endDateISO: endDate.toISOString()
  };
};

// Example Usage:
// const bounds = getYearBoundariesInUTC(2026, 'America/New_York');
// console.log(bounds.startDateISO); // "2026-01-01T05:00:00.000Z" (NY is -5 in Jan)

interface WeekBoundaries {
  startDate: Date;
  endDate: Date;
  startDateISO: string;
  endDateISO: string;
}

// receives utc dates, calculates boundaries and convert to the 
export const getDayBoundariesInUTC = (dateStr: string, iana: string) => {
  // 1. We expect dateStr in "YYYY-MM-DD" format.
  // We create the "Local" Start and End points for that day.
  const localStartIso = `${dateStr}T00:00:00.000Z`;
  const localEndIso   = `${dateStr}T23:59:59.999Z`; // Or use the start of next day for < logic

  const startDate = getUTC(localStartIso, iana);
  const endDate = getUTC(localEndIso, iana);

  return {
    startDate,
    endDate,
    startDateISO: startDate.toISOString(),
    endDateISO: endDate.toISOString()
  };
};

/**
 * Converts a date string in a specific IANA timezone to a UTC ISO string.
 * @param {string} dateStr - Format "YYYY-MM-DD HH:mm:ss"
 * @param {string} ianaZone - e.g., "America/New_York", "Asia/Tokyo"
 */
export const convertDBToUTC = (dateStr:string, ianaZone:string) => {
  // 1. Replace space with 'T' for valid ISO parsing
  const normalizedStr = dateStr.replace(" ", "T");

  // 2. Get the parts of the date as they would appear in the TARGET timezone
  // We use "en-US" and "hour12: false" to get a clean, parsable format
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ianaZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // 3. Create a UTC date and adjust it based on the IANA offset
  const tempDate = new Date(normalizedStr + "Z");
  const parts = formatter.formatToParts(tempDate);
  
  // Map the parts to a dictionary for easy access
  const p = parts.reduce((acc:any, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  // Construct a date string that represents the "wrong" time 
  // so we can calculate the offset difference
  const dateInZone = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
  
  const offsetMilliseconds = dateInZone.getTime() - tempDate.getTime();
  
  // 4. Subtract the offset from our original input to get the true UTC time
  const finalDate = new Date(new Date(normalizedStr + "Z").getTime() - offsetMilliseconds);

  return finalDate
};




interface DayBounds {
  startDate: Date;
  endDate: Date;
}

/**
 * Calculates the UTC start and end dates for each day of the week 
 * based on a reference date and a target IANA timezone.
 */
export function getDailyWeekBoundariesInUTC(yymmdd: string, ianaZone: string): DayBounds[] {
  // 1. Remove the 'Z' and treat as a local date "wall time"
  const wallTime = new Date(`${yymmdd}T00:00:00.000Z`.replace(/Z$/i, ''));
  
  // 2. Find the Monday of that week (0 = Sunday, 1 = Monday...)
  const dayOfWeek = wallTime.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday = new Date(wallTime);
  monday.setDate(wallTime.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const weekDays: DayBounds[] = [];

  for (let i = 0; i < 7; i++) {
    const currentDay = new Date(monday);
    currentDay.setDate(monday.getDate() + i);

    // Define the local start and end of this specific day
    const localStart = new Date(currentDay);
    const localEnd = new Date(currentDay);
    localEnd.setHours(23, 59, 59, 999);

    // 3. Convert "Wall Time" to actual UTC Date objects 
    // based on the IANA timezone offset
    weekDays.push({
      startDate: convertWallTimeToUTC(localStart, ianaZone),
      endDate: convertWallTimeToUTC(localEnd, ianaZone)
    });
  }

  return weekDays;
}

/**
 * Helper: Adjusts a 'wall clock' date to a real UTC Date 
 * by subtracting the timezone offset.
 */
function convertWallTimeToUTC(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const dateInZone = new Date(
    `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value} ${parts.find(p => p.type === 'hour')?.value}:${parts.find(p => p.type === 'minute')?.value}:${parts.find(p => p.type === 'second')?.value}`
  );

  // The offset is the difference between the "fake" zone date and the original date
  const offset = dateInZone.getTime() - date.getTime();
  return new Date(date.getTime() - offset);
}

// Example Usage:
// const schedule = getWeekDaysInTimezone("2024-05-20T12:00:00Z", "Europe/Amsterdam");
// console.log(schedule);