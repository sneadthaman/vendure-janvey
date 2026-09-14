import {MigrationInterface, QueryRunner} from 'typeorm';

export class NetsuiteAccountTaxRate1789410000000 implements MigrationInterface {
    public async up(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`ALTER TABLE "netsuite_account" ADD "taxRate" double precision`);
    }

    public async down(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`ALTER TABLE "netsuite_account" DROP COLUMN "taxRate"`);
    }
}
