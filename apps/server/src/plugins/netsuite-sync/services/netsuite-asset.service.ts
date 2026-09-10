import { Injectable } from '@nestjs/common';
import { Asset, AssetService, ID, RequestContext, TransactionalConnection } from '@vendure/core';
import axios from 'axios';
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { NetsuiteImageFile } from '../types';

export function imageFingerprint(file: NetsuiteImageFile): string {
    return createHash('sha256').update(JSON.stringify([file.internalid,file.url,file.modified,file.size])).digest('hex');
}

export function localImageFingerprint(name:string,buffer:Buffer):string {
    return createHash('sha256').update('local\0').update(name.toLowerCase()).update('\0').update(buffer).digest('hex');
}

export function validateImageUrl(value: string): URL {
    const url=new URL(value);
    if(url.protocol!=='https:' || !url.hostname.endsWith('.netsuite.com') || url.username || url.password ||
        url.port && url.port!=='443' || url.pathname!=='/core/media/media.nl') throw new Error('Invalid NetSuite image URL.');
    return url;
}

@Injectable()
export class NetsuiteAssetService {
    constructor(private connection:TransactionalConnection,private assets:AssetService) {}

    async importImage(ctx:RequestContext,file:NetsuiteImageFile):Promise<{id:ID;reused:boolean}> {
        const existing=await this.connection.getRepository(ctx,Asset).findOne({where:{customFields:{netsuiteFileName:file.name}} as never});
        const fields=existing?.customFields as {netsuiteSourceFingerprint?:string}|undefined;
        let fingerprint:string,buffer:Buffer,mime='image/jpeg';
        if(file.localPath){
            const stats=await lstat(file.localPath);
            if(!stats.isFile()||stats.size>20*1024*1024) throw new Error('Local image is invalid or too large.');
            buffer=await readFile(file.localPath);
            fingerprint=localImageFingerprint(file.name,buffer);
        }else{
            fingerprint=imageFingerprint(file);
            if(existing && fields?.netsuiteSourceFingerprint===fingerprint) return {id:existing.id,reused:true};
            const url=validateImageUrl(file.url);
            try {
                const response=await axios.get<ArrayBuffer>(url.toString(),{responseType:'arraybuffer',timeout:30000,maxRedirects:0,maxContentLength:20*1024*1024});
                mime=String(response.headers['content-type'] || '').split(';')[0];
                buffer=Buffer.from(response.data);
            } catch {throw new Error('Image download failed.');}
        }
        if(existing && fields?.netsuiteSourceFingerprint===fingerprint) return {id:existing.id,reused:true};
        // This catalog contract is JPEG. Never import login HTML as an asset.
        if(mime!=='image/jpeg'||buffer.length<3||buffer[0]!==0xff||buffer[1]!==0xd8||buffer[2]!==0xff) throw new Error('NetSuite did not return a JPEG image.');
        return this.connection.withTransaction(ctx,async tx=>{
            // Keep the previous binary asset and references until products are updated.
            // Releasing its sync key allows the replacement to own that filename.
            if(existing) await this.assets.update(tx,{id:existing.id,customFields:{netsuiteFileName:null,netsuiteSourceFingerprint:null}});
            const created=await this.assets.create(tx,{
                file:Promise.resolve({filename:file.name,mimetype:mime,encoding:'binary',createReadStream:()=>Readable.from(buffer)}),
                customFields:{netsuiteFileName:file.name,netsuiteSourceFingerprint:fingerprint},
            });
            if(!('id' in created)) throw new Error('Vendure rejected the image format.');
            return {id:created.id,reused:false};
        });
    }
}
