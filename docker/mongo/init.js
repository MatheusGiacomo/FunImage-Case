// MongoDB initialization for FotoPro
// Runs once on first container start

db = db.getSiblingDB("fotopro_meta");

// ── Collections with schema validation ──────────────────────────────────────

db.createCollection("photo_metadata", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["photo_id", "created_at"],
      properties: {
        photo_id: {
          bsonType: "string",
          description: "UUID of the photo in PostgreSQL"
        },
        exif: {
          bsonType: "object",
          description: "EXIF metadata extracted from the image"
        },
        processing: {
          bsonType: "object",
          description: "Processing audit information"
        },
        ai_tags: {
          bsonType: "array",
          description: "AI-generated content tags"
        }
      }
    }
  },
  validationLevel: "moderate",
  validationAction: "warn"
});

db.createCollection("audit_log", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["event", "user_id", "created_at"],
      properties: {
        event: { bsonType: "string" },
        user_id: { bsonType: "string" },
        created_at: { bsonType: "date" }
      }
    }
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

db.photo_metadata.createIndex({ "photo_id": 1 }, { unique: true, background: true });
db.photo_metadata.createIndex({ "exif.taken_at": -1 }, { background: true });
db.photo_metadata.createIndex({ "exif.camera_model": 1 }, { background: true });

db.audit_log.createIndex({ "user_id": 1, "created_at": -1 }, { background: true });
db.audit_log.createIndex({ "event": 1, "created_at": -1 }, { background: true });
db.audit_log.createIndex({ "resource_id": 1 }, { background: true });
// TTL index — auto-expire audit logs after 2 years (LGPD compliance)
db.audit_log.createIndex(
  { "created_at": 1 },
  { expireAfterSeconds: 63072000, background: true, name: "ttl_2years" }
);

print("MongoDB fotopro_meta initialized successfully.");
