import {Controller, Get} from '@nestjs/common';
import {TransactionalConnection} from '@vendure/core';

@Controller('ready')
export class RuntimeReadinessController {
    constructor(private readonly connection: TransactionalConnection) {}

    @Get()
    async ready(): Promise<{status: 'ok'; database: 'ok'}> {
        await this.connection.rawConnection.query('SELECT 1');
        return {status: 'ok', database: 'ok'};
    }
}
