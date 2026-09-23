import {DeepPartial, ID} from '@vendure/common/lib/shared-types';
import {Customer, VendureEntity} from '@vendure/core';
import {Column, Entity, Index, JoinColumn, ManyToOne, OneToOne} from 'typeorm';

import {NetsuiteAccountAddress} from './netsuite-account-address.entity';
import {NetsuiteAccount} from './netsuite-account.entity';

@Entity('netsuite_contact_link')
@Index(['accountId','netsuiteContactId'],{unique:true})
export class NetsuiteContactLink extends VendureEntity {
    constructor(input?:DeepPartial<NetsuiteContactLink>){super(input);}

    @ManyToOne(()=>NetsuiteAccount,account=>account.contacts,{onDelete:'RESTRICT'})
    @JoinColumn({name:'accountId'})
    account:NetsuiteAccount;

    @Column({type:'integer'})
    accountId:ID;

    @OneToOne(()=>Customer,{onDelete:'CASCADE'})
    @JoinColumn({name:'customerId'})
    customer:Customer;

    @Index({unique:true})
    @Column({type:'integer'})
    customerId:ID;

    @Column({type:'varchar',length:255,nullable:true})
    netsuiteContactId:string|null;

    @Column({default:false})
    requiresApproval:boolean;

    @Column({default:false})
    canApproveOrders:boolean;

    @Column({default:true})
    active:boolean;

    @Column({type:'varchar',length:512,nullable:true})
    eligibilityIssue:string|null;

    @ManyToOne(()=>NetsuiteAccountAddress,{nullable:true,onDelete:'SET NULL'})
    @JoinColumn({name:'defaultShippingAddressId'})
    defaultShippingAddress:NetsuiteAccountAddress|null;

    @Column({type:'integer',nullable:true})
    defaultShippingAddressId:ID|null;

    @Column({length:255})
    linkedByUserId:string;
}
