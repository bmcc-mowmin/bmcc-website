-- Event.location becomes per-language text ({"en": "..."}); existing values become the English text.
ALTER TABLE "Event"
  ALTER COLUMN "location" TYPE JSONB USING jsonb_build_object('en', "location");
