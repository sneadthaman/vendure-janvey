import {MigrationInterface, QueryRunner} from 'typeorm';

export class NetsuiteCustomerEligibility1789500000000 implements MigrationInterface {
    public async up(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`ALTER TABLE "netsuite_account" ADD "active" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "netsuite_account" ADD "webCustomer" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "netsuite_account" ADD "eligibilityIssue" character varying(512)`);
        await queryRunner.query(`ALTER TABLE "netsuite_contact_link" ADD "active" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "netsuite_contact_link" ADD "eligibilityIssue" character varying(512)`);
    }

    public async down(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`ALTER TABLE "netsuite_contact_link" DROP COLUMN "eligibilityIssue"`);
        await queryRunner.query(`ALTER TABLE "netsuite_contact_link" DROP COLUMN "active"`);
        await queryRunner.query(`ALTER TABLE "netsuite_account" DROP COLUMN "eligibilityIssue"`);
        await queryRunner.query(`ALTER TABLE "netsuite_account" DROP COLUMN "webCustomer"`);
        await queryRunner.query(`ALTER TABLE "netsuite_account" DROP COLUMN "active"`);
    }
}
