import {ID} from '@vendure/common/lib/shared-types';

import {NetsuiteCustomerContact, NetsuiteCustomerResponse} from './types';

export interface EligibilityState {
    active:boolean;
    eligible:boolean;
    issue:string|null;
}

export function accountEligibility(customer:NetsuiteCustomerResponse['customer']):EligibilityState&{webCustomer:boolean}{
    const active=customer.active;
    const webCustomer=customer.webCustomer;
    const issue=!active?'NetSuite customer is inactive.':!webCustomer?'NetSuite customer is not marked as a web customer.':null;
    return {active,webCustomer,eligible:active&&webCustomer,issue};
}

export function contactEligibility(netsuiteContactId:string|null,contacts:NetsuiteCustomerContact[]):EligibilityState{
    if(!netsuiteContactId)return {active:true,eligible:true,issue:null};
    const contact=contacts.find(candidate=>candidate.internalId===netsuiteContactId);
    if(!contact)return {active:false,eligible:false,issue:'NetSuite contact is no longer present on this account.'};
    if(!contact.active)return {active:false,eligible:false,issue:'NetSuite contact is inactive.'};
    return {active:true,eligible:true,issue:null};
}

export function defaultAddressIsStale(defaultAddressId:ID|null,activeAddressIds:Set<string>):boolean{
    return defaultAddressId!==null&&!activeAddressIds.has(String(defaultAddressId));
}
