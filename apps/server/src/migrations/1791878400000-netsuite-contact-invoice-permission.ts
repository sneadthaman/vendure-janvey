import {MigrationInterface,QueryRunner} from 'typeorm';

export class NetsuiteContactInvoicePermission1791878400000 implements MigrationInterface {
    public async up(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`ALTER TABLE "netsuite_contact_link" ADD "canViewInvoices" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "netsuite_contact_invitation" ADD "canViewInvoices" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`ALTER TABLE "netsuite_contact_invitation" DROP COLUMN "canViewInvoices"`);
        await queryRunner.query(`ALTER TABLE "netsuite_contact_link" DROP COLUMN "canViewInvoices"`);
    }
}
