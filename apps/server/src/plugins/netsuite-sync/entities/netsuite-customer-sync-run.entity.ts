import {DeepPartial} from '@vendure/common/lib/shared-types';
import {VendureEntity} from '@vendure/core';
import {Column, Entity} from 'typeorm';

@Entity('netsuite_customer_sync_run')
export class NetsuiteCustomerSyncRun extends VendureEntity {
    constructor(input?:DeepPartial<NetsuiteCustomerSyncRun>){super(input);}

    @Column({length:32})
    status:string;

    @Column({length:255})
    netsuiteCustomerId:string;

    @Column({type:'simple-json',default:'{}'})
    counts:Record<string,number>;

    @Column({type:'simple-json',default:'[]'})
    issues:Array<{code:string;message:string}>;

    @Column({type:'timestamp',nullable:true})
    finishedAt:Date|null;
}
