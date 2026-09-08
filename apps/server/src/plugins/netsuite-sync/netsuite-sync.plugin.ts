import { OnApplicationBootstrap } from '@nestjs/common';
import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { NETSUITE_SYNC_PLUGIN_OPTIONS } from './constants';
import { PluginInitOptions } from './types';
import { NetsuiteService } from './services/netsuite.service';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: NETSUITE_SYNC_PLUGIN_OPTIONS, useFactory: () => NetsuiteSyncPlugin.options },
        NetsuiteService,
    ],
    configuration: config => {
        // Plugin-specific configuration
        // such as custom fields, custom permissions,
        // strategies etc. can be configured here by
        // modifying the `config` object.
        return config;
    },
    compatibility: '^3.0.0',
})
export class NetsuiteSyncPlugin implements OnApplicationBootstrap {
    static options: PluginInitOptions;

    constructor(private readonly netsuiteService: NetsuiteService) {}

    async onApplicationBootstrap(): Promise<void> {
        try {
            const items = await this.netsuiteService.fetchWebStoreItems();
            console.log(`[NetsuiteSyncPlugin] Fetched ${items.length} web store items`);
            console.log('[NetsuiteSyncPlugin] First item:', items[0] ?? null);
        } catch (error: unknown) {
            console.error(
                '[NetsuiteSyncPlugin] Failed to fetch NetSuite web store items:',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    static init(options: PluginInitOptions): Type<NetsuiteSyncPlugin> {
        this.options = options;
        return NetsuiteSyncPlugin;
    }
}
