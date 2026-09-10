import {graphql} from '@/platform/vendure/graphql';
import {ProductCardFragment} from '@/features/products/graphql';

export const GetTopCollectionsQuery = graphql(`
    query GetTopCollections {
        collections(options: { filter: { parentId: { eq: "1" } } }) {
            items {
                id
                name
                slug
                customFields {
                    showInNavigation
                }
                children {
                    id
                    name
                    slug
                    customFields {
                        showInNavigation
                    }
                }
            }
        }
    }
`);

export const GetCollectionProductsQuery = graphql(`
    query GetCollectionProducts($slug: String!, $input: SearchInput!) {
        collection(slug: $slug) {
            id
            name
            slug
            description
            children {
                id
                name
                slug
                customFields {
                    showInNavigation
                }
            }
            featuredAsset {
                id
                preview
            }
        }
        search(input: $input) {
            totalItems
            items {
                ...ProductCard
            }
        }
    }
`, [ProductCardFragment]);
