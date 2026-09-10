import { MigrationInterface, QueryRunner } from 'typeorm';

export class NetsuiteCollections1789061000000 implements MigrationInterface {
    name='NetsuiteCollections1789061000000';
    async up(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`ALTER TABLE "collection" ADD "customFieldsNetsuiteclasskey" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "collection" ADD CONSTRAINT "UQ_collection_netsuite_class_key" UNIQUE ("customFieldsNetsuiteclasskey")`);
        await queryRunner.query(`ALTER TABLE "collection" ADD "customFieldsShowinnavigation" boolean NOT NULL DEFAULT true`);
    }
    async down(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`ALTER TABLE "collection" DROP COLUMN "customFieldsShowinnavigation"`);
        await queryRunner.query(`ALTER TABLE "collection" DROP CONSTRAINT "UQ_collection_netsuite_class_key"`);
        await queryRunner.query(`ALTER TABLE "collection" DROP COLUMN "customFieldsNetsuiteclasskey"`);
    }
}
