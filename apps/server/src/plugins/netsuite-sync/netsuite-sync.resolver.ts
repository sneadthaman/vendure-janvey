import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import gql from 'graphql-tag';
import { NetsuiteSyncService } from './services/netsuite-sync.service';
import { NetsuiteCustomerService } from './services/netsuite-customer.service';
import {ID} from '@vendure/common/lib/shared-types';
import {NetsuiteApprovalService} from './services/netsuite-approval.service';
import {NetsuiteInvitationService} from './services/netsuite-invitation.service';

export const netsuiteAdminSchema=gql`
    type NetsuiteSyncRun implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        status: String!
        sampleSize: Int
        counts: JSON!
        issues: JSON!
        reconciliationPerformed: Boolean!
        finishedAt: DateTime
    }
    type NetsuiteAccountAddress implements Node {
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
        active: Boolean!
    }
    type NetsuiteContactLink implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        customer: Customer!
        netsuiteContactId: String
        requiresApproval: Boolean!
        canApproveOrders: Boolean!
        active: Boolean!
        eligibilityIssue: String
        defaultShippingAddress: NetsuiteAccountAddress
    }
    type NetsuiteAccount implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        netsuiteInternalId: String!
        entityId: String
        companyName: String!
        emailAddress: String
        phoneNumber: String
        taxable: Boolean!
        taxExempt: Boolean!
        active: Boolean!
        webCustomer: Boolean!
        eligibilityIssue: String
        taxItemId: String
        taxRegistrationNumber: String
        taxMetadataJson: String
        lastSyncedAt: DateTime
        addresses: [NetsuiteAccountAddress!]!
        contacts: [NetsuiteContactLink!]!
    }
    type NetsuiteCustomerSyncRun implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        status: String!
        netsuiteCustomerId: String!
        counts: JSON!
        issues: JSON!
        finishedAt: DateTime
    }
    type NetsuiteContactInvitation implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        account: NetsuiteAccount!
        netsuiteContactId: String!
        emailAddress: String!
        firstName: String
        lastName: String
        requiresApproval: Boolean!
        canApproveOrders: Boolean!
        defaultShippingAddress: NetsuiteAccountAddress
        expiresAt: DateTime!
        acceptedAt: DateTime
        revokedAt: DateTime
        acceptedByCustomer: Customer
    }
    type NetsuiteCustomerCandidate {
        internalId: String!
        entityId: String
        companyName: String
        active: Boolean!
    }
    type AdminNetsuiteApprovalEvent implements Node {
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
    type AdminNetsuiteOrderApproval implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        status: String!
        account: NetsuiteAccount!
        order: Order!
        requester: Customer
        shippingAddress: NetsuiteAccountAddress
        pricingVerifiedAt: DateTime
        taxValidatedAt: DateTime
        decidedAt: DateTime
        decidedByCustomer: Customer
        decisionComment: String
        events: [AdminNetsuiteApprovalEvent!]!
    }
    input LinkNetsuiteCustomerInput {
        customerId: ID!
        accountId: ID!
        netsuiteContactId: String
        requiresApproval: Boolean
        canApproveOrders: Boolean
        defaultShippingAddressId: ID
    }
    input UpdateNetsuiteContactLinkInput {
        customerId: ID!
        requiresApproval: Boolean
        canApproveOrders: Boolean
        defaultShippingAddressId: ID
    }
    input InviteNetsuiteContactInput {
        accountId: ID!
        netsuiteContactId: String!
        requiresApproval: Boolean
        canApproveOrders: Boolean
        defaultShippingAddressId: ID
    }
    extend type Query {
        netsuiteSyncRuns: [NetsuiteSyncRun!]!
        netsuiteAccounts: [NetsuiteAccount!]!
        netsuiteCustomerSyncRuns: [NetsuiteCustomerSyncRun!]!
        netsuiteContactInvitations: [NetsuiteContactInvitation!]!
        inspectNetsuiteCustomer(customerId: String!): JSON!
        findNetsuiteCustomers(query: String!): [NetsuiteCustomerCandidate!]!
        netsuiteApprovalOrders(status: String): [AdminNetsuiteOrderApproval!]!
        netsuiteOrderExportEligible(orderId: ID!): Boolean!
    }
    extend type Mutation {
        startNetsuiteSync(sampleSize: Int): NetsuiteSyncRun!
        refreshNetsuiteCollections: JSON!
        syncNetsuiteCustomer(customerId: String!): NetsuiteAccount!
        linkNetsuiteCustomer(input: LinkNetsuiteCustomerInput!): Boolean!
        updateNetsuiteContactLink(input: UpdateNetsuiteContactLinkInput!): Boolean!
        unlinkNetsuiteCustomer(customerId: ID!): Boolean!
        inviteNetsuiteContact(input: InviteNetsuiteContactInput!): NetsuiteContactInvitation!
        resolveNetsuiteApprovalOrder(id: ID!, action: String!, comment: String): AdminNetsuiteOrderApproval!
    }
`;

