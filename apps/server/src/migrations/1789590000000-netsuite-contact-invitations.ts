import {MigrationInterface, QueryRunner} from 'typeorm';

export class NetsuiteContactInvitations1789590000000 implements MigrationInterface {
    public async up(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`CREATE TABLE "netsuite_contact_invitation" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "accountId" integer NOT NULL, "netsuiteContactId" character varying(255) NOT NULL, "emailAddress" character varying(320) NOT NULL, "firstName" character varying(255), "lastName" character varying(255), "tokenHash" character varying(64) NOT NULL, "requiresApproval" boolean NOT NULL DEFAULT false, "canApproveOrders" boolean NOT NULL DEFAULT false, "defaultShippingAddressId" integer, "expiresAt" TIMESTAMP NOT NULL, "acceptedAt" TIMESTAMP, "revokedAt" TIMESTAMP, "acceptedByCustomerId" integer, "invitedByUserId" character varying(255) NOT NULL, "id" SERIAL NOT NULL, CONSTRAINT "PK_netsuite_contact_invitation" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3ae5c1f8bb817fa0044c7bae9a" ON "netsuite_contact_invitation" ("tokenHash")`);
        await queryRunner.query(`ALTER TABLE "netsuite_contact_invitation" ADD CONSTRAINT "FK_e9e314651dfb09ddc445960327f" FOREIGN KEY ("accountId") REFERENCES "netsuite_account"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "netsuite_contact_invitation" ADD CONSTRAINT "FK_41ff982c39b90b1cade5bc58fd5" FOREIGN KEY ("defaultShippingAddressId") REFERENCES "netsuite_account_address"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "netsuite_contact_invitation" ADD CONSTRAINT "FK_09495dc8e72e9dd73a01ebf8165" FOREIGN KEY ("acceptedByCustomerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }
    public async down(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`DROP TABLE "netsuite_contact_invitation"`);
    }
}
