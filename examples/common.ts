import { renderPlaygroundPage } from 'https://deno.land/x/gql@1.1.1/graphiql/render.ts';

import { DB } from '../deps/sqlite.ts';
import { Router, json } from '../api/mod.ts';

import { MalformedError } from '../common/errors.ts';
import { ScopedKeyValueStore } from '../common/scoped-key-value-store.ts';

import { AuthRequest, AuthUser } from '../auth/auth-types.ts';
import { validateUserSession } from '../auth/auth-middleware.ts';
import AuthApi from '../auth/auth-api.ts';
import CoreApi from '../auth/core-api.ts';
import HelpfulAuthDb from '../auth/helpers/helpful-auth-db.ts';

import TinyDbApi from '../db/tiny-db-api.ts';
import HelpfulTinyDb from '../db/helpers/helpful-tiny-db.ts';

import FileApi from '../file/file-api.ts';
import HelpfulFileDb from '../file/helpers/helpful-file-db.ts';

import GaiaApi from '../extensions/gaia-api.ts';
import WebFingerApi from '../extensions/web-finger/web-finger-api.ts';

import SQLiteKeyValueStore from '../implementations/sqlite/sqlite-key-value-store.ts';
import SQLiteDynTableStore from '../implementations/sqlite/sqlite-dyn-table-store.ts';
import DiskFileStore from '../implementations/native/disk-file-store.ts';

type SuperRequest = Request & AuthRequest;

if(Deno.args.includes('--persist')) {
  const it = Deno.readDir(Deno.cwd());
  let found: Deno.DirEntry | undefined = undefined;

  for await(const stat of it) {
    if(stat.name === 'dist') {
      found = stat;
      break;
    }
  }

  if(found && !found.isDirectory)
    throw new Error('Dist folder "./dist" needs to be a directory!');

  if(!found)
    await Deno.mkdir('./dist');
}

const serverName = Deno.args.includes('--servername') ? Deno.args[Deno.args.indexOf('--serverName') + 1] : 'localhost';

const db = new DB(Deno.args.includes('--persist') ? './dist/database.sqlite' : ':memory:');

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

const storageRoot = Deno.args.includes('--persist')
  ? await Deno.stat('./dist/files').catch(e => { if(e instanceof Deno.errors.NotFound) return false; throw e; })
    .then(stat => !stat ? Deno.mkdir('./dist/files') : null)
    .then(() => Deno.realPath('./dist/files'))
  : await Deno.makeTempDir();

console.log('Using storage root:', storageRoot);
const fileStore = new DiskFileStore({ storageRoot });

const coreApi = new CoreApi(authDb, 'complete (std)');
const authApi = new AuthApi(authDb);
const dbApi = new TinyDbApi(tinyDb,
  validateUserSession(authDb),
  req => {
    const playground = renderPlaygroundPage({ endpoint: new URL(req.url).pathname });

    return new Response(playground, { status: 200, headers: { 'Content-Type': 'text/html' } });
  });

const fileApi = new FileApi<SuperRequest>(fileDb,
  fileStore,
  validateUserSession(authDb));


const getUserFromAddress = async (addr: string): Promise<AuthUser | null> => {
  const prefs = await kv.search<string>({ prefix: 'userpref', limit: 2, query: { value: 'gaia:' + addr } });

  if(prefs.length > 1)
    throw new MalformedError('More than one user for this bucket exists!');

  if(prefs.length < 1)
    return null;

  return authDb.getUser(prefs[0]);
};

const gaiaKv = new ScopedKeyValueStore(kv, 'gaia');
const gaiaApi = new GaiaApi<SuperRequest>(fileDb, fileStore, gaiaKv, getUserFromAddress, 'tiny-std,0,' + serverName + ',blockstack_storage_please_sign');

const webFingerKv = new ScopedKeyValueStore(kv, 'webFinger');
const webFingerApi = new WebFingerApi<SuperRequest>(webFingerKv, id => authDb.getUser(id), validateUserSession(authDb));

const router = new Router<SuperRequest>();
router.use((req, next) => {
  console.log(`[${req.method}] ${req.url.replace(/\?sid=\w+$/, ' (auth\'d)')}`)
  return next();
});

coreApi.compile(router);
router.use('/auth', authApi.compile());

router.use(dbApi.compile());
router.use(fileApi.compile());
router.use('/gaia', gaiaApi.compile());
router.use(webFingerApi.compile());

router.get('/dump/key-value', async () => json(await kv.search({ })));
router.get('/dump/dyn', async () => json(await dts.list()));
router.get('/dump/dyn/:table', async req => json(await dts.table(req.params.table!).all()));

/** The base path for the frontend files */
const basePath = await Deno.realPath(Deno.cwd() + '/implementations/node-interface/dist/');
/** The path to the root index.html file */
const root = await Deno.realPath(basePath + '/index.html');

export { basePath, root, router };
