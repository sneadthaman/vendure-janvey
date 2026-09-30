import {cookies} from 'next/headers';

const COOKIE_NAME='janvey-post-verification-redirect';

export function safeInternalRedirect(value:string|null|undefined){
    return value?.startsWith('/')&&!value.startsWith('//')?value:undefined;
}

export async function rememberPostVerificationRedirect(value:string|null|undefined){
    const redirectTo=safeInternalRedirect(value);
    if(!redirectTo)return;
    const cookieStore=await cookies();
    cookieStore.set(COOKIE_NAME,encodeURIComponent(redirectTo),{
        httpOnly:true,
        sameSite:'lax',
        secure:process.env.NODE_ENV==='production',
        path:'/',
        maxAge:24*60*60,
    });
}

export async function consumePostVerificationRedirect(){
    const cookieStore=await cookies();
    const stored=cookieStore.get(COOKIE_NAME)?.value;
    cookieStore.delete(COOKIE_NAME);
    if(!stored)return undefined;
    try{return safeInternalRedirect(decodeURIComponent(stored));}catch{return undefined;}
}
