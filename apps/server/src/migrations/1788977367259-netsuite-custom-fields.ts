import {MigrationInterface, QueryRunner} from "typeorm";

export class NetsuiteCustomFields1788977367259 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsNetsuiteinternalid" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "product" ADD CONSTRAINT "UQ_6b5fe59c2d3a6468d5603bae1a1" UNIQUE ("customFieldsNetsuiteinternalid")`, undefined);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsNetsuitelastsyncedat" TIMESTAMP(6)`, undefined);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsSynclocked" boolean NOT NULL DEFAULT false`, undefined);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsSalesdescription" text`, undefined);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsStoredescription" text`, undefined);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsFeatureddescription" text`, undefined);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsSdsurl" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsLiteratureurl" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsVideourl" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "product" ADD "customFieldsFeaturedrank" integer NOT NULL DEFAULT '0'`, undefined);
        await queryRunner.query(`ALTER TABLE "asset" ADD "customFieldsNetsuitefilename" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "asset" ADD CONSTRAINT "UQ_12a9bbf9b4f4db14cadf880a7f9" UNIQUE ("customFieldsNetsuitefilename")`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsNetsuiteinternalid" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsNetsuiterecordtype" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsMpn" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsUpc" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsCountryofmanufacture" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsWeight" double precision`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsPacklength" double precision`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsPackwidth" double precision`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsPackheight" double precision`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsPalletquantity" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsPacksize" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsPurchasable" boolean NOT NULL DEFAULT true`, undefined);
        await queryRunner.query(`ALTER TABLE "customer" ADD "customFieldsNetsuiteinternalid" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "customer" ADD CONSTRAINT "UQ_234f97eee1705795bcf0f9d3cec" UNIQUE ("customFieldsNetsuiteinternalid")`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "customer" DROP CONSTRAINT "UQ_234f97eee1705795bcf0f9d3cec"`, undefined);
        await queryRunner.query(`ALTER TABLE "customer" DROP COLUMN "customFieldsNetsuiteinternalid"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsPurchasable"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsPacksize"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsPalletquantity"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsPackheight"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsPackwidth"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsPacklength"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsWeight"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsCountryofmanufacture"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsUpc"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsMpn"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsNetsuiterecordtype"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsNetsuiteinternalid"`, undefined);
        await queryRunner.query(`ALTER TABLE "asset" DROP CONSTRAINT "UQ_12a9bbf9b4f4db14cadf880a7f9"`, undefined);
        await queryRunner.query(`ALTER TABLE "asset" DROP COLUMN "customFieldsNetsuitefilename"`, undefined);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsFeaturedrank"`, undefined);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsVideourl"`, undefined);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsLiteratureurl"`, undefined);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsSdsurl"`, undefined);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsFeatureddescription"`, undefined);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsStoredescription"`, undefined);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsSalesdescription"`, undefined);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsSynclocked"`, undefined);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsNetsuitelastsyncedat"`, undefined);
        await queryRunner.query(`ALTER TABLE "product" DROP CONSTRAINT "UQ_6b5fe59c2d3a6468d5603bae1a1"`, undefined);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customFieldsNetsuiteinternalid"`, undefined);
   }

}
