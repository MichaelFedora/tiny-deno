/** BROKEN */

import { Application, Router as OakRouter, send } from 'https://deno.land/x/oak@v10.2.0/mod.ts';
import { renderPlaygroundPage } from 'https://deno.land/x/gql@1.1.1/graphiql/render.ts';

import { DB } from '../deps/sqlite.ts';
import { Router, json } from '../api/mod.ts';

import { handleError } from '../common/middleware.ts';
import { MalformedError } from '../common/errors.ts';

import { AuthRequest } from '../auth/auth-types.ts';
import { validateUserSession } from '../auth/auth-middleware.ts';
import AuthApi from '../auth/auth-api.ts';
import CoreApi from '../auth/core-api.ts';
import HelpfulAuthDb from '../auth/helpers/helpful-auth-db.ts';

import TinyDbApi from '../db/tiny-db-api.ts';
import HelpfulTinyDb from '../db/helpers/helpful-tiny-db.ts';

import FileApi from '../file/file-api.ts';
import HelpfulFileDb from '../file/helpers/helpful-file-db.ts';

import SQLiteKeyValueStore from '../implementations/sqlite/sqlite-key-value-store.ts';
import SQLiteDynTableStore from '../implementations/sqlite/sqlite-dyn-table-store.ts';

const db = new DB(':memory:');

const kv = new SQLiteKeyValueStore(db, 'KeyValue');
await kv.init();

const dts = new SQLiteDynTableStore(db, 'dyn');
await dts.init();


const authDb = new HelpfulAuthDb(dts, { });
await authDb.init();

const tinyDb = new HelpfulTinyDb(kv, dts, id => authDb.getUser(id));
await tinyDb.init();

const fileDb = new HelpfulFileDb(kv);
await fileDb.init();


const coreApi = new CoreApi(authDb, 'complete (std)');
const authApi = new AuthApi(authDb);
const dbApi = new TinyDbApi(tinyDb,
  validateUserSession(authDb),
  req => {
    const playground = renderPlaygroundPage({ endpoint: new URL(req.url).pathname });

    return new Response(playground, { status: 200, headers: { 'Content-Type': 'text/html' } });
  });
const fileApi = new FileApi(fileDb, new DiskFileStore(), validateUserSession(authDb), path => {
  const res = new Response();
  send());

const router = new Router<Request & AuthRequest>();
router.use(handleError('root'));

router.use((req, next) => {
  console.log(`[${req.method}] ${req.url.replace(/\?sid=\w+$/, ' (auth\'d)')}`)
  return next();
});

coreApi.compile(router);
router.use('/auth', authApi.compile());
router.use('/db', dbApi.compile());

router.get('/dump/key-value', async () => json(await kv.search({ })));
router.get('/dump/dyn', async () => json(await dts.list()));
router.get('/dump/dyn/:table', async req => json(await dts.table(req.params.table!).all()));

const app = new Application();

// oak error listener
app.addEventListener('error', evt => {
  console.error('Oak Error:', evt.error);
});

// oak error catcher middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch(e) {
    ctx.response.status = 500;
    ctx.response.body = 'Internal Error';
    console.error('Oak Internal Error Caught:', e);
  }
});

// cors
app.use((ctx, next) => {
  if(Deno.args.includes('--cors'))
    ctx.response.headers.append('access-control-allow-origin', '*');

  if(ctx.request.method !== 'OPTIONS')
    return next();

  ctx.response.status = 204;
  ctx.response.headers.append('allow', '*');
});

// tiny router
app.use(async (ctx, next) => {
  const req = Object.assign(ctx.request.originalRequest.request, {
    stream() { return Promise.resolve(ctx.request.body({ type: 'stream' }).value); }
  });

  const res = await router.process(req);
  if(!res)
    return next();

  for(const [k, v] of res.headers.entries())
    ctx.response.headers.append(k, v)

  ctx.response.status = res.status
  ctx.response.body = res.body
});

const oakRouter = new OakRouter();

const basePath = await Deno.realPath(Deno.cwd() + '/common/dist/');

oakRouter.get('/:path(.*)', async (ctx, next) => {
  if(ctx.request.method !== 'GET' || !ctx.params.path)
    return next();

  try {

    let path = basePath + '/' + ctx.params.path;
    path = await Deno.realPath(path);

    if(!path.includes(basePath))
      return next();

    return await send(ctx, path);

  } catch(e) {

    if(e instanceof URIError)
      throw new MalformedError('Bad URI');
    if(e instanceof Deno.errors.NotFound)
      return next();

    throw e;
  }
});

const root = await Deno.realPath(basePath + '/index.html');

oakRouter.use((ctx, next) => ctx.request.method !== 'GET' ? next() : send(ctx, root));

app.use(oakRouter.allowedMethods(), oakRouter.routes());

// listen console log
app.addEventListener('listen', ({ hostname, port, secure }) => {
  if(hostname === '0.0.0.0')
    hostname = 'localhost';

  const protocol = secure ? 'https' : 'http';

  console.log(`Serving Tiny-Auth on ${protocol}://${hostname ?? 'localhost'}:${port} !`);
});

app.listen({ port: 3000 });
