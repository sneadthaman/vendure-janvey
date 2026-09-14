import {DeepPartial, ID} from '@vendure/common/lib/shared-types';
import {VendureEntity} from '@vendure/core';
import {Column, Entity, Index, JoinColumn, ManyToOne} from 'typeorm';

import {NetsuiteAccount} from './netsuite-account.entity';

@Entity('netsuite_account_address')
@Index(['accountId','netsuiteAddressId'],{unique:true})
export class NetsuiteAccountAddress extends VendureEntity {
    constructor(input?:DeepPartial<NetsuiteAccountAddress>){super(input);}

    @ManyToOne(()=>NetsuiteAccount,account=>account.addresses,{onDelete:'CASCADE'})
    @JoinColumn({name:'accountId'})
    account:NetsuiteAccount;

    @Column({type:'integer'})
    accountId:ID;

    @Column({length:255})
    netsuiteAddressId:string;

    @Column({type:'varchar',length:255,nullable:true})
    label:string|null;

    @Column({type:'varchar',length:255,nullable:true})
    addressee:string|null;

    @Column({type:'varchar',length:255,nullable:true})
    attention:string|null;

    @Column({length:255})
    streetLine1:string;

    @Column({type:'varchar',length:255,nullable:true})
    streetLine2:string|null;

    @Column({length:255})
    city:string;

    @Column({length:255})
    province:string;

    @Column({length:32})
    postalCode:string;

    @Column({length:2})
    countryCode:string;

    @Column({type:'varchar',length:255,nullable:true})
    phoneNumber:string|null;

    @Column({default:false})
    defaultBilling:boolean;

    @Column({default:false})
    defaultShipping:boolean;

    @Column({default:true})
    active:boolean;
}
