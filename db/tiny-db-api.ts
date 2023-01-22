import type { SearchOptions, BatchOptions } from '../common/types.ts';

import { Router, json, text, noContent, digestGraphQL } from '../api/mod.ts';
import { TinyContextualRequest } from '../common/types.ts';
import { handleError } from '../common/middleware.ts';

import Api from '../common/api.ts';
import type Db from './tiny-db.ts';

/**
 * The Api for the DB Module of the Tiny suite
 * Should be mounted to a `/:context/:identifier`
 * with those route params. It should also have an optional-authentication
 * middleware filling out the User and Session fields.
 */
export class TinyDbApi<Req extends TinyContextualRequest = TinyContextualRequest> extends Api<Req> {

  parseScope(context: string, identifier: string) {
    if(context === 'user')
      return '';

      if(context === 'secure')
      return identifier; // hash

    return context; // app domain
  }

  constructor(protected readonly db: Db,
    protected readonly renderGraphiQL?: (req: Req) => Response) {

    super();
  }

  // #region key value

  async keyValueGet(user: string, context: string, identifier: string, key: string) {
    return await this.db.get(user, this.parseScope(context, identifier), key);
  }

  // deno-lint-ignore no-explicit-any
  async keyValueAdd(user: string, context: string, identifier: string, value: any) {
    return await this.db.add(user, this.parseScope(context, identifier), value);
  }

  // deno-lint-ignore no-explicit-any
  async keyValuePut(user: string, context: string, identifier: string, key: string, value: any) {
    return await this.db.put(user, this.parseScope(context, identifier), key, value);
  }

  async keyValueDel(user: string, context: string, identifier: string, key: string) {
    await this.db.del(user, this.parseScope(context, identifier), key);
  }

  async keyValueSearch(user: string, context: string, identifier: string, search: SearchOptions<unknown>) {
    return await this.db.search(user, this.parseScope(context, identifier), search);
  }

  async keyValueBatch(user: string, context: string, identifier: string, options: BatchOptions<unknown>) {
    return await this.db.batch(user, this.parseScope(context, identifier), options);
  }

  // #endregion key value

  // #region graphql

  async dynGetTable(user: string, context: string, identifier: string, name?: string) {
    if(name)
      return await this.db.getSchema(user, this.parseScope(context, identifier), name);
    else
      return await this.db.getSchemas(user, this.parseScope(context, identifier));
  }

  async dynRegisterTables(user: string, context: string, identifier: string, schema: string) {
    return await this.db.registerSchemas(user, this.parseScope(context, identifier), schema);
  }

  async dynReplaceTable(user: string, context: string, identifier: string, name: string, schema: string) {
    return await this.db.replaceSchema(user, this.parseScope(context, identifier), name, schema);
  }

  async dynDropTable(user: string, context: string, identifier: string, name: string) {
    await this.db.dropSchema(user, this.parseScope(context, identifier), name);
  }

  async dynDropAll(user: string, context: string, identifier: string) {
    const all = await this.db.getSchemas(user, this.parseScope(context, identifier));

    await this.db.dropManySchemas(user, this.parseScope(context, identifier), all.map(v => v.name));
  }

  // #endregion graphql

  /** @todo add security verification yikes */
  compile(router = new Router<Req>()): Router<Req> {

    router.use(handleError('Db'));

    const keyValueRouter = new Router<Req>();
    keyValueRouter.use(handleError('key-value'));

    // #region key value

    const storeRouter = new Router<Req>();
    storeRouter.use(handleError('key-value-store'));

    storeRouter.get('/:key', async req => {
      return json(await this.keyValueGet(req.user!.id, req.context.context, req.context.identifier, req.params.key!));
    });

    storeRouter.post('', async req => {
      const id = await this.keyValueAdd(req.user!.id, req.context.context, req.context.identifier, await req.json());
      return text(id);
    });

    storeRouter.put('/:key', async req => {
      await this.keyValuePut(req.user!.id, req.context.context, req.context.identifier, req.params.key!, await req.json());
      return noContent();
    });

    storeRouter.delete('/:key', async req => {
      await this.keyValueDel(req.user!.id, req.context.context, req.context.identifier, req.params.key!);
      return noContent();
    });

    keyValueRouter.use('/store', storeRouter);

    keyValueRouter.post('/search', async req => {
      return json(await this.keyValueSearch(req.user!.id, req.context.context, req.context.identifier, await req.json()));
    });

    keyValueRouter.post('/batch', async req => {
      await this.keyValueBatch(req.user!.id, req.context.context, req.context.identifier, await req.json());
      return noContent();
    });

    // #endregion key value

    router.use('/key-value', keyValueRouter);

    const dynamicRouter = new Router<Req>();
    dynamicRouter.use(handleError('dynamic'));

    // #region graphql

    const tablesRouter = new Router<Req>();
    tablesRouter.use(handleError('dynamic-tables'));

    tablesRouter.get('/:name?', async req =>
      json(await this.dynGetTable(req.user!.id, req.context.context, req.context.identifier, req.params.name)));

    tablesRouter.post('/', async req =>
      json(await this.dynRegisterTables(req.user!.id, req.context.context, req.context.identifier, await req.text())));

    tablesRouter.put('/:name', async req =>
      json(await this.dynReplaceTable(req.user!.id, req.context.context, req.context.identifier, req.params.name!, await req.text())));

    tablesRouter.delete('/:name', async req => {
      await this.dynDropTable(req.user!.id, req.context.context, req.context.identifier, req.params.name!);
      return noContent();
    });

    tablesRouter.delete('', async req => {
      await this.dynDropAll(req.user!.id, req.context.context, req.context.identifier);
      return noContent();
    });

    dynamicRouter.use('/tables', tablesRouter);

    dynamicRouter.use('/graphql', async req => {
      const data = await digestGraphQL(req, Boolean(this.renderGraphiQL));

      if(data instanceof Response)
        return data;

      if(data === 'graphiql') {
        if(this.renderGraphiQL)
          return this.renderGraphiQL(req);
        else
          return new Response('No GraphiQL renderer!', { status: 500 });
      }

      const result = await this.db.query(req.user!.id, this.parseScope(req.context.context, req.context.identifier), (data.query || data.mutation)!);

      return new Response(JSON.stringify(result, null, 2), { status: 200, headers: { 'Content-Type': data.contentType } });
    });

    // #endregion graphql

    router.use('/dynamic', dynamicRouter);

    return router;
  }
}

export default TinyDbApi;
