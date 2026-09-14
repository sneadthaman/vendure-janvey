import {LanguageCode,TaxLine} from '@vendure/common/lib/generated-types';
import {Channel, Injector, Order, OrderItemPriceCalculationStrategy, ProductVariantPriceCalculationArgs, ProductVariantPriceCalculationStrategy, RequestContext, ShippingCalculator, TaxLineCalculationStrategy, TaxZoneStrategy, Zone} from '@vendure/core';

import {NetsuitePricingService} from './services/netsuite-pricing.service';

/**
 * NetSuite determines sales tax from the account's bill-to address. The stock
 * AddressBasedTaxZoneStrategy uses the shipping address, so it cannot be used
 * for this integration. The billing address is written from NetSuite whenever
 * a linked contact selects a ship-to address.
 */
export class NetsuiteBillToTaxZoneStrategy implements TaxZoneStrategy {
    determineTaxZone(_ctx:RequestContext,zones:Zone[],channel:Channel,order?:Order):Zone{
        const countryCode=order?.billingAddress?.countryCode;
        if(countryCode){
            const zone=zones.find(candidate=>candidate.members?.some(member=>member.code===countryCode));
            if(zone)return zone;
        }
        return channel.defaultTaxZone;
    }
}

export class NetsuiteOrderItemPriceStrategy implements OrderItemPriceCalculationStrategy {
    private pricing:NetsuitePricingService;
    init(injector:Injector){this.pricing=injector.get(NetsuitePricingService);}
    async calculateUnitPrice(ctx:Parameters<OrderItemPriceCalculationStrategy['calculateUnitPrice']>[0],variant:Parameters<OrderItemPriceCalculationStrategy['calculateUnitPrice']>[1],_customFields:Parameters<OrderItemPriceCalculationStrategy['calculateUnitPrice']>[2],order:Parameters<OrderItemPriceCalculationStrategy['calculateUnitPrice']>[3]){
        return {price:await this.pricing.priceForOrder(ctx,order,variant,variant.listPrice),priceIncludesTax:false};
    }
}

export class NetsuiteProductVariantPriceStrategy implements ProductVariantPriceCalculationStrategy {
    private pricing:NetsuitePricingService;
    init(injector:Injector){this.pricing=injector.get(NetsuitePricingService);}
    async calculate(args:ProductVariantPriceCalculationArgs){
        return {price:await this.pricing.priceForCatalog(args.ctx,args.productVariant,args.inputPrice),priceIncludesTax:false};
    }
}

export class NetsuiteTaxLineStrategy implements TaxLineCalculationStrategy {
    private pricing:NetsuitePricingService;
    init(injector:Injector){this.pricing=injector.get(NetsuitePricingService);}
    async calculate(args:Parameters<TaxLineCalculationStrategy['calculate']>[0]):Promise<TaxLine[]>{
        const contact=args.order.customerId?await this.pricing.contactForCustomer(args.ctx,args.order.customerId):undefined;
        if(contact?.account.taxExempt)return [{description:'NetSuite tax-exempt account',taxRate:0}];
        if(contact?.account.taxable){
            if(contact.account.taxRate===null)throw new Error('NetSuite tax rate is unavailable. Refresh this account before checkout.');
            return [{description:`NetSuite tax item ${contact.account.taxItemId??'rate'}`,taxRate:contact.account.taxRate}];
        }
        return [args.applicableTaxRate.apply(args.orderLine.proratedUnitPrice)];
    }
}

let shippingPricing:NetsuitePricingService;
export const netsuiteAddressShippingCalculator=new ShippingCalculator({
    code:'netsuite-address-shipping-calculator',
    description:[{languageCode:LanguageCode.en,value:'Address-based shipping tax calculator'}],
    args:{
        rate:{type:'int',defaultValue:0,ui:{component:'currency-form-input'}},
        includesTax:{type:'string',defaultValue:'auto',ui:{component:'select-form-input',options:[
            {label:[{languageCode:LanguageCode.en,value:'Includes tax'}],value:'include'},
            {label:[{languageCode:LanguageCode.en,value:'Excludes tax'}],value:'exclude'},
            {label:[{languageCode:LanguageCode.en,value:'Auto (based on Channel)'}],value:'auto'},
        ]}},
        taxRate:{type:'float',defaultValue:0,ui:{component:'number-form-input',suffix:'%',min:0}},
    },
    init(injector){shippingPricing=injector.get(NetsuitePricingService);},
    async calculate(ctx,order,args){
        const contact=order.customerId?await shippingPricing.contactForCustomer(ctx,order.customerId):undefined;
        const lineTaxRate=Math.max(0,...order.lines.flatMap(line=>line.taxLines.map(tax=>tax.taxRate)));
        const taxRate=contact?.account.taxExempt?0:(lineTaxRate||args.taxRate);
        return {price:args.rate,taxRate,priceIncludesTax:args.includesTax==='include'||(args.includesTax==='auto'&&ctx.channel.pricesIncludeTax)};
    },
});
