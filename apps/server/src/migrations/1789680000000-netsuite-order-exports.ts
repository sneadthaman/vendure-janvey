import {MigrationInterface,QueryRunner} from 'typeorm';

export class NetsuiteOrderExports1789680000000 implements MigrationInterface {
    public async up(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`CREATE TABLE "netsuite_order_export" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "orderId" integer NOT NULL, "externalId" character varying(255) NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'pending', "attemptCount" integer NOT NULL DEFAULT 0, "contextJson" text NOT NULL, "payloadJson" text, "requestHash" character varying(64), "netsuiteInternalId" character varying(255), "netsuiteTransactionId" character varying(255), "expectedTotalCents" integer, "netsuiteTotalCents" integer, "lastError" text, "lastAttemptAt" TIMESTAMP, "exportedAt" TIMESTAMP, "id" SERIAL NOT NULL, CONSTRAINT "UQ_b3e53103c80fdbb5ff11094a92a" UNIQUE ("orderId"), CONSTRAINT "PK_netsuite_order_export" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b3e53103c80fdbb5ff11094a92" ON "netsuite_order_export" ("orderId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_585e8943c8a4872a78a6299b5e" ON "netsuite_order_export" ("externalId")`);
        await queryRunner.query(`ALTER TABLE "netsuite_order_export" ADD CONSTRAINT "FK_b3e53103c80fdbb5ff11094a92a" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`DROP TABLE "netsuite_order_export"`);
    }
}
