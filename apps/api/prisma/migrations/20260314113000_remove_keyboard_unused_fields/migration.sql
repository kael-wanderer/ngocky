UPDATE "Keyboard" AS k
SET "spec" = COALESCE((
    SELECT jsonb_agg(value ORDER BY position)
    FROM (
        SELECT value, MIN(position) AS position
        FROM (
            SELECT elem AS value, ordinality AS position
            FROM jsonb_array_elements_text(COALESCE(k."spec", '[]'::jsonb)) WITH ORDINALITY AS spec_items(elem, ordinality)
            UNION ALL
            SELECT elem AS value, 1000 + ordinality AS position
            FROM jsonb_array_elements_text(COALESCE(k."extras", '[]'::jsonb)) WITH ORDINALITY AS extra_items(elem, ordinality)
        ) combined
        GROUP BY value
    ) deduped
), '[]'::jsonb)
WHERE "extras" IS NOT NULL;

ALTER TABLE "Keyboard"
DROP COLUMN "extras",
DROP COLUMN "stab",
DROP COLUMN "switchAlpha",
DROP COLUMN "switchMod",
DROP COLUMN "assembler";
