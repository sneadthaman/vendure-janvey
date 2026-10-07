import {LanguageCode} from '@vendure/common/lib/generated-types';
import {PaymentMethodEligibilityChecker, PaymentMethodHandler} from '@vendure/core';

import {NetsuiteContactLink} from './entities';
import {NetsuitePricingService} from './services/netsuite-pricing.service';

type DirectAccountContactResult = {contact: NetsuiteContactLink} | {error: string};

async function directAccountContact(
    pricing: NetsuitePricingService,
    ctx: Parameters<NetsuitePricingService['contactForCustomer']>[0],
    customerId: Parameters<NetsuitePricingService['contactForCustomer']>[1],
): Promise<DirectAccountContactResult> {
    const contact = await pricing.contactForCustomer(ctx, customerId);
    if (!contact) {
        return {error: 'A current NetSuite customer account is required to purchase on account terms.'};
    }
    if (contact.requiresApproval) {
        return {error: 'This contact must submit the order for account approval.'};
    }
    return {contact};
}

let eligibilityPricing: NetsuitePricingService;

export const netsuiteAccountTermsEligibilityChecker = new PaymentMethodEligibilityChecker({
    code: 'netsuite-account-terms-eligibility',
    description: [
        {languageCode: LanguageCode.en, value: 'Requires an active direct-purchase NetSuite contact'},
    ],
    args: {},
    init(injector) {
        eligibilityPricing = injector.get(NetsuitePricingService);
    },
    async check(ctx, order) {
        if (!order.customerId) {
            return 'Sign in with an invited NetSuite customer account to place an order.';
        }
        const result = await directAccountContact(eligibilityPricing, ctx, order.customerId);
        return 'error' in result ? result.error : true;
    },
});

let handlerPricing: NetsuitePricingService;

export const netsuiteAccountTermsPaymentHandler = new PaymentMethodHandler({
    code: 'netsuite-account-terms-handler',
    description: [
        {
            languageCode: LanguageCode.en,
            value: 'Authorizes purchases against the linked NetSuite customer account',
        },
    ],
    args: {},
    init(injector) {
        handlerPricing = injector.get(NetsuitePricingService);
    },
    async createPayment(ctx, order, amount) {
        if (!order.customerId) {
            return {
                amount,
                state: 'Error' as const,
                errorMessage: 'A linked NetSuite customer account is required.',
            };
        }
        const result = await directAccountContact(handlerPricing, ctx, order.customerId);
        if ('error' in result) {
            return {amount, state: 'Error' as const, errorMessage: result.error};
        }
        if (amount !== order.totalWithTax) {
            return {
                amount,
                state: 'Error' as const,
                errorMessage: 'The account-terms authorization must cover the complete order total.',
            };
        }
        return {
            amount,
            state: 'Authorized' as const,
            transactionId: `NETSUITE-TERMS-${order.code}`,
            metadata: {
                paymentType: 'netsuite-account-terms',
                netsuiteCustomerInternalId: result.contact.account.netsuiteInternalId,
                netsuiteContactInternalId: result.contact.netsuiteContactId,
            },
        };
    },
    async settlePayment() {
        return {
            success: false as const,
            errorMessage: 'Account-terms payments are settled through NetSuite.',
        };
    },
    async cancelPayment() {
        return {success: true as const};
    },
});
