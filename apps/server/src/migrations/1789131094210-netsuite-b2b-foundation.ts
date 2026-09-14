import {MigrationInterface, QueryRunner} from "typeorm";

export class NetsuiteB2bFoundation1789131094210 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "netsuite_account_address" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "accountId" integer NOT NULL, "netsuiteAddressId" character varying(255) NOT NULL, "label" character varying(255), "addressee" character varying(255), "attention" character varying(255), "streetLine1" character varying(255) NOT NULL, "streetLine2" character varying(255), "city" character varying(255) NOT NULL, "province" character varying(255) NOT NULL, "postalCode" character varying(32) NOT NULL, "countryCode" character varying(2) NOT NULL, "phoneNumber" character varying(255), "defaultBilling" boolean NOT NULL DEFAULT false, "defaultShipping" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true, "id" SERIAL NOT NULL, CONSTRAINT "PK_74e989f0ebc3f8a5a8486373227" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a3f10aa1d6b90e2d8d46e0324d" ON "netsuite_account_address" ("accountId", "netsuiteAddressId") `, undefined);
        await queryRunner.query(`CREATE TABLE "netsuite_contact_link" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "accountId" integer NOT NULL, "customerId" integer NOT NULL, "netsuiteContactId" character varying(255), "requiresApproval" boolean NOT NULL DEFAULT false, "canApproveOrders" boolean NOT NULL DEFAULT false, "defaultShippingAddressId" integer, "linkedByUserId" character varying(255) NOT NULL, "id" SERIAL NOT NULL, CONSTRAINT "REL_3061dfb94b3ce05e23feda7a09" UNIQUE ("customerId"), CONSTRAINT "PK_eec20ba00a335d6f6e2088e2157" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3061dfb94b3ce05e23feda7a09" ON "netsuite_contact_link" ("customerId") `, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2dbfe95b85eba26ce375179917" ON "netsuite_contact_link" ("accountId", "netsuiteContactId") `, undefined);
        await queryRunner.query(`CREATE TABLE "netsuite_account" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "netsuiteInternalId" character varying(255) NOT NULL, "entityId" character varying(255), "companyName" character varying(255) NOT NULL, "emailAddress" character varying(320), "phoneNumber" character varying(255), "taxable" boolean NOT NULL DEFAULT true, "taxExempt" boolean NOT NULL DEFAULT false, "taxItemId" character varying(255), "taxRegistrationNumber" character varying(255), "taxMetadataJson" text, "lastSyncedAt" TIMESTAMP, "id" SERIAL NOT NULL, CONSTRAINT "PK_aa92f459438d771531f6c40d645" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_738269df3f8360d5e3dfc82780" ON "netsuite_account" ("netsuiteInternalId") `, undefined);
        await queryRunner.query(`CREATE TABLE "netsuite_customer_sync_run" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "status" character varying(32) NOT NULL, "netsuiteCustomerId" character varying(255) NOT NULL, "counts" text NOT NULL DEFAULT '{}', "issues" text NOT NULL DEFAULT '[]', "finishedAt" TIMESTAMP, "id" SERIAL NOT NULL, CONSTRAINT "PK_2711f6a52b50f5bff30f900776a" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE TABLE "netsuite_order_approval_event" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "approvalId" integer NOT NULL, "actorCustomerId" integer, "actorUserId" character varying(255) NOT NULL, "action" character varying(64) NOT NULL, "comment" text, "changesJson" text, "total" integer NOT NULL, "totalWithTax" integer NOT NULL, "id" SERIAL NOT NULL, CONSTRAINT "PK_0d30708b6dfc8588ca4c2ed38c2" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE TABLE "netsuite_order_approval" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "orderId" integer NOT NULL, "accountId" integer NOT NULL, "requesterCustomerId" integer, "shippingAddressId" integer, "status" character varying(32) NOT NULL DEFAULT 'pending', "pricingVerifiedAt" TIMESTAMP, "taxValidatedAt" TIMESTAMP, "decidedAt" TIMESTAMP, "decidedByCustomerId" integer, "decisionComment" text, "id" SERIAL NOT NULL, CONSTRAINT "REL_2fece6edeae31f7afcbdd3c46d" UNIQUE ("orderId"), CONSTRAINT "PK_213b22e1fea679d946430843787" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2fece6edeae31f7afcbdd3c46d" ON "netsuite_order_approval" ("orderId") `, undefined);
        // Preserve links created with the original one-customer-per-NetSuite-account field.
        await queryRunner.query(`
            INSERT INTO "netsuite_account" ("netsuiteInternalId", "companyName")
            SELECT DISTINCT
                "customFieldsNetsuiteinternalid",
                COALESCE(
                    NULLIF(TRIM(CONCAT_WS(' ', "firstName", "lastName")), ''),
                    NULLIF("emailAddress", ''),
                    'NetSuite account ' || "customFieldsNetsuiteinternalid"
                )
            FROM "customer"
            WHERE "customFieldsNetsuiteinternalid" IS NOT NULL
        `, undefined);
        await queryRunner.query(`
            INSERT INTO "netsuite_contact_link" ("accountId", "customerId", "linkedByUserId")
            SELECT account."id", customer."id", 'migration'
            FROM "customer" customer
            INNER JOIN "netsuite_account" account
                ON account."netsuiteInternalId" = customer."customFieldsNetsuiteinternalid"
            WHERE customer."customFieldsNetsuiteinternalid" IS NOT NULL
        `, undefined);
        await queryRunner.query(`ALTER TABLE "customer" DROP CONSTRAINT "UQ_234f97eee1705795bcf0f9d3cec"`, undefined);
        await queryRunner.query(`ALTER TABLE "customer" DROP COLUMN "customFieldsNetsuiteinternalid"`, undefined);
        await queryRunner.query(`UPDATE "shipping_method" SET "calculator" = jsonb_set("calculator"::jsonb, '{code}', '"netsuite-address-shipping-calculator"')::text WHERE "calculator"::jsonb ->> 'code' = 'default-shipping-calculator'`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_account_address" ADD CONSTRAINT "FK_a256b9eee2bbc7df93f22865336" FOREIGN KEY ("accountId") REFERENCES "netsuite_account"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_contact_link" ADD CONSTRAINT "FK_22a22253946c33b0589a1ce1ee9" FOREIGN KEY ("accountId") REFERENCES "netsuite_account"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_contact_link" ADD CONSTRAINT "FK_3061dfb94b3ce05e23feda7a097" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_contact_link" ADD CONSTRAINT "FK_f33b3170d8fd23087a395c3bf9a" FOREIGN KEY ("defaultShippingAddressId") REFERENCES "netsuite_account_address"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_order_approval_event" ADD CONSTRAINT "FK_830c0615bbe9ebf8d76fb749259" FOREIGN KEY ("approvalId") REFERENCES "netsuite_order_approval"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_order_approval_event" ADD CONSTRAINT "FK_b95e3dbd578600acf022e34fd07" FOREIGN KEY ("actorCustomerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_order_approval" ADD CONSTRAINT "FK_2fece6edeae31f7afcbdd3c46d7" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_order_approval" ADD CONSTRAINT "FK_805ac6519360162e210c265dae4" FOREIGN KEY ("accountId") REFERENCES "netsuite_account"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_order_approval" ADD CONSTRAINT "FK_e0ec82178caee8c07e128d4aadb" FOREIGN KEY ("requesterCustomerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_order_approval" ADD CONSTRAINT "FK_0e56628efc527c2b9e7ae9de80d" FOREIGN KEY ("shippingAddressId") REFERENCES "netsuite_account_address"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_order_approval" ADD CONSTRAINT "FK_6296468ae8917fd8ede3ebf814e" FOREIGN KEY ("decidedByCustomerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`UPDATE "shipping_method" SET "calculator" = jsonb_set("calculator"::jsonb, '{code}', '"default-shipping-calculator"')::text WHERE "calculator"::jsonb ->> 'code' = 'netsuite-address-shipping-calculator'`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_order_approval" DROP CONSTRAINT "FK_6296468ae8917fd8ede3ebf814e"`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_order_approval" DROP CONSTRAINT "FK_0e56628efc527c2b9e7ae9de80d"`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_order_approval" DROP CONSTRAINT "FK_e0ec82178caee8c07e128d4aadb"`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_order_approval" DROP CONSTRAINT "FK_805ac6519360162e210c265dae4"`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_order_approval" DROP CONSTRAINT "FK_2fece6edeae31f7afcbdd3c46d7"`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_order_approval_event" DROP CONSTRAINT "FK_b95e3dbd578600acf022e34fd07"`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_order_approval_event" DROP CONSTRAINT "FK_830c0615bbe9ebf8d76fb749259"`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_contact_link" DROP CONSTRAINT "FK_f33b3170d8fd23087a395c3bf9a"`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_contact_link" DROP CONSTRAINT "FK_3061dfb94b3ce05e23feda7a097"`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_contact_link" DROP CONSTRAINT "FK_22a22253946c33b0589a1ce1ee9"`, undefined);
        await queryRunner.query(`ALTER TABLE "netsuite_account_address" DROP CONSTRAINT "FK_a256b9eee2bbc7df93f22865336"`, undefined);
        await queryRunner.query(`ALTER TABLE "customer" ADD "customFieldsNetsuiteinternalid" character varying(255)`, undefined);
        // The legacy field was unique, so a downgrade restores the earliest contact per account.
        await queryRunner.query(`
            UPDATE "customer" customer
            SET "customFieldsNetsuiteinternalid" = restored."netsuiteInternalId"
            FROM (
                SELECT DISTINCT ON (link."accountId")
                    link."customerId",
                    account."netsuiteInternalId"
                FROM "netsuite_contact_link" link
                INNER JOIN "netsuite_account" account ON account."id" = link."accountId"
                ORDER BY link."accountId", link."id"
            ) restored
            WHERE customer."id" = restored."customerId"
        `, undefined);
        await queryRunner.query(`ALTER TABLE "customer" ADD CONSTRAINT "UQ_234f97eee1705795bcf0f9d3cec" UNIQUE ("customFieldsNetsuiteinternalid")`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_2fece6edeae31f7afcbdd3c46d"`, undefined);
        await queryRunner.query(`DROP TABLE "netsuite_order_approval"`, undefined);
        await queryRunner.query(`DROP TABLE "netsuite_order_approval_event"`, undefined);
        await queryRunner.query(`DROP TABLE "netsuite_customer_sync_run"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_738269df3f8360d5e3dfc82780"`, undefined);
        await queryRunner.query(`DROP TABLE "netsuite_account"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_2dbfe95b85eba26ce375179917"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_3061dfb94b3ce05e23feda7a09"`, undefined);
        await queryRunner.query(`DROP TABLE "netsuite_contact_link"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_a3f10aa1d6b90e2d8d46e0324d"`, undefined);
        await queryRunner.query(`DROP TABLE "netsuite_account_address"`, undefined);
   }

}
