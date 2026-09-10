import {MigrationInterface, QueryRunner} from "typeorm";

export class NetsuiteSyncRuns1788980050672 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "netsuite_sync_run" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "channelId" character varying NOT NULL, "userId" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'queued', "activeKey" character varying, "jobId" character varying, "sampleSize" integer, "counts" jsonb NOT NULL DEFAULT '{}', "issues" jsonb NOT NULL DEFAULT '[]', "reconciliationPerformed" boolean NOT NULL DEFAULT false, "finishedAt" TIMESTAMP, "id" SERIAL NOT NULL, CONSTRAINT "UQ_43858e35155063b03884fcdd026" UNIQUE ("activeKey"), CONSTRAINT "PK_7d0be8df10048ec7b30f4aea455" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`ALTER TABLE "asset" ADD "customFieldsNetsuitesourcefingerprint" character varying(255)`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "asset" DROP COLUMN "customFieldsNetsuitesourcefingerprint"`, undefined);
        await queryRunner.query(`DROP TABLE "netsuite_sync_run"`, undefined);
   }

}
