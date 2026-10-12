import {ScheduledTask} from '@vendure/core';

import {NetsuiteOrderLifecycleService} from './services/netsuite-order-lifecycle.service';

export const netsuiteOrderLifecycleTask=new ScheduledTask({
    id:'netsuite-order-lifecycle-refresh',
    description:'Refresh read-only NetSuite Sales Order, fulfillment, tracking and invoice snapshots.',
    schedule:process.env.NETSUITE_ORDER_LIFECYCLE_CRON?.trim()||'*/15 * * * *',
    timeout:'30m',
    preventOverlap:true,
    execute:({injector,scheduledContext})=>injector.get(NetsuiteOrderLifecycleService).refreshAll(scheduledContext),
});
