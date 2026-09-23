import {Args,Mutation,Query,Resolver} from '@nestjs/graphql';
import {ID} from '@vendure/common/lib/shared-types';
import {Allow,Ctx,Permission,RequestContext} from '@vendure/core';
import gql from 'graphql-tag';

import {PendingOrderChanges,NetsuiteApprovalService} from './services/netsuite-approval.service';
import {NetsuitePricingService} from './services/netsuite-pricing.service';
import {NetsuiteInvitationService} from './services/netsuite-invitation.service';

export const netsuiteShopSchema=gql`
    type ActiveNetsuitePrice {
        sku: String!
        price: Money
        basePrice: Money
        purchasable: Boolean!
    }
    type ShopNetsuiteAddress implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        label: String
        addressee: String
        attention: String
        streetLine1: String!
        streetLine2: String
        city: String!
        province: String!
        postalCode: String!
        countryCode: String!
        phoneNumber: String
        defaultBilling: Boolean!
        defaultShipping: Boolean!
    }
    type ActiveNetsuiteAccount {
        id: ID!
        companyName: String!
        requiresApproval: Boolean!
        canApproveOrders: Boolean!
        defaultShippingAddressId: ID
        addresses: [ShopNetsuiteAddress!]!
    }
    type NetsuiteInvitationPreview {
        accountName: String!
        emailHint: String!
        expiresAt: DateTime!
        available: Boolean!
    }
    type NetsuiteInvitationAcceptance {
        accountName: String!
    }
    type NetsuiteApprovalEvent implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        actorCustomer: Customer
        action: String!
        comment: String
        changesJson: String
        total: Money!
        totalWithTax: Money!
    }
    type ShopNetsuiteOrderApproval implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        status: String!
        order: Order!
        requester: Customer
        shippingAddress: ShopNetsuiteAddress
        pricingVerifiedAt: DateTime
        taxValidatedAt: DateTime
        decidedAt: DateTime
        decidedByCustomer: Customer
        decisionComment: String
        events: [NetsuiteApprovalEvent!]!
    }
    input PendingOrderLineInput {
        orderLineId: ID!
        quantity: Int!
    }
    input PendingOrderAddItemInput {
        productVariantId: ID!
        quantity: Int!
    }
    input ModifyPendingNetsuiteOrderInput {
        lines: [PendingOrderLineInput!]
        addItems: [PendingOrderAddItemInput!]
        shippingAddressId: ID
        comment: String
    }
    extend type Query {
        activeNetsuiteAccount: ActiveNetsuiteAccount
        activeNetsuitePrices(skus: [String!]!): [ActiveNetsuitePrice!]!
        myNetsuiteApprovalOrders: [ShopNetsuiteOrderApproval!]!
        pendingNetsuiteApprovalOrders: [ShopNetsuiteOrderApproval!]!
        netsuiteApprovalOrder(id: ID!): ShopNetsuiteOrderApproval!
        netsuiteInvitation(token: String!): NetsuiteInvitationPreview!
    }
    extend type Mutation {
        selectNetsuiteShipTo(addressId: ID!): ActiveNetsuiteAccount!
        submitOrderForApproval(addressId: ID): ShopNetsuiteOrderApproval!
        modifyPendingNetsuiteOrder(id: ID!, input: ModifyPendingNetsuiteOrderInput!): ShopNetsuiteOrderApproval!
        approveNetsuiteOrder(id: ID!, comment: String): ShopNetsuiteOrderApproval!
        rejectNetsuiteOrder(id: ID!, comment: String): ShopNetsuiteOrderApproval!
        cancelNetsuiteApprovalOrder(id: ID!, comment: String): ShopNetsuiteOrderApproval!
        acceptNetsuiteInvitation(token: String!): NetsuiteInvitationAcceptance!
    }
`;

@Resolver()
export class NetsuiteB2bResolver {
    constructor(private approvals:NetsuiteApprovalService,private pricing:NetsuitePricingService,private invitations:NetsuiteInvitationService){}

    @Query()
    @Allow(Permission.Public)
    netsuiteInvitation(@Ctx() ctx:RequestContext,@Args('token') token:string){return this.invitations.preview(ctx,token);}

    @Query()
    @Allow(Permission.Authenticated)
    activeNetsuiteAccount(@Ctx() ctx:RequestContext){return this.approvals.activeAccount(ctx);}

    @Query()
    @Allow(Permission.Authenticated)
    activeNetsuitePrices(@Ctx() ctx:RequestContext,@Args('skus') skus:string[]){return this.pricing.activeCustomerPrices(ctx,skus);}

    @Query()
    @Allow(Permission.Authenticated)
    myNetsuiteApprovalOrders(@Ctx() ctx:RequestContext){return this.approvals.mine(ctx);}

    @Query()
    @Allow(Permission.Authenticated)
    pendingNetsuiteApprovalOrders(@Ctx() ctx:RequestContext){return this.approvals.pendingForApprover(ctx);}

    @Query()
    @Allow(Permission.Authenticated)
    netsuiteApprovalOrder(@Ctx() ctx:RequestContext,@Args('id') id:ID){return this.approvals.one(ctx,id);}

    @Mutation()
    @Allow(Permission.Authenticated)
    selectNetsuiteShipTo(@Ctx() ctx:RequestContext,@Args('addressId') addressId:ID){return this.approvals.selectShipTo(ctx,addressId);}

    @Mutation()
    @Allow(Permission.Authenticated)
    submitOrderForApproval(@Ctx() ctx:RequestContext,@Args('addressId') addressId?:ID){return this.approvals.submit(ctx,addressId);}

    @Mutation()
    @Allow(Permission.Authenticated)
    modifyPendingNetsuiteOrder(@Ctx() ctx:RequestContext,@Args('id') id:ID,@Args('input') input:PendingOrderChanges){return this.approvals.modify(ctx,id,input);}

    @Mutation()
    @Allow(Permission.Authenticated)
    approveNetsuiteOrder(@Ctx() ctx:RequestContext,@Args('id') id:ID,@Args('comment') comment?:string){return this.approvals.approve(ctx,id,comment);}

    @Mutation()
    @Allow(Permission.Authenticated)
    rejectNetsuiteOrder(@Ctx() ctx:RequestContext,@Args('id') id:ID,@Args('comment') comment?:string){return this.approvals.reject(ctx,id,comment);}

    @Mutation()
    @Allow(Permission.Authenticated)
    cancelNetsuiteApprovalOrder(@Ctx() ctx:RequestContext,@Args('id') id:ID,@Args('comment') comment?:string){return this.approvals.cancel(ctx,id,comment);}

    @Mutation()
    @Allow(Permission.Authenticated)
    acceptNetsuiteInvitation(@Ctx() ctx:RequestContext,@Args('token') token:string){return this.invitations.accept(ctx,token);}
}
