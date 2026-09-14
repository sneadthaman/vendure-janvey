import {graphql} from '@/platform/vendure/graphql';

export const ActiveNetsuiteAccountQuery=graphql(`
    query ActiveNetsuiteAccount {
        activeNetsuiteAccount {
            id
            companyName
            requiresApproval
            canApproveOrders
            defaultShippingAddressId
            addresses {
                id label addressee attention streetLine1 streetLine2 city province postalCode countryCode phoneNumber
                defaultBilling defaultShipping
            }
        }
    }
`);

export const ActiveNetsuitePricesQuery=graphql(`
    query ActiveNetsuitePrices($skus: [String!]!) {
        activeNetsuitePrices(skus: $skus) { sku price basePrice purchasable }
    }
`);

export const ApprovalFields=graphql(`
    fragment ApprovalFields on ShopNetsuiteOrderApproval {
        id createdAt updatedAt status pricingVerifiedAt taxValidatedAt decidedAt decisionComment
        requester { id firstName lastName emailAddress }
        decidedByCustomer { id firstName lastName }
        shippingAddress { id label addressee attention streetLine1 streetLine2 city province postalCode countryCode phoneNumber }
        order {
            id code state currencyCode subTotal subTotalWithTax shipping shippingWithTax total totalWithTax
            shippingAddress { fullName company streetLine1 streetLine2 city province postalCode country phoneNumber }
            lines { id quantity unitPrice unitPriceWithTax linePrice linePriceWithTax productVariant { id name sku } }
        }
        events { id createdAt action comment changesJson total totalWithTax actorCustomer { id firstName lastName } }
    }
`);

export const MyApprovalOrdersQuery=graphql(`
    query MyApprovalOrders { myNetsuiteApprovalOrders { ...ApprovalFields } }
`,[ApprovalFields]);

export const PendingApprovalOrdersQuery=graphql(`
    query PendingApprovalOrders { pendingNetsuiteApprovalOrders { ...ApprovalFields } }
`,[ApprovalFields]);

export const SelectNetsuiteShipToMutation=graphql(`
    mutation SelectNetsuiteShipTo($addressId: ID!) {
        selectNetsuiteShipTo(addressId: $addressId) { id defaultShippingAddressId }
    }
`);

export const SubmitOrderForApprovalMutation=graphql(`
    mutation SubmitOrderForApproval($addressId: ID) {
        submitOrderForApproval(addressId: $addressId) { id status order { id code state } }
    }
`);

export const ModifyPendingOrderMutation=graphql(`
    mutation ModifyPendingOrder($id: ID!, $input: ModifyPendingNetsuiteOrderInput!) {
        modifyPendingNetsuiteOrder(id: $id, input: $input) { ...ApprovalFields }
    }
`,[ApprovalFields]);

export const ApproveOrderMutation=graphql(`
    mutation ApproveOrder($id: ID!, $comment: String) {
        approveNetsuiteOrder(id: $id, comment: $comment) { ...ApprovalFields }
    }
`,[ApprovalFields]);

export const RejectOrderMutation=graphql(`
    mutation RejectOrder($id: ID!, $comment: String) {
        rejectNetsuiteOrder(id: $id, comment: $comment) { ...ApprovalFields }
    }
`,[ApprovalFields]);

export const CancelApprovalOrderMutation=graphql(`
    mutation CancelApprovalOrder($id: ID!, $comment: String) {
        cancelNetsuiteApprovalOrder(id: $id, comment: $comment) { ...ApprovalFields }
    }
`,[ApprovalFields]);
