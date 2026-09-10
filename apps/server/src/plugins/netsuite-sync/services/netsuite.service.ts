import { Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto-js';
import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { NETSUITE_SYNC_PLUGIN_OPTIONS } from '../constants';
import { NetsuiteWebStoreItem, NetsuiteWebStoreItemsResponse, NetsuitePricesResponse, NetsuitePrice, NetsuiteImagesResponse, NetsuiteImageFile, PluginInitOptions } from '../types';

@Injectable()
export class NetsuiteService {
    constructor(@Inject(NETSUITE_SYNC_PLUGIN_OPTIONS) private readonly options: PluginInitOptions) {}

    private async request<T>(endpoint: string | undefined, method: 'GET' | 'POST', params?: Record<string,string>, body?: unknown): Promise<T> {
        const {accountId,consumerKey,consumerSecret,tokenId,tokenSecret}=this.options;
        if(!endpoint || !accountId || !consumerKey || !consumerSecret || !tokenId || !tokenSecret) throw new Error('NetSuite endpoint or TBA configuration is missing.');
        const url=new URL(endpoint);
        if(url.protocol!=='https:' || !url.hostname.endsWith('.restlets.api.netsuite.com') || url.username || url.password) throw new Error('Invalid NetSuite RESTlet endpoint.');
        for(const [key,value] of Object.entries(params || {})) url.searchParams.set(key,value);
        const oauth=new OAuth({consumer:{key:consumerKey,secret:consumerSecret},signature_method:'HMAC-SHA256',hash_function:(base,key)=>crypto.HmacSHA256(base,key).toString(crypto.enc.Base64)});
        const auth=oauth.toHeader(oauth.authorize({url:url.toString(),method},{key:tokenId,secret:tokenSecret}));
        try {
            return (await axios.request<T>({url:url.toString(),method,data:body,timeout:30000,maxRedirects:0,maxContentLength:20*1024*1024,
                headers:{Authorization:`${auth.Authorization}, realm="${accountId}"`,'Content-Type':'application/json'}})).data;
        } catch(error) {
            const status=axios.isAxiosError(error)?error.response?.status:undefined;
            // Do not expose signed headers, credentials, or upstream response bodies.
            throw new Error(`NetSuite ${method} request failed (${status || 'network or timeout'}).`);
        }
    }

    async fetchCatalog(): Promise<{items:NetsuiteWebStoreItem[];reconciliationSafe:boolean}> {
        const items:NetsuiteWebStoreItem[]=[];
        const seen=new Set<string>();
        let total:number|undefined, allTotals=true;
        for(let offset=0;offset<100000;offset+=100) {
            const page=await this.request<NetsuiteWebStoreItemsResponse>(this.options.itemsUrl,'GET',{offset:String(offset),limit:'100'});
            if(!Array.isArray(page.items)||page.offset!==offset||page.limit!==100||page.count!==page.items.length||page.count>100) throw new Error('Invalid item pagination response.');
            if(page.total===undefined) allTotals=false;
            else {
                if(!Number.isSafeInteger(page.total)||page.total<0||total!==undefined&&total!==page.total) throw new Error('Catalog changed during fetch; retry sync.');
                total=page.total;
            }
            for(const item of page.items) {
                if(!item || typeof item!=='object') throw new Error('Invalid item row.');
                if(typeof item.internalid==='string' && item.internalid.trim()) {
                    if(seen.has(item.internalid)) throw new Error('Duplicate NetSuite internal ID across catalog pages.');
                    seen.add(item.internalid);
                }
                items.push(item);
            }
            if(page.count<100) {
                if(total!==undefined&&items.length!==total) throw new Error('Incomplete catalog response.');
                return {items,reconciliationSafe:allTotals&&total===items.length};
            }
        }
        throw new Error('Catalog pagination safety limit exceeded.');
    }
    async fetchWebStoreItems(): Promise<NetsuiteWebStoreItem[]> {return (await this.fetchCatalog()).items;}

    async fetchOnlinePrices(skus:string[]): Promise<Map<string,NetsuitePrice>> {
        const unique=[...new Set(skus)], result=new Map<string,NetsuitePrice>();
        for(let offset=0;offset<unique.length;offset+=100) {
            const batch=unique.slice(offset,offset+100);
            const page=await this.request<NetsuitePricesResponse>(this.options.pricingUrl,'POST',undefined,{customerId:null,skus:batch});
            if(page.success!==true||page.currencyCode!=='USD'||!Array.isArray(page.prices)) throw new Error('Invalid guest pricing response.');
            for(const line of page.prices) {
                if(!line||!batch.includes(line.sku)||result.has(line.sku)||![line.price,line.basePrice].every(p=>p===null||Number.isInteger(p)&&p>=0&&p<=2147483647)||line.price!==line.basePrice||line.purchasable!==(line.price!==null)) throw new Error('Inconsistent guest pricing row.');
                result.set(line.sku,line);
            }
            if(batch.some(sku=>!result.has(sku))) throw new Error('Pricing response omitted requested SKUs.');
        }
        return result;
    }

    async fetchImages(): Promise<Map<string,NetsuiteImageFile>> {
        if(this.options.localImagesPath) return this.fetchLocalImages(this.options.localImagesPath);
        const result=new Map<string,NetsuiteImageFile>();let total:number|undefined;
        for(let offset=0;offset<100000;offset+=1000) {
            const page=await this.request<NetsuiteImagesResponse>(this.options.imagesUrl,'GET',{offset:String(offset),limit:'1000'});
            if(page.success!==true||!Array.isArray(page.files)||page.offset!==offset||page.limit!==1000||page.count!==page.files.length||page.count>1000||!Number.isSafeInteger(page.total)||page.total<0||total!==undefined&&total!==page.total) throw new Error('Invalid or changing image manifest.');
            total=page.total;
            for(const file of page.files) {
                const key=typeof file?.name==='string'?file.name.toLowerCase():'';
                if(!key||typeof file.url!=='string'||typeof file.internalid!=='string'||result.has(key)) throw new Error('Invalid or duplicate image filename.');
                result.set(key,file);
            }
            if(page.count<1000) {
                if(result.size!==total) throw new Error('Incomplete image manifest.');
                return result;
            }
        }
        throw new Error('Image pagination safety limit exceeded.');
    }

    private async fetchLocalImages(configuredRoot:string):Promise<Map<string,NetsuiteImageFile>> {
        const root=await realpath(configuredRoot);
        const rootStat=await lstat(root);
        if(!rootStat.isDirectory()) throw new Error('Local image source is not a directory.');
        const result=new Map<string,NetsuiteImageFile>();
        const pending=[root];
        let visited=0;
        while(pending.length){
            const directory=pending.pop()!;
            const entries=(await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
            for(const entry of entries){
                if(++visited>10000) throw new Error('Local image source exceeds the file safety limit.');
                const fullPath=path.join(directory,entry.name);
                if(entry.isSymbolicLink()) throw new Error('Local image source must not contain symbolic links.');
                if(entry.isDirectory()){pending.push(fullPath);continue;}
                if(!entry.isFile()||!/^.+\.jpe?g$/i.test(entry.name)) continue;
                const key=entry.name.toLowerCase();
                if(result.has(key)) throw new Error(`Duplicate local image filename: ${entry.name}`);
                const stats=await lstat(fullPath);
                result.set(key,{
                    name:entry.name,url:'',internalid:`local:${key}`,
                    modified:stats.mtime.toISOString(),size:String(stats.size),
                    availableWithoutLogin:false,localPath:fullPath,
                });
            }
        }
        return result;
    }
}
