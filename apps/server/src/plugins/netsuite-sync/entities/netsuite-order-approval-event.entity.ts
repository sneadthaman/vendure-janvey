import {DeepPartial, ID} from '@vendure/common/lib/shared-types';
import {Customer, VendureEntity} from '@vendure/core';
import {Column, Entity, JoinColumn, ManyToOne} from 'typeorm';

import {NetsuiteOrderApproval} from './netsuite-order-approval.entity';

@Entity('netsuite_order_approval_event')
export class NetsuiteOrderApprovalEvent extends VendureEntity {
    constructor(input?:DeepPartial<NetsuiteOrderApprovalEvent>){super(input);}

    @ManyToOne(()=>NetsuiteOrderApproval,approval=>approval.events,{onDelete:'CASCADE'})
    @JoinColumn({name:'approvalId'})
    approval:NetsuiteOrderApproval;

    @Column({type:'integer'})
    approvalId:ID;

    @ManyToOne(()=>Customer,{nullable:true,onDelete:'SET NULL'})
    @JoinColumn({name:'actorCustomerId'})
    actorCustomer:Customer|null;

    @Column({type:'integer',nullable:true})
    actorCustomerId:ID|null;

    @Column({length:255})
    actorUserId:string;

    @Column({length:64})
    action:string;

    @Column({type:'text',nullable:true})
    comment:string|null;

    @Column({type:'text',nullable:true})
    changesJson:string|null;

    @Column({type:'integer'})
    total:number;

    @Column({type:'integer'})
    totalWithTax:number;
}
