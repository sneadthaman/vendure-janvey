import {MigrationInterface,QueryRunner} from 'typeorm';

export class NetsuiteAccountTermsPayment1791360000000 implements MigrationInterface {
    public async up(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`UPDATE "payment_method" SET "code" = 'netsuite-account-terms', "handler" = '{"code":"netsuite-account-terms-handler","args":[]}', "checker" = '{"code":"netsuite-account-terms-eligibility","args":[]}' WHERE "code" = 'standard-payment'`);
        await queryRunner.query(`UPDATE "payment_method_translation" SET "name" = 'Janvey Account Terms', "description" = 'Purchase on your organization''s established NetSuite account terms.' WHERE "baseId" = (SELECT "id" FROM "payment_method" WHERE "code" = 'netsuite-account-terms')`);
    }

    public async down(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`UPDATE "payment_method_translation" SET "name" = 'Standard Payment', "description" = '' WHERE "baseId" = (SELECT "id" FROM "payment_method" WHERE "code" = 'netsuite-account-terms')`);
        await queryRunner.query(`UPDATE "payment_method" SET "code" = 'standard-payment', "handler" = '{"code":"dummy-payment-handler","args":[{"name":"automaticSettle","value":"false"}]}', "checker" = NULL WHERE "code" = 'netsuite-account-terms'`);
    }
}
