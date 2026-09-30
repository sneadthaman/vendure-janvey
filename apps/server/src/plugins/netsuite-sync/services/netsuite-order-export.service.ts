import {Injectable,Logger,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {CurrencyCode,EventBus,ID,Job,JobQueue,JobQueueService,Order,OrderService,OrderStateTransitionEvent,ProcessContext,RequestContext,TransactionalConnection} from '@vendure/core';
import {createHash} from 'node:crypto';
import {In} from 'typeorm';
import {Subscription} from 'rxjs';

import {NetsuiteAccountAddress,NetsuiteContactLink,NetsuiteOrderApproval,NetsuiteOrderExport} from '../entities';
import {NetsuiteSalesOrderRequest} from '../types';
import {NetsuiteService} from './netsuite.service';

const loggerCtx='NetsuiteOrderExport';
const directExportStates:ReadonlyArray<Order['state']>=['PaymentAuthorized','PaymentSettled'];
type ExportJob={exportId:string;context:ReturnType<RequestContext['serialize']>};

@Injectable()
export class NetsuiteOrderExportService implements OnModuleInit,OnModuleDestroy {
    private readonly orderRelations=['customer','lines','lines.productVariant','shippingLines','surcharges'] as const;
    private queue:JobQueue<ExportJob>;
    private subscription?:Subscription;

    constructor(
        private connection:TransactionalConnection,
        private eventBus:EventBus,
        private queues:JobQueueService,
        private orders:OrderService,
        private client:NetsuiteService,
        private processContext:ProcessContext,
    ){}

    async onModuleInit(){
        this.queue=await this.queues.createQueue({name:'netsuite-order-export',process:job=>this.process(job)});
        if(this.processContext.isServer){
            this.eventBus.registerBlockingEventHandler({
                event:OrderStateTransitionEvent,
                id:'netsuite-capture-order-export',
                handler:event=>this.captureLedger(event.ctx,event.order,event.toState),
            });
            this.subscription=this.eventBus.ofType(OrderStateTransitionEvent).subscribe({next:event=>{
                if(!directExportStates.includes(event.toState)&&event.toState!=='Approved')return;
                void this.enqueueCaptured(event.ctx,event.order.id).catch(error=>Logger.error(this.message(error),loggerCtx));
            }});
            if(this.client.orderExportConfigured)await this.resumeIncomplete();
        }
    }

    onModuleDestroy(){this.subscription?.unsubscribe();}

    list(ctx:RequestContext){
        return this.connection.getRepository(ctx,NetsuiteOrderExport).find({relations:{order:true},order:{createdAt:'DESC'},take:200});
    }

    configuration(){
        return {mode:this.client.orderExportMode,endpointConfigured:this.client.orderExportConfigured,shippingMethodMapped:Boolean(this.client.shippingMethodInternalId)};
    }

    async retry(ctx:RequestContext,id:ID){
        if(!this.client.orderExportConfigured)throw new Error('NetSuite order export is disabled or its RESTlet URL is missing.');
        const repo=this.connection.getRepository(ctx,NetsuiteOrderExport);
        const record=await repo.findOneByOrFail({id});
        if(['exported','exported_with_mismatch'].includes(record.status))throw new Error('A completed NetSuite export cannot be retried.');
        record.status='pending';record.lastError=null;record.contextJson=JSON.stringify(ctx.serialize());await repo.save(record);
        await this.enqueue(record,ctx.serialize());
        return record;
    }

    async reconcile(ctx:RequestContext,orderId:ID){
        const order=await this.orders.findOne(ctx,orderId,[...this.orderRelations]);
        if(!order||(!directExportStates.includes(order.state)&&order.state!=='Approved'))throw new Error('Order is not in an exportable state.');
        await this.captureLedger(ctx,order,order.state);
        await this.enqueueCaptured(ctx,order.id);
        return this.connection.getRepository(ctx,NetsuiteOrderExport).findOneOrFail({where:{orderId:order.id},relations:{order:true}});
    }

    private async captureLedger(ctx:RequestContext,order:Order,toState:Order['state']){
        if(!directExportStates.includes(toState)&&toState!=='Approved')return;
        const approval=await this.connection.getRepository(ctx,NetsuiteOrderApproval).findOneBy({orderId:order.id});
        if(directExportStates.includes(toState)&&approval)return;
        if(toState==='Approved'&&!approval)throw new Error('An approved order has no approval audit record.');
        const repo=this.connection.getRepository(ctx,NetsuiteOrderExport);
        let record=await repo.findOneBy({orderId:order.id});
        if(!record){
            try{
                record=await repo.save(new NetsuiteOrderExport({
                    orderId:order.id,externalId:this.externalId(order.code),status:'pending',attemptCount:0,
                    contextJson:JSON.stringify(ctx.serialize()),payloadJson:null,requestHash:null,
                    netsuiteInternalId:null,netsuiteTransactionId:null,expectedTotalCents:order.totalWithTax,
                    netsuiteTotalCents:null,lastError:null,lastAttemptAt:null,exportedAt:null,
                }));
            }catch(error){
                if((error as {code?:string}).code!=='23505')throw error;
                record=await repo.findOneByOrFail({orderId:order.id});
            }
        }
    }

    private async enqueueCaptured(ctx:RequestContext,orderId:ID){
        if(!this.client.orderExportConfigured)return;
        const record=await this.connection.getRepository(ctx,NetsuiteOrderExport).findOneBy({orderId});
        if(!record)throw new Error(`Order ${orderId} completed without an export ledger record.`);
        await this.enqueue(record,ctx.serialize());
    }

    private async enqueue(record:NetsuiteOrderExport,context:ReturnType<RequestContext['serialize']>){
        if(['exported','exported_with_mismatch'].includes(record.status))return;
        await this.queue.add({exportId:String(record.id),context},{retries:4});
    }

    private async resumeIncomplete(){
        const repo=this.connection.rawConnection.getRepository(NetsuiteOrderExport);
        const records=await repo.find({where:{status:In(this.client.orderExportMode==='live'?['pending','failed','validated']:['pending','failed'])},take:500});
        for(const record of records){
            try{await this.enqueue(record,JSON.parse(record.contextJson));}
            catch(error){Logger.error(`Could not resume order export ${record.id}: ${this.message(error)}`,loggerCtx);}
        }
    }

    private async process(job:Job<ExportJob>){
        const ctx=RequestContext.deserialize(job.data.context);
        const repo=this.connection.getRepository(ctx,NetsuiteOrderExport);
        const record=await repo.findOneByOrFail({id:job.data.exportId});
        if(['exported','exported_with_mismatch'].includes(record.status))return {status:record.status};
        record.status='exporting';record.attemptCount++;record.lastAttemptAt=new Date();record.lastError=null;
        await repo.save(record);
        try{
            const payload=await this.buildPayload(ctx,record.orderId);
            payload.dryRun=this.client.orderExportMode!=='live';
            record.payloadJson=JSON.stringify(payload);
            record.requestHash=createHash('sha256').update(record.payloadJson).digest('hex');
            record.expectedTotalCents=payload.expectedTotalCents;
            await repo.save(record);
            const result=await this.client.exportSalesOrder(payload);
            record.netsuiteInternalId=result.internalId;
            record.netsuiteTransactionId=result.transactionId;
            record.netsuiteTotalCents=result.totalCents;
            record.status=payload.dryRun?'validated':result.totalCents===payload.expectedTotalCents?'exported':'exported_with_mismatch';
            record.exportedAt=payload.dryRun?null:new Date();
            if(record.status==='exported_with_mismatch')record.lastError=`Vendure total ${payload.expectedTotalCents} cents does not match NetSuite total ${result.totalCents} cents.`;
            await repo.save(record);
            return {status:record.status,internalId:record.netsuiteInternalId};
        }catch(error){
            record.status='failed';record.lastError=this.message(error).slice(0,4000);await repo.save(record);throw error;
        }
    }

    async buildPayload(ctx:RequestContext,orderId:ID):Promise<NetsuiteSalesOrderRequest>{
        const order=await this.orders.findOne(ctx,orderId,[...this.orderRelations]);
        if(!order||!order.customerId)throw new Error('A completed order with a linked customer is required for NetSuite export.');
        if(order.currencyCode!==CurrencyCode.USD)throw new Error('NetSuite order export currently supports USD only.');
        if(!directExportStates.includes(order.state)&&order.state!=='Approved')throw new Error('Order is not in an exportable state.');
        if(order.surcharges?.length)throw new Error('Order surcharges are not supported by the NetSuite Sales Order contract.');
        const link=await this.connection.getRepository(ctx,NetsuiteContactLink).findOne({
            where:{customerId:order.customerId,active:true},relations:{account:true,defaultShippingAddress:true},
        });
        if(!link||!link.account.active||!link.account.webCustomer)throw new Error('The order customer is not linked to an eligible NetSuite account.');
        const approval=await this.connection.getRepository(ctx,NetsuiteOrderApproval).findOne({where:{orderId},relations:{shippingAddress:true}});
        if(approval&&(approval.status!=='approved'||!approval.pricingVerifiedAt||!approval.taxValidatedAt))throw new Error('Approval order has not passed final pricing and tax validation.');
        const shippingAddress=approval?.shippingAddress??link.defaultShippingAddress;
        if(!shippingAddress?.active)throw new Error('The order has no active authoritative NetSuite ship-to address.');
        const billingAddress=await this.connection.getRepository(ctx,NetsuiteAccountAddress).findOneBy({accountId:link.accountId,active:true,defaultBilling:true});
        if(!billingAddress)throw new Error('The NetSuite account has no active default bill-to address.');
        const lines=order.lines.map(line=>{
            const itemInternalId=(line.productVariant.customFields as {netsuiteInternalId?:string}|undefined)?.netsuiteInternalId?.trim();
            if(!itemInternalId||!/^\d+$/.test(itemInternalId))throw new Error(`Order line ${line.id} has no valid NetSuite item ID.`);
            if(!Number.isSafeInteger(line.quantity)||line.quantity<=0||!Number.isSafeInteger(line.unitPrice)||line.unitPrice<0)throw new Error(`Order line ${line.id} has invalid quantity or price.`);
            if(line.discountedLinePrice!==line.linePrice)throw new Error('Discounted order lines are not supported by the NetSuite Sales Order contract.');
            return {itemInternalId,sku:line.productVariant.sku,quantity:line.quantity,rateCents:line.unitPrice,amountCents:line.linePrice};
        });
        if(!lines.length)throw new Error('An empty order cannot be exported.');
        const subtotal=lines.reduce((sum,line)=>sum+line.amountCents,0);
        if(subtotal!==order.subTotal)throw new Error('Vendure line totals do not reconcile to the order subtotal.');
        const expectedTax=order.totalWithTax-order.total;
        for(const value of [order.shipping,expectedTax,order.totalWithTax])if(!Number.isSafeInteger(value)||value<0)throw new Error('Order totals are invalid.');
        return {
            contractVersion:1,dryRun:true,externalId:this.externalId(order.code),vendureOrderCode:order.code,
            customerInternalId:link.account.netsuiteInternalId,contactInternalId:link.netsuiteContactId,
            shippingAddressInternalId:shippingAddress.netsuiteAddressId,billingAddressInternalId:billingAddress.netsuiteAddressId,
            currencyCode:'USD',memo:`Vendure web order ${order.code}`,customerPurchaseOrder:null,shippingMethodInternalId:this.client.shippingMethodInternalId,
            shippingCents:order.shipping,expectedSubtotalCents:subtotal,expectedTaxCents:expectedTax,expectedTotalCents:order.totalWithTax,lines,
        };
    }

    private externalId(orderCode:string){
        const value=`VENDURE-${orderCode.trim()}`;
        if(value.length>255||!/^[A-Za-z0-9._-]+$/.test(value))throw new Error('Vendure order code cannot be used as a NetSuite external ID.');
        return value;
    }

    private message(error:unknown){return error instanceof Error?error.message:'Unknown NetSuite order export error.';}
}
