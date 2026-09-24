import {EmailDetails, EmailSender, EmailTransportOptions} from '@vendure/email-plugin';
import {createTransport} from 'nodemailer';

export interface MicrosoftGraphEmailSenderOptions {
    tenantId:string;
    clientId:string;
    clientSecret:string;
    senderMailbox:string;
}

interface AccessTokenResponse {
    access_token?:string;
    expires_in?:number;
    error?:string;
    error_description?:string;
}

interface CachedAccessToken {
    value:string;
    expiresAt:number;
}

export class MicrosoftGraphEmailSender implements EmailSender {
    private cachedToken:CachedAccessToken|undefined;
    private pendingToken:Promise<CachedAccessToken>|undefined;

    constructor(private readonly options:MicrosoftGraphEmailSenderOptions){}

    async send(email:EmailDetails,_transport:EmailTransportOptions):Promise<void>{
        const mime=await this.createMimeMessage(email);
        let response=await this.sendMime(mime,await this.accessToken());
        if(response.status===401){
            this.cachedToken=undefined;
            response=await this.sendMime(mime,await this.accessToken());
        }
        if(!response.ok){
            const details=(await response.text()).slice(0,1000);
            throw new Error(`Microsoft Graph email delivery failed (${response.status}): ${details||response.statusText}`);
        }
    }

    private async createMimeMessage(email:EmailDetails):Promise<Buffer>{
        const transporter=createTransport({streamTransport:true,buffer:true,newline:'windows'});
        const result=await transporter.sendMail({
            from:email.from,to:email.recipient,subject:email.subject,html:email.body,
            attachments:email.attachments,cc:email.cc,bcc:email.bcc,replyTo:email.replyTo,
        });
        if(Buffer.isBuffer(result.message))return result.message;
        if(typeof result.message==='string')return Buffer.from(result.message);
        const chunks:Buffer[]=[];
        for await(const chunk of result.message)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
        return Buffer.concat(chunks);
    }

    private sendMime(mime:Buffer,accessToken:string){
        return fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(this.options.senderMailbox)}/sendMail`,{
            method:'POST',
            headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'text/plain'},
            body:mime.toString('base64'),
        });
    }

    private async accessToken():Promise<string>{
        if(this.cachedToken&&this.cachedToken.expiresAt>Date.now())return this.cachedToken.value;
        if(!this.pendingToken)this.pendingToken=this.fetchAccessToken().finally(()=>{this.pendingToken=undefined;});
        this.cachedToken=await this.pendingToken;
        return this.cachedToken.value;
    }

    private async fetchAccessToken():Promise<CachedAccessToken>{
        const body=new URLSearchParams({
            client_id:this.options.clientId,
            client_secret:this.options.clientSecret,
            grant_type:'client_credentials',
            scope:'https://graph.microsoft.com/.default',
        });
        const response=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(this.options.tenantId)}/oauth2/v2.0/token`,{
            method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,
        });
        const result=await response.json() as AccessTokenResponse;
        if(!response.ok||!result.access_token){
            throw new Error(`Microsoft Graph token request failed (${response.status}): ${result.error_description||result.error||response.statusText}`);
        }
        const lifetime=Number.isFinite(result.expires_in)&&result.expires_in!>0?result.expires_in!:3600;
        return {value:result.access_token,expiresAt:Date.now()+Math.max(60,lifetime-300)*1000};
    }
}
