import {Order,RequestContext,VendureEvent} from '@vendure/core';

export class NetsuiteApprovalRequestedEvent extends VendureEvent {
    constructor(
        public ctx:RequestContext,
        public recipient:string,
        public order:Order,
        public requesterName:string,
        public accountName:string,
    ){super();}
}

export class NetsuiteApprovalDecisionEvent extends VendureEvent {
    constructor(
        public ctx:RequestContext,
        public recipient:string,
        public order:Order,
        public decision:string,
        public actorName:string,
        public comment:string|null,
    ){super();}
}
