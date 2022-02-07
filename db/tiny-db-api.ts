import { ForbiddenError, MalformedError } from '../common/errors.ts';
import type { SearchOptions, BatchOptions } from '../common/types.ts';

import { Router, RouteHandler, json, text, noContent, digestGraphQL } from '../api/mod.ts';
import { TinyRequest } from '../common/types.ts';
import { handleError } from '../common/middleware.ts';

import Api from '../common/api.ts';
import type Db from './tiny-db.ts';

export class TinyDbApi<Req extends TinyRequest = TinyRequest> extends Api<Req> {

  constructor(protected readonly db: Db,
    protected readonly sessionValidator: RouteHandler<Req>,
    protected readonly renderGraphiQL?: (req: Req) => Response) {

    super();
  }

  // #region key value

  async keyValueGet(user: string, scope: string, key: string) {
    return await this.db.get(user, scope, key);
  }

  async keyValueAdd(user: string, scope: string, value: any) {
    return await this.db.add(user, scope, value);
  }

  async keyValuePut(user: string, scope: string, key: string, value: any) {
    return await this.db.put(user, scope, key, value);
  }

  async keyValueDel(user: string, scope: string, key: string) {
    await this.db.del(user, scope, key);
  }

  async keyValueSearch(user: string, scope: string, search: SearchOptions<unknown>) {
    return await this.db.search(user, scope, search);
  }

  async keyValueBatch(user: string, scope: string, options: BatchOptions<unknown>) {
    return await this.db.batch(user, scope, options);
  }

  // #endregion key value

  // #region graphql

  async dynGetTable(user: string, scope: string, name?: string) {
    if(name)
      return await this.db.getSchema(user, scope, name);
    else
      return await this.db.getSchemas(user, scope);
  }

  async dynRegisterTables(user: string, scope: string, schema: string) {
    return await this.db.registerSchemas(user, scope, schema);
  }

  async dynReplaceTable(user: string, scope: string, name: string, schema: string) {
    return await this.db.replaceSchema(user, scope, name, schema);
  }

  async dynDropTable(user: string, scope: string, name: string) {
    await this.db.dropSchema(user, scope, name);
  }

  async dynDropAll(user: string, scope: string) {
    const all = await this.db.getSchemas(user, scope);

    await this.db.dropManySchemas(user, scope, all.map(v => v.name));
  }

  // #endregion graphql

  compile(router = new Router<Req>()): Router<Req> {

    router.use(handleError('Db'));

    // #region key value

    const dbRouter = new Router<Req>();

    dbRouter.use('/:scope', this.sessionValidator, (req, next) => {
      if(!req.session!.scopes.includes('/' + req.params!.scope!))
        throw new MalformedError('Key out of scope(s)!');

      return next();
    });

    dbRouter.get('/:scope/:key', async req => {
      return json(await this.keyValueGet(req.user!.id, req.params!.scope!, req.params!.key!));
    });

    dbRouter.post('/:scope', async req => {
      const id = await this.keyValueAdd(req.user!.id, req.params!.scope!, await req.json());
      return text(id);
    });

    dbRouter.put('/:scope/:key', async req => {
      await this.keyValuePut(req.user!.id, req.params!.scope!, req.params!.key!, await req.json());
      return noContent();
    });

    dbRouter.delete('/:scope/:key', async req => {
      await this.keyValueDel(req.user!.id, req.params!.scope!, req.params!.key!);
      return noContent();
    });

    router.post('/search/:scope?', async req => {
      return json(await this.keyValueSearch(req.user!.id, req.params?.scope || '/', await req.json()));
    });

    router.post('/batch/:scope?', async req => {
      await this.keyValueBatch(req.user!.id, req.params?.scope || '/', await req.json());
      return noContent();
    });

    // #endregion key value

    router.use('/db', dbRouter);

    // #region graphql

    const tablesRouter = new Router<Req>();
    tablesRouter.use(handleError('tables'));

    tablesRouter.get('/:name?', async req =>
      json(await this.dynGetTable(req.user!.id, req.params!.scope!, req.params!.name)));

    tablesRouter.post('/', async req =>
      json(await this.dynRegisterTables(req.user!.id, req.params!.scope!, await req.text())));

    tablesRouter.put('/:name', async req =>
      json(await this.dynReplaceTable(req.user!.id, req.params!.scope!, req.params!.name!, await req.text())));

    tablesRouter.delete('/:name', async req => {
      await this.dynDropTable(req.user!.id, req.params!.scope!, req.params!.name!);
      return noContent();
    });

    tablesRouter.delete('', async req => {
      await this.dynDropAll(req.user!.id, req.params!.scope!);
      return noContent();
    });

    router.use('/:scope/tables', this.sessionValidator, tablesRouter);

    router.use('/:scope/graphql', this.sessionValidator, async req => {
      const data = await digestGraphQL(req, Boolean(this.renderGraphiQL));

      if(data instanceof Response)
        return data;

      if(data === 'graphiql') {
        if(this.renderGraphiQL)
          return this.renderGraphiQL(req);
        else
          return new Response('No GraphiQL renderer!', { status: 500 });
      }

      const result = await this.db.query(req.user!.id, req.params!.scope!, (data.query || data.mutation)!);

      return new Response(JSON.stringify(result, null, 2), { status: 200, headers: { 'Content-Type': data.contentType } });
    });

    // #endregion graphql

    return router;
  }
}

export default TinyDbApi;
