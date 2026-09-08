import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto-js';

export interface NetsuiteWebStoreItem {
    internalid: string;
    itemid: string;
    displayname: string;
    salesdescription: string;
    storedescription: string;
    storedetaileddescription: string;
    urlcomponent: string;
}

interface NetsuiteRestletResponse {
    count: number;
    offset: number;
    limit: number;
    items: NetsuiteWebStoreItem[];
}

const loggerCtx = 'NetsuiteService';

@Injectable()
export class NetsuiteService {
    private readonly logger = new Logger(loggerCtx);

    private readonly restletUrl = process.env.NETSUITE_RESTLET_URL!;
    private readonly accountId = process.env.NETSUITE_ACCOUNT_ID!;

    private readonly oauth = new OAuth({
        consumer: {
            key: process.env.NETSUITE_CONSUMER_KEY!,
            secret: process.env.NETSUITE_CONSUMER_SECRET!,
        },
        signature_method: 'HMAC-SHA256',
        hash_function: (baseString, key) =>
            crypto.HmacSHA256(baseString, key).toString(crypto.enc.Base64),
    });

    private readonly token = {
        key: process.env.NETSUITE_TOKEN_ID!,
        secret: process.env.NETSUITE_TOKEN_SECRET!,
    };

    async fetchWebStoreItems(): Promise<NetsuiteWebStoreItem[]> {
        const allItems: NetsuiteWebStoreItem[] = [];
        const pageSize = 100;
        let offset = 0;

        while (true) {
            const url = `${this.restletUrl}&limit=${pageSize}&offset=${offset}`;
            const page = await this.fetchPage(url);

            allItems.push(...page.items);
            this.logger.log(
                `Fetched ${page.items.length} items (offset ${offset}, total so far ${allItems.length})`,
            );

            if (page.items.length < pageSize) {
                break;
            }
            offset += pageSize;
        }

        return allItems;
    }

    private async fetchPage(url: string): Promise<NetsuiteRestletResponse> {
        const requestData = { url, method: 'GET' };
        const authHeader = this.oauth.toHeader(
            this.oauth.authorize(requestData, this.token),
        );
        const authorization = `${authHeader.Authorization}, realm="${this.accountId}"`;

        try {
            const response = await axios.get<NetsuiteRestletResponse>(url, {
                headers: {
                    Authorization: authorization,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (err: any) {
            this.logger.error(
                `NetSuite RESTlet call failed: ${err.message}`,
                err.response?.data ? JSON.stringify(err.response.data) : undefined,
            );
            throw err;
        }
    }
}
