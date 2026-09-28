import {graphql} from '@/platform/vendure/graphql';

export const ProductCardFragment = graphql(`
    fragment ProductCard on SearchResult {
        productId
        productName
        sku
        slug
        productAsset {
            id
            preview
        }
        price {
            __typename
            ... on PriceRange {
                min
                max
            }
            ... on SinglePrice {
                value
            }
        }
        currencyCode
    }
`);

export const GetProductDetailQuery = graphql(`
    query GetProductDetail($slug: String!) {
        product(slug: $slug) {
            id
            name
            description
            slug
            customFields {
                salesDescription
                storeDescription
                sdsUrl
                literatureUrl
                videoUrl
            }
            facetValues {
                name
                facet {
                    code
                    name
                }
            }
            assets {
                id
                preview
                source
            }
            variants {
                id
                name
                sku
                price
                stockLevel
                customFields {
                    mpn
                    upc
                    countryOfManufacture
                    weight
                    packLength
                    packWidth
                    packHeight
                    palletQuantity
                    packSize
                    purchasable
                }
                options {
                    id
                    code
                    name
                    groupId
                    group {
                        id
                        code
                        name
                    }
                }
            }
            optionGroups {
                id
                code
                name
                options {
                    id
                    code
                    name
                }
            }
            collections {
                id
                name
                slug
                parent {
                    id
                }
            }
        }
    }
`);