@Resolver()
export class NetsuiteSyncResolver {
    constructor(private sync:NetsuiteSyncService,private customers:NetsuiteCustomerService,private approvals:NetsuiteApprovalService,private invitations:NetsuiteInvitationService){}
    @Query()
    @Allow(Permission.SuperAdmin)
    netsuiteSyncRuns(@Ctx() ctx:RequestContext){return this.sync.list(ctx);}
    @Mutation()
    @Allow(Permission.SuperAdmin)
    startNetsuiteSync(@Ctx() ctx:RequestContext,@Args('sampleSize') sampleSize?:number){return this.sync.start(ctx,sampleSize??undefined);}
    @Mutation()
    @Allow(Permission.SuperAdmin)
    refreshNetsuiteCollections(@Ctx() ctx:RequestContext){return this.sync.refreshCollections(ctx);}
    @Query()
    @Allow(Permission.SuperAdmin)
    netsuiteAccounts(@Ctx() ctx:RequestContext){return this.customers.listAccounts(ctx);}
    @Query()
    @Allow(Permission.SuperAdmin)
    netsuiteCustomerSyncRuns(@Ctx() ctx:RequestContext){return this.customers.listRuns(ctx);}
    @Query()
    @Allow(Permission.SuperAdmin)
    netsuiteContactInvitations(@Ctx() ctx:RequestContext){return this.invitations.list(ctx);}
    @Query()
    @Allow(Permission.SuperAdmin)
    inspectNetsuiteCustomer(@Args('customerId') customerId:string){return this.customers.inspect(customerId);}
    @Query()
    @Allow(Permission.SuperAdmin)
    findNetsuiteCustomers(@Args('query') query:string){return this.customers.search(query);}
    @Mutation()
    @Allow(Permission.SuperAdmin)
    syncNetsuiteCustomer(@Ctx() ctx:RequestContext,@Args('customerId') customerId:string){return this.customers.syncAccount(ctx,customerId);}
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async linkNetsuiteCustomer(@Ctx() ctx:RequestContext,@Args('input') input:{customerId:ID;accountId:ID;netsuiteContactId?:string;requiresApproval?:boolean;canApproveOrders?:boolean;defaultShippingAddressId?:ID}){await this.customers.linkCustomer(ctx,input);return true;}
    @Mutation()
    @Allow(Permission.SuperAdmin)
    async updateNetsuiteContactLink(@Ctx() ctx:RequestContext,@Args('input') input:{customerId:ID;requiresApproval?:boolean;canApproveOrders?:boolean;defaultShippingAddressId?:ID}){await this.customers.updateLink(ctx,input);return true;}
    @Mutation()
    @Allow(Permission.SuperAdmin)
    unlinkNetsuiteCustomer(@Ctx() ctx:RequestContext,@Args('customerId') customerId:ID){return this.customers.unlinkCustomer(ctx,customerId);}
    @Mutation()
    @Allow(Permission.SuperAdmin)
    inviteNetsuiteContact(@Ctx() ctx:RequestContext,@Args('input') input:{accountId:ID;netsuiteContactId:string;requiresApproval?:boolean;canApproveOrders?:boolean;defaultShippingAddressId?:ID}){return this.invitations.invite(ctx,input);}
    @Query()
    @Allow(Permission.SuperAdmin)
    netsuiteApprovalOrders(@Ctx() ctx:RequestContext,@Args('status') status?:string){return this.approvals.listForStaff(ctx,status);}
    @Query()
    @Allow(Permission.SuperAdmin)
    netsuiteOrderExportEligible(@Ctx() ctx:RequestContext,@Args('orderId') orderId:ID){return this.approvals.isExportEligible(ctx,orderId);}
    @Mutation()
    @Allow(Permission.SuperAdmin)
    resolveNetsuiteApprovalOrder(@Ctx() ctx:RequestContext,@Args('id') id:ID,@Args('action') action:'approve'|'reject'|'cancel',@Args('comment') comment?:string){return this.approvals.staffResolve(ctx,id,action,comment);}
}
