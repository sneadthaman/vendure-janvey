import {DeepPartial, ID} from '@vendure/common/lib/shared-types';
import {Customer, Order, VendureEntity} from '@vendure/core';
import {Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne} from 'typeorm';

import {NetsuiteAccountAddress} from './netsuite-account-address.entity';
import {NetsuiteAccount} from './netsuite-account.entity';
import {NetsuiteOrderApprovalEvent} from './netsuite-order-approval-event.entity';

export type NetsuiteApprovalStatus='pending'|'approved'|'rejected'|'cancelled';

@Entity('netsuite_order_approval')
export class NetsuiteOrderApproval extends VendureEntity {
    constructor(input?:DeepPartial<NetsuiteOrderApproval>){super(input);}

    @OneToOne(()=>Order,{onDelete:'CASCADE'})
    @JoinColumn({name:'orderId'})
    order:Order;

    @Index({unique:true})
    @Column({type:'integer'})
    orderId:ID;

    @ManyToOne(()=>NetsuiteAccount,{onDelete:'RESTRICT'})
    @JoinColumn({name:'accountId'})
    account:NetsuiteAccount;

    @Column({type:'integer'})
    accountId:ID;

    @ManyToOne(()=>Customer,{nullable:true,onDelete:'SET NULL'})
    @JoinColumn({name:'requesterCustomerId'})
    requester:Customer|null;

    @Column({type:'integer',nullable:true})
    requesterCustomerId:ID|null;

    @ManyToOne(()=>NetsuiteAccountAddress,{nullable:true,onDelete:'SET NULL'})
    @JoinColumn({name:'shippingAddressId'})
    shippingAddress:NetsuiteAccountAddress|null;

    @Column({type:'integer',nullable:true})
    shippingAddressId:ID|null;

    @Column({length:32,default:'pending'})
    status:NetsuiteApprovalStatus;

    @Column({type:'timestamp',nullable:true})
    pricingVerifiedAt:Date|null;

    @Column({type:'timestamp',nullable:true})
    taxValidatedAt:Date|null;

    @Column({type:'timestamp',nullable:true})
    decidedAt:Date|null;

    @ManyToOne(()=>Customer,{nullable:true,onDelete:'SET NULL'})
    @JoinColumn({name:'decidedByCustomerId'})
    decidedByCustomer:Customer|null;

    @Column({type:'integer',nullable:true})
    decidedByCustomerId:ID|null;

    @Column({type:'text',nullable:true})
    decisionComment:string|null;

    @OneToMany(()=>NetsuiteOrderApprovalEvent,event=>event.approval)
    events:NetsuiteOrderApprovalEvent[];
}
