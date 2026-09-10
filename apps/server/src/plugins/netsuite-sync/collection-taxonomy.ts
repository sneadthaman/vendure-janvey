export interface CategoryDefinition {
    key:string;
    name:string;
    slug:string;
    classes:Array<{key:string;name:string;slug:string}>;
}

export const CATEGORY_GROUPS:CategoryDefinition[]=[
    {key:'group:cleaning-chemicals',name:'Cleaning Chemicals',slug:'cleaning-chemicals',classes:[
        {key:'AIR CARE & ACCESSORIES',name:'Air Care',slug:'air-care'},
        {key:'CLEANERS & POLISHES',name:'Cleaners & Polishes',slug:'cleaners-polishes'},
        {key:'DISINFECTANTS & SANITIZERS',name:'Disinfectants & Sanitizers',slug:'disinfectants-sanitizers'},
        {key:'FLOOR CARE/MAINTENANCE',name:'Floor Cleaners & Maintenance',slug:'floor-cleaners-maintenance'},
        {key:'FLOOR CARE/STRIP & FINISH',name:'Floor Strippers & Finishes',slug:'floor-strippers-finishes'},
        {key:'HAND CARE & ACCESSORIES',name:'Hand Care',slug:'hand-care'},
    ]},
    {key:'group:paper-liners-disposables',name:'Paper, Liners & Disposables',slug:'paper-liners-disposables',classes:[
        {key:'BAGS & CAN LINERS',name:'Bags & Can Liners',slug:'bags-can-liners'},
        {key:'TOWELS, TISSUE & ACCESSORIES',name:'Towels, Tissue & Accessories',slug:'towels-tissue-accessories'},
    ]},
    {key:'group:cleaning-tools-supplies',name:'Cleaning Tools & Supplies',slug:'cleaning-tools-supplies',classes:[
        {key:'CLEANING & PRODUCTIVITY TOOLS',name:'Cleaning Tools',slug:'cleaning-tools'},
        {key:'FLOOR PADS & ABRASIVES',name:'Floor Pads & Abrasives',slug:'floor-pads-abrasives'},
        {key:'MOPS & ACCESSORIES',name:'Mops & Accessories',slug:'mops-accessories'},
    ]},
    {key:'group:equipment-material-handling',name:'Equipment & Material Handling',slug:'equipment-material-handling',classes:[
        {key:'EQUIPMENT - BATTERY',name:'Battery Equipment',slug:'battery-equipment'},
        {key:'EQUIPMENT - CORD ELECTRIC',name:'Corded Equipment',slug:'corded-equipment'},
        {key:'MATERIAL HANDLING - CARTS/TRUC',name:'Carts & Trucks',slug:'carts-trucks'},
    ]},
    {key:'group:ice-winter-care',name:'Ice & Winter Care',slug:'ice-winter-care',classes:[
        {key:'ICE MELTER',name:'Ice Melt',slug:'ice-melt'},
    ]},
    {key:'group:office-supplies',name:'Office Supplies',slug:'office-supplies',classes:[
        {key:'GENERAL OFFICE PRODUCTS',name:'Office Supplies',slug:'general-office-products'},
    ]},
];

export const FEATURED_PRODUCT_NETSUITE_IDS=['1654','11813','1351','1970','2433','5284','5909','4149'];
export const FEATURED_COLLECTION_KEY='system:featured-products';
export const REVIEW_COLLECTION_KEY='system:needs-classification';
export const DEMO_COLLECTION_SLUGS=['electronics','computers','camera-photo','home-garden','furniture','plants','sports-outdoor','equipment','footwear'];

export const KNOWN_CLASS_MAP=new Map(CATEGORY_GROUPS.flatMap(group=>group.classes.map(item=>[item.key,{...item,groupKey:group.key}] as const)));
