import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import gql from 'graphql-tag';
import { NetsuiteSyncService } from './services/netsuite-sync.service';

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
    extend type Query { netsuiteSyncRuns: [NetsuiteSyncRun!]! }
    extend type Mutation {
        startNetsuiteSync(sampleSize: Int): NetsuiteSyncRun!
        refreshNetsuiteCollections: JSON!
    }
`;

@Resolver()
export class NetsuiteSyncResolver {
    constructor(private sync:NetsuiteSyncService){}
    @Query()
    @Allow(Permission.SuperAdmin)
    netsuiteSyncRuns(@Ctx() ctx:RequestContext){return this.sync.list(ctx);}
    @Mutation()
    @Allow(Permission.SuperAdmin)
    startNetsuiteSync(@Ctx() ctx:RequestContext,@Args('sampleSize') sampleSize?:number){return this.sync.start(ctx,sampleSize??undefined);}
    @Mutation()
    @Allow(Permission.SuperAdmin)
    refreshNetsuiteCollections(@Ctx() ctx:RequestContext){return this.sync.refreshCollections(ctx);}
}
