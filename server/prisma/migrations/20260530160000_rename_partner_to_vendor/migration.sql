-- Rename Role enum value from PARTNER to VENDOR
ALTER TYPE "Role" RENAME VALUE 'PARTNER' TO 'VENDOR';

-- Rename PlaceSource enum value from PARTNER to VENDOR
ALTER TYPE "PlaceSource" RENAME VALUE 'PARTNER' TO 'VENDOR';
