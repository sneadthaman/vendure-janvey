import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { NETSUITE_SYNC_PLUGIN_OPTIONS } from './constants';
import { PluginInitOptions } from './types';
import { NetsuiteService } from './services/netsuite.service';
import { NetsuiteAssetService } from './services/netsuite-asset.service';
import { NetsuiteSyncService } from './services/netsuite-sync.service';
import { NetsuiteSyncRun } from './netsuite-sync-run.entity';
import { netsuiteAdminSchema, NetsuiteSyncResolver } from './netsuite-sync.resolver';
import { NetsuiteCollectionService } from './services/netsuite-collection.service';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: NETSUITE_SYNC_PLUGIN_OPTIONS, useFactory: () => NetsuiteSyncPlugin.options },
        NetsuiteService,
        NetsuiteAssetService,
        NetsuiteSyncService,
        NetsuiteCollectionService,
    ],
    entities: [NetsuiteSyncRun],
    dashboard: './dashboard/index.tsx',
    adminApiExtensions: {schema:netsuiteAdminSchema,resolvers:[NetsuiteSyncResolver]},
    configuration: config => {
        // Plugin-specific configuration
        // such as custom fields, custom permissions,
        // strategies etc. can be configured here by
        // modifying the `config` object.
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
