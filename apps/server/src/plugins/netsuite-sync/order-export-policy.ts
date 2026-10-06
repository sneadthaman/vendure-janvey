import {NetsuiteOrderExportStatus} from './entities/netsuite-order-export.entity';

export function shouldResumeOrderExport(
    mode:'disabled'|'dry-run'|'live',
    status:NetsuiteOrderExportStatus,
    payloadJson:string|null,
){
    if(mode==='disabled'||!['pending','failed','exporting'].includes(status))return false;
    if(mode==='dry-run')return true;
    if(!payloadJson)return false;
    try{return (JSON.parse(payloadJson) as {dryRun?:unknown}).dryRun===false;}
    catch{return false;}
}
