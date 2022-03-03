import { Server } from 'https://deno.land/std@0.123.0/http/server.ts'
import { serveFile } from 'https://deno.land/std@0.123.0/http/file_server.ts';

import { text } from '../api/mod.ts';

import { handleError } from '../common/middleware.ts';
import { MalformedError } from '../common/errors.ts';

import { basePath, root, router } from './common.ts';

// serve the frontend
router.get('/:path(.*)', async (req, next) => {
  if(req.method !== 'GET' || !req.params?.path)
    return next();

  try {

    let path = basePath + '/' + req.params.path;
    path = await Deno.realPath(path);

    if(!path.includes(basePath))
      return next();

    return await serveFile(req, path);

  } catch(e) {

    if(e instanceof URIError)
      throw new MalformedError('Bad URI');
    if(e instanceof Deno.errors.NotFound)
      return next();

    throw e;
  }
});

// serve the root index.html file
router.use((req, next) => req.method !== 'GET' ? next() : serveFile(req, root));

const rootHandleError = handleError('root');

const app = new Server({
  handler: req => rootHandleError(req, async () => {

    let res: Response;

    if(req.method === 'OPTIONS')
      res = new Response(undefined, { status: 204, headers: { allow: router.parseOptions(req).methods } });
    else {
      res = await router.process(req) || text('Not Found', { status: 404 })
    }

    if(Deno.args.includes('--cors')) {
      res.headers.append('access-control-allow-origin', '*');
      res.headers.append('access-control-allow-methods', router.parseOptions(req).methods);
      res.headers.append('access-control-allow-headers', '*');
    }

    return res;
  }),
  port: 3000
});

app.listenAndServe();
console.log('Serving Tiny-Auth on "http://localhost:3000/"!');
