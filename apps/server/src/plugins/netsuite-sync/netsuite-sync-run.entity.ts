import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

export interface SyncCounts {
    fetched:number; processed:number; created:number; updated:number; skipped:number;
    disabled:number; failed:number; imagesImported:number; imagesReused:number; imageFailures:number;
    collectionsCreated:number; collectionsRefreshed:number; categoriesPendingReview:number;
    unclassifiedProducts:number; categoryFailures:number; demoProductsDisabled:number;
}
export const emptyCounts=():SyncCounts=>({fetched:0,processed:0,created:0,updated:0,skipped:0,disabled:0,failed:0,imagesImported:0,imagesReused:0,imageFailures:0,collectionsCreated:0,collectionsRefreshed:0,categoriesPendingReview:0,unclassifiedProducts:0,categoryFailures:0,demoProductsDisabled:0});

@Entity()
export class NetsuiteSyncRun extends VendureEntity {
    constructor(input?:DeepPartial<NetsuiteSyncRun>){super(input);}
    @Column({type:'varchar'}) channelId:ID;
    @Column({type:'varchar'}) userId:ID;
    @Column({default:'queued'}) status:string;
    @Column({type:'varchar',nullable:true,unique:true}) activeKey:string|null;
    @Column({type:'varchar',nullable:true}) jobId:string|null;
    @Column({type:'int',nullable:true}) sampleSize:number|null;
    @Column({type:'jsonb',default:{}}) counts:SyncCounts;
    @Column({type:'jsonb',default:[]}) issues:Array<{itemId?:string;message:string}>;
    @Column({default:false}) reconciliationPerformed:boolean;
    @Column({type:'timestamp',nullable:true}) finishedAt:Date|null;
}
