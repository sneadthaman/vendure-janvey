const path = require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../apps/server/.env'),quiet:true});
const {Client} = require('pg');

async function main() {
    const client = new Client({
        host:process.env.DB_HOST,
        port:Number(process.env.DB_PORT),
        database:process.env.DB_NAME,
        user:process.env.DB_USERNAME,
        password:process.env.DB_PASSWORD,
    });
    await client.connect();
    const one = async sql => (await client.query(sql)).rows[0];
    const many = async sql => (await client.query(sql)).rows;
    try {
        const result = {
            products:await one(`SELECT count(*)::int total,
                count(*) FILTER (WHERE enabled)::int enabled,
                count(*) FILTER (WHERE "featuredAssetId" IS NOT NULL)::int with_image
                FROM product WHERE "deletedAt" IS NULL
                AND "customFieldsNetsuiteinternalid" IS NOT NULL`),
            variants:await one(`SELECT count(*)::int total,
                count(*) FILTER (WHERE enabled)::int enabled,
                count(*) FILTER (WHERE NOT "customFieldsPurchasable")::int unpurchasable
                FROM product_variant WHERE "deletedAt" IS NULL
                AND "customFieldsNetsuiteinternalid" IS NOT NULL`),
            assets:await one(`SELECT count(*)::int total FROM asset
                WHERE "customFieldsNetsuitefilename" IS NOT NULL`),
            facets:await many(`SELECT f.code,count(v.id)::int values
                FROM facet f LEFT JOIN facet_value v ON v."facetId"=f.id
                WHERE f.code IN ('netsuite-manufacturer','netsuite-class')
                GROUP BY f.code ORDER BY f.code`),
            categoryParents:await many(`SELECT ct.name,count(cpv."productVariantId")::int variants
                FROM collection c JOIN collection_translation ct ON ct."baseId"=c.id AND ct."languageCode"='en'
                LEFT JOIN collection_product_variants_product_variant cpv ON cpv."collectionId"=c.id
                WHERE c."customFieldsNetsuiteclasskey" LIKE 'group:%'
                GROUP BY c.id,ct.name,c.position ORDER BY c.position`),
            categories:await one(`SELECT
                count(*) FILTER (WHERE "customFieldsNetsuiteclasskey" NOT LIKE 'group:%' AND "customFieldsNetsuiteclasskey" NOT LIKE 'system:%')::int class_collections,
                count(*) FILTER (WHERE "customFieldsNetsuiteclasskey"='system:featured-products')::int featured_collections,
                count(*) FILTER (WHERE "customFieldsNetsuiteclasskey"='system:needs-classification' AND "isPrivate")::int private_review_collections
                FROM collection`),
            demoProducts:await one(`SELECT
                count(*)::int total,
                count(*) FILTER (WHERE enabled)::int enabled
                FROM product WHERE "deletedAt" IS NULL AND "customFieldsNetsuiteinternalid" IS NULL`),
            unclassified:await one(`SELECT count(*)::int total FROM product p
                WHERE p."deletedAt" IS NULL AND p."customFieldsNetsuiteinternalid" IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1 FROM product_facet_values_facet_value pfv
                    JOIN facet_value fv ON fv.id=pfv."facetValueId"
                    JOIN facet f ON f.id=fv."facetId" AND f.code='netsuite-class'
                    WHERE pfv."productId"=p.id
                )`),
        };
        console.log(JSON.stringify(result,null,2));
    } finally {
        await client.end();
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode=1;
});
