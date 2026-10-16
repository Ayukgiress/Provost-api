import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssistantFoundation1792200000000 implements MigrationInterface {
  name = 'AssistantFoundation1792200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "assistant_message_role" AS ENUM ('user', 'assistant', 'system', 'tool')`);
    await queryRunner.query(`CREATE TYPE "assistant_pending_action_status" AS ENUM ('pending', 'approved', 'rejected', 'expired')`);
    await queryRunner.query(`
      CREATE TABLE "assistant_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assistant_conversations_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_assistant_conversations_user_created" ON "assistant_conversations" ("user_id", "created_at")`);
    await queryRunner.query(`
      CREATE TABLE "assistant_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "role" "assistant_message_role" NOT NULL,
        "content" text NOT NULL,
        "tool_calls" jsonb,
        "cards" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assistant_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_assistant_messages_conversation_id" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_assistant_messages_conversation_created" ON "assistant_messages" ("conversation_id", "created_at")`);
    await queryRunner.query(`
      CREATE TABLE "assistant_usage" (
        "user_id" uuid NOT NULL,
        "date" date NOT NULL,
        "message_count" integer NOT NULL DEFAULT 0,
        "input_tokens" integer NOT NULL DEFAULT 0,
        "output_tokens" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_assistant_usage_user_date" PRIMARY KEY ("user_id", "date")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "assistant_feedback" (
        "message_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "rating" smallint NOT NULL,
        "comment" varchar(500),
        CONSTRAINT "PK_assistant_feedback_message_user" PRIMARY KEY ("message_id", "user_id"),
        CONSTRAINT "FK_assistant_feedback_message_id" FOREIGN KEY ("message_id") REFERENCES "assistant_messages"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "assistant_pending_actions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "action" text NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "assistant_pending_action_status" NOT NULL DEFAULT 'pending',
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assistant_pending_actions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_assistant_pending_actions_conversation_id" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_assistant_pending_actions_user_status_expires" ON "assistant_pending_actions" ("user_id", "status", "expires_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "assistant_pending_actions"`);
    await queryRunner.query(`DROP TABLE "assistant_feedback"`);
    await queryRunner.query(`DROP TABLE "assistant_usage"`);
    await queryRunner.query(`DROP TABLE "assistant_messages"`);
    await queryRunner.query(`DROP TABLE "assistant_conversations"`);
    await queryRunner.query(`DROP TYPE "assistant_pending_action_status"`);
    await queryRunner.query(`DROP TYPE "assistant_message_role"`);
  }
}