import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { NETSUITE_SYNC_PLUGIN_OPTIONS } from './constants';
import { PluginInitOptions } from './types';
import { NetsuiteService } from './services/netsuite.service';
import { NetsuiteAssetService } from './services/netsuite-asset.service';
import { NetsuiteSyncService } from './services/netsuite-sync.service';
import { NetsuiteSyncRun } from './netsuite-sync-run.entity';
import { netsuiteAdminSchema, NetsuiteSyncResolver } from './netsuite-sync.resolver';
import { NetsuiteCollectionService } from './services/netsuite-collection.service';
import { NetsuiteCustomerService } from './services/netsuite-customer.service';
import { NetsuiteAccount, NetsuiteAccountAddress, NetsuiteContactLink, NetsuiteCustomerSyncRun, NetsuiteOrderApproval, NetsuiteOrderApprovalEvent } from './entities';
import { NetsuitePricingService } from './services/netsuite-pricing.service';
import { netsuiteAddressShippingCalculator, NetsuiteOrderItemPriceStrategy, NetsuiteProductVariantPriceStrategy, NetsuiteTaxLineStrategy } from './b2b-strategies';
import { NetsuiteApprovalService } from './services/netsuite-approval.service';
import { netsuiteShopSchema, NetsuiteB2bResolver } from './netsuite-b2b.resolver';
import { netsuiteApprovalOrderProcess, NetsuiteOrderPlacedStrategy } from './netsuite-order-process';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: NETSUITE_SYNC_PLUGIN_OPTIONS, useFactory: () => NetsuiteSyncPlugin.options },
        NetsuiteService,
        NetsuiteAssetService,
        NetsuiteSyncService,
        NetsuiteCollectionService,
        NetsuiteCustomerService,
        NetsuitePricingService,
        NetsuiteApprovalService,
    ],
    entities: [NetsuiteSyncRun,NetsuiteAccount,NetsuiteAccountAddress,NetsuiteContactLink,NetsuiteCustomerSyncRun,NetsuiteOrderApproval,NetsuiteOrderApprovalEvent],
    dashboard: './dashboard/index.tsx',
    adminApiExtensions: {schema:netsuiteAdminSchema,resolvers:[NetsuiteSyncResolver]},
    shopApiExtensions: {schema:netsuiteShopSchema,resolvers:[NetsuiteB2bResolver]},
    configuration: config => {
        config.orderOptions.orderItemPriceCalculationStrategy=new NetsuiteOrderItemPriceStrategy();
        config.orderOptions.orderPlacedStrategy=new NetsuiteOrderPlacedStrategy();
        config.orderOptions.process.push(netsuiteApprovalOrderProcess);
        config.catalogOptions.productVariantPriceCalculationStrategy=new NetsuiteProductVariantPriceStrategy();
        config.taxOptions.taxLineCalculationStrategy=new NetsuiteTaxLineStrategy();
        config.shippingOptions.shippingCalculators.push(netsuiteAddressShippingCalculator);
        return config;
    },
    compatibility: '^3.0.0',
})
export class NetsuiteSyncPlugin {
    static options: PluginInitOptions;

    static init(options: PluginInitOptions): Type<NetsuiteSyncPlugin> {
        this.options = options;
        return NetsuiteSyncPlugin;
    }
}
