'use client';

import { createContext, useContext, ReactNode, useState } from 'react';
import { CheckoutOrder } from './types';

interface CustomerAddress {
  id: string;
  fullName?: string | null;
  company?: string | null;
  streetLine1: string;
  streetLine2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country: { id: string; code: string; name: string };
  phoneNumber?: string | null;
  defaultShippingAddress?: boolean | null;
  defaultBillingAddress?: boolean | null;
}

interface Country {
  id: string;
  code: string;
  name: string;
}

interface ShippingMethod {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  priceWithTax: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isEligible: boolean;
  eligibilityMessage?: string | null;
}

interface NetsuiteAddress {
  id:string; label?:string|null; addressee?:string|null; attention?:string|null;
  streetLine1:string; streetLine2?:string|null; city:string; province:string; postalCode:string;
  countryCode:string; phoneNumber?:string|null; defaultBilling:boolean; defaultShipping:boolean;
}

interface NetsuiteAccount {
  id:string; companyName:string; requiresApproval:boolean; canApproveOrders:boolean;
  defaultShippingAddressId?:string|null; addresses:NetsuiteAddress[];
}

interface CheckoutContextType {
  order: CheckoutOrder;
  addresses: CustomerAddress[];
  countries: Country[];
  shippingMethods: ShippingMethod[];
  paymentMethods: PaymentMethod[];
  selectedPaymentMethodCode: string | null;
  setSelectedPaymentMethodCode: (code: string | null) => void;
  isGuest: boolean;
  netsuiteAccount: NetsuiteAccount | null;
}

const CheckoutContext = createContext<CheckoutContextType | null>(null);

interface CheckoutProviderProps {
  children: ReactNode;
  order: CheckoutOrder;
  addresses: CustomerAddress[];
  countries: Country[];
  shippingMethods: ShippingMethod[];
  paymentMethods: PaymentMethod[];
  isGuest: boolean;
  netsuiteAccount: NetsuiteAccount | null;
}

export function CheckoutProvider({
  children,
  order,
  addresses,
  countries,
  shippingMethods,
  paymentMethods,
  isGuest,
  netsuiteAccount,
}: CheckoutProviderProps) {
  const [selectedPaymentMethodCode, setSelectedPaymentMethodCode] = useState<string | null>(
    paymentMethods.length === 1 ? paymentMethods[0].code : null
  );

  return (
    <CheckoutContext.Provider
      value={{
        order,
        addresses,
        countries,
        shippingMethods,
        paymentMethods,
        selectedPaymentMethodCode,
        setSelectedPaymentMethodCode,
        isGuest,
        netsuiteAccount,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error('useCheckout must be used within CheckoutProvider');
  }
  return context;
}
