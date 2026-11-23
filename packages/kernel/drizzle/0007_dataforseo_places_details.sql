-- A connection keeps the capabilities its provider offered when it was made. DataForSEO now also answers
-- places.details (a business's full profile and Google's category list): connections made before it get it too.
UPDATE "integrations"."connections"
SET "capabilities" = array_append("capabilities", 'places.details')
WHERE "provider_id" = 'dataforseo' AND NOT ("capabilities" @> ARRAY['places.details']::text[]);
