import {MigrationInterface,QueryRunner} from 'typeorm';

export class OurTruckShipping1789690000000 implements MigrationInterface {
    public async up(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`UPDATE "shipping_method" SET "code" = 'our-truck', "calculator" = jsonb_set("calculator"::jsonb, '{args,0,value}', '"0"')::text WHERE "code" = 'standard-shipping'`);
        await queryRunner.query(`UPDATE "shipping_method_translation" SET "name" = 'Our Truck', "description" = 'Delivered by Janvey at no shipping charge.' WHERE "baseId" = (SELECT "id" FROM "shipping_method" WHERE "code" = 'our-truck')`);
        await queryRunner.query(`UPDATE "shipping_method" SET "deletedAt" = now() WHERE "code" = 'express-shipping' AND "deletedAt" IS NULL`);
    }

    public async down(queryRunner:QueryRunner):Promise<void>{
        await queryRunner.query(`UPDATE "shipping_method" SET "deletedAt" = NULL WHERE "code" = 'express-shipping'`);
        await queryRunner.query(`UPDATE "shipping_method_translation" SET "name" = 'Standard Shipping', "description" = '' WHERE "baseId" = (SELECT "id" FROM "shipping_method" WHERE "code" = 'our-truck')`);
        await queryRunner.query(`UPDATE "shipping_method" SET "code" = 'standard-shipping', "calculator" = jsonb_set("calculator"::jsonb, '{args,0,value}', '"500"')::text WHERE "code" = 'our-truck'`);
    }
}
