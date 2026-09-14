/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 *
 * Read-only customer contract endpoint for the Vendure B2B integration.
 * GET ?customerId=725&diagnostic=1
 *
 * The diagnostic deliberately discovers the account's actual field/sublist
 * contract before the Vendure importer maps tax or address data. It never
 * submits or changes a NetSuite record.
 */
define(['N/record', 'N/search', 'N/runtime'], (record, search, runtime) => {
  const TAX_FIELD_PATTERN = /(tax|vat|resale|exempt)/i;
  const TAX_RATE_FIELD_PATTERN = /(rate|percent)/i;

  function requiredId(value) {
    const id = String(value || '').trim();
    if (!/^\d+$/.test(id)) throw new Error('customerId must be a numeric NetSuite internal ID');
    return id;
  }

  function requiredQuery(value) {
    const query = String(value || '').trim();
    if (query.length < 2 || query.length > 100) throw new Error('query must contain 2 to 100 characters');
    return query;
  }

  function findCustomers(query) {
    const candidates = [];
    search.create({
      type: search.Type.CUSTOMER,
      filters: [['custentity_web_customer', 'is', 'T'], 'AND', [['entityid', 'contains', query], 'OR', ['companyname', 'contains', query]]],
      columns: ['internalid', 'entityid', 'companyname', 'isinactive'],
    }).run().each(result => {
      const get = name => result.getValue({name});
      candidates.push({
        internalId: String(get('internalid') || ''),
        entityId: get('entityid') || null,
        companyName: get('companyname') || null,
        active: !checkboxValue(get('isinactive')),
      });
      return candidates.length < 25;
    });
    return {success: true, contractVersion: 1, candidates, remainingUsage: runtime.getCurrentScript().getRemainingUsage()};
  }

  function valueIfPresent(customer, fields, fieldId) {
    return fields.indexOf(fieldId) === -1 ? null : customer.getValue({fieldId});
  }

  function textIfPresent(customer, fields, fieldId) {
    return fields.indexOf(fieldId) === -1 ? null : customer.getText({fieldId});
  }

  function checkboxValue(value) {
    return value === true || value === 'T';
  }

  function sublistValue(customer, fields, line, candidates) {
    const fieldId = candidates.find(candidate => fields.indexOf(candidate) !== -1);
    return fieldId ? customer.getSublistValue({sublistId: 'addressbook', fieldId, line}) : null;
  }

  function subrecordValue(address, fields, candidates) {
    const fieldId = candidates.find(candidate => fields.indexOf(candidate) !== -1);
    return fieldId ? address.getValue({fieldId}) : null;
  }

  function readAddresses(customer) {
    const sublists = customer.getSublists();
    if (sublists.indexOf('addressbook') === -1) return {addresses: [], fields: [], subrecordFields: [], issues: ['addressbook sublist unavailable']};
    const fields = customer.getSublistFields({sublistId: 'addressbook'});
    const count = customer.getLineCount({sublistId: 'addressbook'});
    const addresses = [];
    const issues = [];
    let discoveredSubrecordFields = [];
    for (let line = 0; line < count; line++) {
      let address;
      try {
        address = customer.getSublistSubrecord({sublistId: 'addressbook', fieldId: 'addressbookaddress', line});
      } catch (error) {
        issues.push('address line ' + line + ' has no address subrecord: ' + String(error.name || 'Error'));
        continue;
      }
      const addressFields = address.getFields();
      if (!discoveredSubrecordFields.length) discoveredSubrecordFields = addressFields.slice().sort();
      const stableId = sublistValue(customer, fields, line, ['internalid', 'id', 'addressid']);
      if (stableId === null || String(stableId).trim() === '') issues.push('address line ' + line + ' has no stable internal ID');
      addresses.push({
        internalId: stableId === null ? null : String(stableId),
        label: sublistValue(customer, fields, line, ['label']),
        defaultBilling: checkboxValue(sublistValue(customer, fields, line, ['defaultbilling'])),
        defaultShipping: checkboxValue(sublistValue(customer, fields, line, ['defaultshipping'])),
        addressee: subrecordValue(address, addressFields, ['addressee']),
        attention: subrecordValue(address, addressFields, ['attention']),
        streetLine1: subrecordValue(address, addressFields, ['addr1']),
        streetLine2: subrecordValue(address, addressFields, ['addr2']),
        city: subrecordValue(address, addressFields, ['city']),
        province: subrecordValue(address, addressFields, ['state']),
        postalCode: subrecordValue(address, addressFields, ['zip']),
        countryCode: subrecordValue(address, addressFields, ['country']),
        phoneNumber: subrecordValue(address, addressFields, ['addrphone']),
      });
    }
    return {addresses, fields: fields.slice().sort(), subrecordFields: discoveredSubrecordFields, issues};
  }

  function readContacts(customerId) {
    const contacts = [];
    try {
      const columns = ['internalid', 'entityid', 'firstname', 'lastname', 'email', 'phone', 'isinactive'];
      search.create({
        type: search.Type.CONTACT,
        filters: [['company', 'anyof', customerId]],
        columns,
      }).run().each(result => {
        const get = name => result.getValue({name});
        contacts.push({
          internalId: String(get('internalid') || ''),
          entityId: get('entityid') || null,
          firstName: get('firstname') || null,
          lastName: get('lastname') || null,
          emailAddress: get('email') || null,
          phoneNumber: get('phone') || null,
          active: get('isinactive') !== true && get('isinactive') !== 'T',
        });
        return contacts.length < 1000;
      });
      return {contacts, issue: null};
    } catch (error) {
      return {contacts: [], issue: 'contact search unavailable: ' + String(error.name || 'Error')};
    }
  }

  function readTaxItem(taxItemId) {
    if (taxItemId === null || taxItemId === undefined || String(taxItemId).trim() === '') return null;
    const internalId = String(taxItemId);
    try {
      const taxItem = record.load({type: record.Type.SALES_TAX_ITEM, id: internalId, isDynamic: false});
      const fields = taxItem.getFields();
      const rateFields = {};
      fields.filter(fieldId => TAX_RATE_FIELD_PATTERN.test(fieldId)).sort().forEach(fieldId => {
        const value = taxItem.getValue({fieldId});
        const text = taxItem.getText({fieldId});
        rateFields[fieldId] = {value: value === undefined ? null : value, text: text === undefined ? null : text};
      });
      return {internalId, rateFields};
    } catch (error) {
      return {internalId, issue: 'tax item load unavailable: ' + String(error.name || 'Error')};
    }
  }

  function get(params) {
    if (params && params.query !== undefined && (params.customerId === undefined || String(params.customerId).trim() === '')) return findCustomers(requiredQuery(params.query));
    const customerId = requiredId(params && params.customerId);
    const customer = record.load({type: record.Type.CUSTOMER, id: customerId, isDynamic: false});
    const fields = customer.getFields();
    const taxFields = fields.filter(field => TAX_FIELD_PATTERN.test(field)).sort();
    const taxMetadata = {};
    taxFields.forEach(fieldId => {
      const value = customer.getValue({fieldId});
      const text = customer.getText({fieldId});
      taxMetadata[fieldId] = {value: value === undefined ? null : value, text: text === undefined ? null : text};
    });
    const addressResult = readAddresses(customer);
    const contactResult = readContacts(customerId);
    const taxItem = readTaxItem(taxMetadata.taxitem && taxMetadata.taxitem.value);
    const issues = addressResult.issues.slice();
    if (contactResult.issue) issues.push(contactResult.issue);
    return {
      success: true,
      contractVersion: 1,
      customer: {
        internalId: customerId,
        entityId: valueIfPresent(customer, fields, 'entityid'),
        companyName: valueIfPresent(customer, fields, 'companyname'),
        emailAddress: valueIfPresent(customer, fields, 'email'),
        phoneNumber: valueIfPresent(customer, fields, 'phone'),
        priceLevelId: valueIfPresent(customer, fields, 'pricelevel'),
        priceLevelName: textIfPresent(customer, fields, 'pricelevel'),
        webCustomer: checkboxValue(valueIfPresent(customer, fields, 'custentity_web_customer')),
        active: !checkboxValue(valueIfPresent(customer, fields, 'isinactive')),
        taxMetadata,
        taxItem,
      },
      addresses: addressResult.addresses,
      contacts: contactResult.contacts,
      issues,
      diagnostics: String(params && params.diagnostic || '') === '1' ? {
        bodyFields: fields.slice().sort(),
        taxFields,
        taxItem,
        addressbookFields: addressResult.fields,
        addressFields: addressResult.subrecordFields,
      } : undefined,
      remainingUsage: runtime.getCurrentScript().getRemainingUsage(),
    };
  }

  return {get};
});
