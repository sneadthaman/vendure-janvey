import {Injectable,OnApplicationBootstrap} from '@nestjs/common';
import {EventBus,LoginEvent,Order,OrderService,RequestContext} from '@vendure/core';

import {NetsuitePricingService} from './netsuite-pricing.service';

@Injectable()
export class NetsuiteActiveOrderPricingService implements OnApplicationBootstrap {
    private readonly orderRelations=['customer','lines','lines.productVariant','shippingLines','surcharges'] as const;

    constructor(
        private eventBus:EventBus,
        private orders:OrderService,
        private pricing:NetsuitePricingService,
    ){}

    onApplicationBootstrap(){
        this.eventBus.registerBlockingEventHandler({
            event:LoginEvent,
            id:'netsuite-reprice-active-order-after-login',
            handler:async event=>{
                if(event.ctx.apiType!=='shop')return;
                await this.repriceForUser(event.ctx,event.user.id);
            },
        });
    }

    async repriceForUser(ctx:RequestContext,userId:string|number){
        const activeOrder=await this.orders.getActiveOrderForUser(ctx,userId);
        if(!activeOrder)return null;
        return this.repriceLinkedOrder(ctx,activeOrder);
    }

    async repriceLinkedOrder(ctx:RequestContext,order:Order){
        if(!order.customerId||order.lines.length===0)return order;
        const contact=await this.pricing.contactForCustomer(ctx,order.customerId);
        if(!contact)return order;
        const hydrated=await this.orders.findOne(ctx,order.id,[...this.orderRelations]);
        if(!hydrated)return null;
        return this.orders.applyPriceAdjustments(ctx,hydrated,hydrated.lines,[...this.orderRelations]);
    }
}
