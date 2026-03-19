CREATE OR REPLACE PROCEDURE reconcile_agent_weekly_levels(
    threshold_gold INT,   -- e.g., 36000 seconds (10 hrs)
    threshold_silver INT  -- e.g., 18000 seconds (5 hrs)
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- 1. Create a temporary 'snapshot' of what everyone's level SHOULD be
    WITH WeeklyStats AS (
        SELECT 
            "agentId",
            SUM("durationSeconds") as total_duration,
            CASE 
                WHEN SUM("durationSeconds") >= threshold_gold THEN 1
                WHEN SUM("durationSeconds") >= threshold_silver THEN 2
                ELSE 3
            END as calculated_level
        FROM "Call"
        -- Only look at calls from the last 7 days
        WHERE "createdAt" >= NOW() - INTERVAL '7 days'
        GROUP BY "agentId"
    ),
    
    -- 2. Identify agents whose level is DIFFERENT from their current active record
    Changes AS (
        SELECT 
            w."agentId",
            w.calculated_level,
            al.id as current_row_id,
            al.level as old_level
        FROM WeeklyStats w
        LEFT JOIN "AgentLevel" al ON w."agentId" = al."agentId" AND al."till" IS NULL
        WHERE al.level IS NULL OR al.level != w.calculated_level
    )

    -- 3. Close the old rows for those who changed
    UPDATE "AgentLevel"
    SET 
        "till" = NOW(),
        "durationInWeeks" = EXTRACT(EPOCH FROM (NOW() - "since")) / 604800
    FROM Changes
    WHERE "AgentLevel".id = Changes.current_row_id;

    -- 4. Insert the new level rows
    INSERT INTO "AgentLevel" ("agentId", "level", "since", "till", "durationInWeeks")
    SELECT "agentId", calculated_level, NOW(), NULL, 0
    FROM Changes;

    COMMIT;
END;
$$;