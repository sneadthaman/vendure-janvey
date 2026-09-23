import {ScheduledTask} from '@vendure/core';

import {NetsuiteCustomerService} from './services/netsuite-customer.service';

export const netsuiteCustomerRefreshTask=new ScheduledTask({
    id:'netsuite-customer-refresh',
    description:'Refresh all imported NetSuite customer accounts, contacts, addresses and tax metadata.',
    schedule:process.env.NETSUITE_CUSTOMER_REFRESH_CRON?.trim()||'0 2 * * *',
    timeout:'30m',
    preventOverlap:true,
    execute:({injector,scheduledContext})=>injector.get(NetsuiteCustomerService).refreshImportedAccounts(scheduledContext),
});
