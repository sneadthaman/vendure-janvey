import {RequestContext,VendureEvent} from '@vendure/core';

export class NetsuiteContactInvitationEvent extends VendureEvent {
    constructor(public ctx:RequestContext,public recipient:string,public contactName:string,public accountName:string,public token:string,public expiresAt:Date){super();}
}
