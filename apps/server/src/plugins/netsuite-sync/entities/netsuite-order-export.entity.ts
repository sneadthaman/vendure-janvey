import {DeepPartial,ID} from '@vendure/common/lib/shared-types';
import {Order,VendureEntity} from '@vendure/core';
import {Column,Entity,Index,JoinColumn,OneToOne} from 'typeorm';

export type NetsuiteOrderExportStatus='pending'|'exporting'|'validated'|'exported'|'exported_with_mismatch'|'failed';

@Entity('netsuite_order_export')
export class NetsuiteOrderExport extends VendureEntity {
    constructor(input?:DeepPartial<NetsuiteOrderExport>){super(input);}

    @OneToOne(()=>Order,{onDelete:'CASCADE'})
    @JoinColumn({name:'orderId'})
    order:Order;

    @Index({unique:true})
    @Column({type:'integer'})
    orderId:ID;

    @Index({unique:true})
    @Column({length:255})
    externalId:string;

    @Column({length:32,default:'pending'})
    status:NetsuiteOrderExportStatus;

    @Column({type:'integer',default:0})
    attemptCount:number;

    @Column({type:'text'})
    contextJson:string;

    @Column({type:'text',nullable:true})
    payloadJson:string|null;

    @Column({type:'varchar',length:64,nullable:true})
    requestHash:string|null;

    @Column({type:'varchar',length:255,nullable:true})
    netsuiteInternalId:string|null;

    @Column({type:'varchar',length:255,nullable:true})
    netsuiteTransactionId:string|null;

    @Column({type:'integer',nullable:true})
    expectedTotalCents:number|null;

    @Column({type:'integer',nullable:true})
    netsuiteTotalCents:number|null;

    @Column({type:'text',nullable:true})
    lastError:string|null;

    @Column({type:'timestamp',nullable:true})
    lastAttemptAt:Date|null;

    @Column({type:'timestamp',nullable:true})
    exportedAt:Date|null;
}
