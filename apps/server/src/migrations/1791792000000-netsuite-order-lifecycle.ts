import {MigrationInterface,QueryRunner} from 'typeorm';

export class NetsuiteOrderLifecycle1791792000000 implements MigrationInterface {
    public async up(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`ALTER TABLE "netsuite_order_export" ADD "lifecycleJson" text`);
        await queryRunner.query(`ALTER TABLE "netsuite_order_export" ADD "lifecycleSyncedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "netsuite_order_export" ADD "lifecycleLastError" text`);
    }

    public async down(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`ALTER TABLE "netsuite_order_export" DROP COLUMN "lifecycleLastError"`);
        await queryRunner.query(`ALTER TABLE "netsuite_order_export" DROP COLUMN "lifecycleSyncedAt"`);
        await queryRunner.query(`ALTER TABLE "netsuite_order_export" DROP COLUMN "lifecycleJson"`);
    }
}
