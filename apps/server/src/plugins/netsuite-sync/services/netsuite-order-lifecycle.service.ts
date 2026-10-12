import {Injectable,Logger} from '@nestjs/common';
import {ID,RequestContext,TransactionalConnection} from '@vendure/core';
import {In,IsNull,Not} from 'typeorm';

import {NetsuiteOrderExport} from '../entities';
import {NetsuiteSalesOrderLifecycleResponse} from '../types';
import {NetsuiteService} from './netsuite.service';

const loggerCtx='NetsuiteOrderLifecycle';

@Injectable()
export class NetsuiteOrderLifecycleService {
    constructor(private connection:TransactionalConnection,private client:NetsuiteService){}

    async forOrder(ctx:RequestContext,orderId:ID,includeInvoices=false){
        const record=await this.connection.getRepository(ctx,NetsuiteOrderExport).findOneBy({orderId});
        const lifecycle=record?this.view(record):null;
        return lifecycle&& !includeInvoices?{...lifecycle,invoices:[]}:lifecycle;
    }

    async refreshOrder(ctx:RequestContext,orderId:ID){
        const record=await this.connection.getRepository(ctx,NetsuiteOrderExport).findOneByOrFail({orderId});
        await this.refresh(ctx,record);
        return this.view(record);
    }

    async refreshExport(ctx:RequestContext,exportId:ID){
        const record=await this.connection.getRepository(ctx,NetsuiteOrderExport).findOneByOrFail({id:exportId});
        await this.refresh(ctx,record);
        return this.view(record);
    }

    async refreshAll(ctx:RequestContext){
        if(!this.client.orderLifecycleConfigured)return {attempted:0,refreshed:0,failed:0};
        const records=await this.connection.getRepository(ctx,NetsuiteOrderExport).find({
            where:{status:In(['exported','exported_with_mismatch']),netsuiteInternalId:Not(IsNull())},
            order:{exportedAt:'DESC'},take:500,
        });
        const pending=records.filter(record=>!this.hasTerminalSnapshot(record));
        let refreshed=0,failed=0;
        for(const record of pending){
            try{await this.refresh(ctx,record);refreshed++;}
            catch(error){failed++;Logger.error(`Order export ${record.id}: ${this.message(error)}`,loggerCtx);}
        }
        return {attempted:pending.length,refreshed,failed,terminalSkipped:records.length-pending.length};
    }

    private async refresh(ctx:RequestContext,record:NetsuiteOrderExport){
        if(!['exported','exported_with_mismatch'].includes(record.status)||!record.netsuiteInternalId)throw new Error('Only exported NetSuite orders can refresh lifecycle data.');
        try{
            const snapshot=await this.client.fetchSalesOrderLifecycle(record.netsuiteInternalId);
            if(snapshot.salesOrder.externalId!==record.externalId||snapshot.salesOrder.transactionId!==record.netsuiteTransactionId){
                throw new Error('NetSuite lifecycle response does not match the export ledger.');
            }
            record.lifecycleJson=JSON.stringify(this.normalizeDates(snapshot));
            record.lifecycleSyncedAt=new Date();
            record.lifecycleLastError=null;
            await this.connection.getRepository(ctx,NetsuiteOrderExport).save(record);
        }catch(error){
            record.lifecycleLastError=this.message(error).slice(0,4000);
            await this.connection.getRepository(ctx,NetsuiteOrderExport).save(record);
            throw error;
        }
    }

    private view(record:NetsuiteOrderExport){
        if(!record.lifecycleJson)return null;
        const snapshot=JSON.parse(record.lifecycleJson) as NetsuiteSalesOrderLifecycleResponse;
        return {...snapshot,syncedAt:record.lifecycleSyncedAt};
    }

    private hasTerminalSnapshot(record:NetsuiteOrderExport){
        if(!record.lifecycleJson)return false;
        try{
            const snapshot=JSON.parse(record.lifecycleJson) as NetsuiteSalesOrderLifecycleResponse;
            const salesOrderStatus=snapshot.salesOrder.statusCode||'';
            if(['C','H'].includes(salesOrderStatus))return true;
            if(salesOrderStatus!=='G'||snapshot.invoices.length===0)return false;
            const terminalInvoiceStatuses=new Set(['paid in full','voided']);
            return snapshot.invoices.every(invoice=>terminalInvoiceStatuses.has((invoice.statusText||'').trim().toLowerCase()));
        }catch{return false;}
    }

    private normalizeDates(snapshot:NetsuiteSalesOrderLifecycleResponse):NetsuiteSalesOrderLifecycleResponse{
        const iso=(value:string|null)=>value?new Date(value).toISOString():null;
        return {
            ...snapshot,
            salesOrder:{...snapshot.salesOrder,orderDate:iso(snapshot.salesOrder.orderDate),lastModifiedAt:iso(snapshot.salesOrder.lastModifiedAt)},
            fulfillments:snapshot.fulfillments.map(value=>({...value,shipDate:iso(value.shipDate),lastModifiedAt:iso(value.lastModifiedAt)})),
            invoices:snapshot.invoices.map(value=>({...value,invoiceDate:iso(value.invoiceDate),dueDate:iso(value.dueDate),lastModifiedAt:iso(value.lastModifiedAt)})),
        };
    }

    private message(error:unknown){return error instanceof Error?error.message:'Unknown NetSuite lifecycle error.';}
}
