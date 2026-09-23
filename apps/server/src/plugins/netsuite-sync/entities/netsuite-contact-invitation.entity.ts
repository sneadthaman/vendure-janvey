import {DeepPartial, ID} from '@vendure/common/lib/shared-types';
import {Customer, VendureEntity} from '@vendure/core';
import {Column, Entity, Index, JoinColumn, ManyToOne} from 'typeorm';

import {NetsuiteAccount} from './netsuite-account.entity';
import {NetsuiteAccountAddress} from './netsuite-account-address.entity';

@Entity('netsuite_contact_invitation')
export class NetsuiteContactInvitation extends VendureEntity {
    constructor(input?:DeepPartial<NetsuiteContactInvitation>){super(input);}

    @ManyToOne(()=>NetsuiteAccount,{onDelete:'CASCADE'}) @JoinColumn({name:'accountId'}) account:NetsuiteAccount;
    @Column({type:'integer'}) accountId:ID;
    @Column({length:255}) netsuiteContactId:string;
    @Column({length:320}) emailAddress:string;
    @Column({type:'varchar',length:255,nullable:true}) firstName:string|null;
    @Column({type:'varchar',length:255,nullable:true}) lastName:string|null;
    @Index({unique:true}) @Column({length:64}) tokenHash:string;
    @Column({default:false}) requiresApproval:boolean;
    @Column({default:false}) canApproveOrders:boolean;
    @ManyToOne(()=>NetsuiteAccountAddress,{nullable:true,onDelete:'SET NULL'}) @JoinColumn({name:'defaultShippingAddressId'}) defaultShippingAddress:NetsuiteAccountAddress|null;
    @Column({type:'integer',nullable:true}) defaultShippingAddressId:ID|null;
    @Column({type:'timestamp'}) expiresAt:Date;
    @Column({type:'timestamp',nullable:true}) acceptedAt:Date|null;
    @Column({type:'timestamp',nullable:true}) revokedAt:Date|null;
    @ManyToOne(()=>Customer,{nullable:true,onDelete:'SET NULL'}) @JoinColumn({name:'acceptedByCustomerId'}) acceptedByCustomer:Customer|null;
    @Column({type:'integer',nullable:true}) acceptedByCustomerId:ID|null;
    @Column({length:255}) invitedByUserId:string;
}
