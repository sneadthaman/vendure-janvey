import {DeepPartial} from '@vendure/common/lib/shared-types';
import {VendureEntity} from '@vendure/core';
import {Column, Entity, Index, OneToMany} from 'typeorm';

import {NetsuiteAccountAddress} from './netsuite-account-address.entity';
import {NetsuiteContactLink} from './netsuite-contact-link.entity';

@Entity('netsuite_account')
export class NetsuiteAccount extends VendureEntity {
    constructor(input?:DeepPartial<NetsuiteAccount>){super(input);}

    @Index({unique:true})
    @Column({length:255})
    netsuiteInternalId:string;

    @Column({type:'varchar',length:255,nullable:true})
    entityId:string|null;

    @Column({length:255})
    companyName:string;

    @Column({type:'varchar',length:320,nullable:true})
    emailAddress:string|null;

    @Column({type:'varchar',length:255,nullable:true})
    phoneNumber:string|null;

    @Column({default:true})
    taxable:boolean;

    @Column({default:false})
    taxExempt:boolean;

    @Column({type:'varchar',length:255,nullable:true})
    taxItemId:string|null;

    @Column({type:'float',nullable:true})
    taxRate:number|null;

    @Column({type:'varchar',length:255,nullable:true})
    taxRegistrationNumber:string|null;

    @Column({type:'text',nullable:true})
    taxMetadataJson:string|null;

    @Column({type:'timestamp',nullable:true})
    lastSyncedAt:Date|null;

    @OneToMany(()=>NetsuiteAccountAddress,address=>address.account)
    addresses:NetsuiteAccountAddress[];

    @OneToMany(()=>NetsuiteContactLink,link=>link.account)
    contacts:NetsuiteContactLink[];
}
